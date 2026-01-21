// WebSocket Signaling Server for WebRTC P2P File Sharing
// Pure WebSocket for maximum performance

const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const STATIC_DIR = path.join(__dirname, '..');

// PostgreSQL connection (uses DATABASE_URL from Render)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Initialize database table
async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS global_stats (
                id INTEGER PRIMARY KEY DEFAULT 1,
                total_files BIGINT DEFAULT 0,
                total_bytes BIGINT DEFAULT 0,
                total_sessions BIGINT DEFAULT 0,
                total_duration DOUBLE PRECISION DEFAULT 0,
                updated_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT single_row CHECK (id = 1)
            )
        `);
        // Insert initial row if not exists
        await pool.query(`
            INSERT INTO global_stats (id) VALUES (1)
            ON CONFLICT (id) DO NOTHING
        `);
        console.log('Database initialized successfully');
    } catch (e) {
        console.error('Database init error:', e.message);
    }
}

// Get stats from database
async function getGlobalStats() {
    try {
        const result = await pool.query('SELECT * FROM global_stats WHERE id = 1');
        if (result.rows.length > 0) {
            const row = result.rows[0];
            return {
                totalFiles: parseInt(row.total_files) || 0,
                totalBytes: parseInt(row.total_bytes) || 0,
                totalSessions: parseInt(row.total_sessions) || 0,
                totalDuration: parseFloat(row.total_duration) || 0
            };
        }
    } catch (e) {
        console.error('Error getting stats:', e.message);
    }
    return { totalFiles: 0, totalBytes: 0, totalSessions: 0, totalDuration: 0 };
}

// Update stats in database
async function updateGlobalStats(files, bytes, duration) {
    try {
        const result = await pool.query(`
            UPDATE global_stats
            SET total_files = total_files + $1,
                total_bytes = total_bytes + $2,
                total_sessions = total_sessions + 1,
                total_duration = total_duration + $3,
                updated_at = NOW()
            WHERE id = 1
            RETURNING *
        `, [files, bytes, duration]);

        if (result.rows.length > 0) {
            const row = result.rows[0];
            return {
                totalFiles: parseInt(row.total_files) || 0,
                totalBytes: parseInt(row.total_bytes) || 0,
                totalSessions: parseInt(row.total_sessions) || 0,
                totalDuration: parseFloat(row.total_duration) || 0
            };
        }
    } catch (e) {
        console.error('Error updating stats:', e.message);
    }
    return null;
}

// Initialize database on startup
initDatabase();

// HTTP server for static files
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
        return;
    }

    // Proxy TURN credentials (keeps API key hidden)
    if (req.url === '/api/turn-credentials') {
        const https = require('https');
        const apiKey = process.env.METERED_API_KEY;
        const url = `https://senddirect.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`;

        https.get(url, (apiRes) => {
            let data = '';
            apiRes.on('data', chunk => data += chunk);
            apiRes.on('end', () => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data);
            });
        }).on('error', (err) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to fetch credentials' }));
        });
        return;
    }

    // GET global stats
    if (req.url === '/api/stats' && req.method === 'GET') {
        getGlobalStats().then(stats => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(stats));
        }).catch(err => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Database error' }));
        });
        return;
    }

    // POST to update stats after a transfer
    if (req.url === '/api/stats' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const files = (typeof data.files === 'number' && data.files > 0) ? data.files : 0;
                const bytes = (typeof data.bytes === 'number' && data.bytes > 0) ? data.bytes : 0;
                const duration = (typeof data.duration === 'number' && data.duration > 0) ? data.duration : 0;

                const stats = await updateGlobalStats(files, bytes, duration);

                if (stats) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, stats }));
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to update stats' }));
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    let urlPath = req.url.split('?')[0];
    let filePath = (urlPath === '/' || urlPath === '')
        ? path.join(STATIC_DIR, 'index.html')
        : path.join(STATIC_DIR, urlPath);

    const contentTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
    };

    const ext = path.extname(filePath);
    const contentType = contentTypes[ext] || 'application/octet-stream';

    fs.stat(filePath, (err, stats) => {
        if (err || stats.isDirectory()) {
            fs.readFile(path.join(STATIC_DIR, 'index.html'), (err, content) => {
                res.writeHead(err ? 500 : 200, { 'Content-Type': 'text/html' });
                res.end(err ? 'Server Error' : content);
            });
        } else {
            fs.readFile(filePath, (err, content) => {
                res.writeHead(err ? 500 : 200, { 'Content-Type': contentType });
                res.end(err ? 'Server Error' : content);
            });
        }
    });
});

// WebSocket server with explicit path for Safari compatibility
const wss = new WebSocket.Server({ server, path: '/ws' });

// Active rooms
const rooms = new Map();

// Cleanup inactive rooms every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
        if (now - room.lastActivity > 30 * 60 * 1000) {
            console.log(`Cleanup: ${roomId}`);
            rooms.delete(roomId);
        }
    }
}, 5 * 60 * 1000);

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            handleMessage(ws, msg);
        } catch (e) {
            console.error('Invalid message:', e.message);
        }
    });

    ws.on('close', () => {
        console.log('Connection closed');
        handleDisconnect(ws);
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err.message);
    });
});

// Heartbeat to detect dead connections
setInterval(() => {
    wss.clients.forEach((ws) => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

function handleMessage(ws, msg) {
    const { type, roomId } = msg;

    switch (type) {
        case 'create-room':
            if (rooms.has(roomId)) {
                send(ws, { type: 'error', message: 'Room exists' });
                return;
            }
            rooms.set(roomId, {
                host: ws,
                receiver: null,
                lastActivity: Date.now()
            });
            ws.roomId = roomId;
            ws.role = 'host';
            send(ws, { type: 'room-created', roomId });
            console.log(`Room created: ${roomId}`);
            break;

        case 'join-room':
            const room = rooms.get(roomId);
            if (!room) {
                send(ws, { type: 'error', message: 'Room not found' });
                return;
            }
            if (room.receiver) {
                send(ws, { type: 'error', message: 'Room full' });
                return;
            }
            room.receiver = ws;
            room.lastActivity = Date.now();
            ws.roomId = roomId;
            ws.role = 'receiver';
            send(ws, { type: 'room-joined', roomId });
            send(room.host, { type: 'peer-joined', roomId });
            console.log(`Receiver joined: ${roomId}`);
            break;

        case 'offer':
        case 'answer':
        case 'ice-candidate':
            forwardToOtherPeer(ws, msg);
            break;

        case 'ping':
            // Keep room alive
            if (ws.roomId && rooms.has(ws.roomId)) {
                rooms.get(ws.roomId).lastActivity = Date.now();
            }
            send(ws, { type: 'pong' });
            break;
    }
}

function forwardToOtherPeer(ws, msg) {
    const room = rooms.get(msg.roomId);
    if (!room) return;

    room.lastActivity = Date.now();
    const target = ws.role === 'host' ? room.receiver : room.host;

    if (target && target.readyState === WebSocket.OPEN) {
        send(target, msg);
    }
}

function handleDisconnect(ws) {
    if (!ws.roomId) return;

    const room = rooms.get(ws.roomId);
    if (!room) return;

    if (ws.role === 'host') {
        if (room.receiver) {
            send(room.receiver, { type: 'peer-left', message: 'Sender disconnected' });
        }
        rooms.delete(ws.roomId);
        console.log(`Room closed: ${ws.roomId}`);
    } else {
        room.receiver = null;
        if (room.host) {
            send(room.host, { type: 'peer-left', message: 'Receiver disconnected' });
        }
    }
}

function send(ws, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

server.listen(PORT, '0.0.0.0', () => {
    console.log('\n========================================');
    console.log('  P2P File Sharing (WebSocket)');
    console.log('========================================\n');
    console.log(`Server: http://localhost:${PORT}`);

    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`Network: http://${net.address}:${PORT}`);
            }
        }
    }
    console.log('\nPress Ctrl+C to stop.\n');
});
