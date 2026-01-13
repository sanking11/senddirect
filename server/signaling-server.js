// Socket.IO Signaling Server for WebRTC P2P File Sharing
// Uses Socket.IO for better compatibility (falls back to HTTP polling if WebSocket blocked)

const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

// Configuration
const PORT = process.env.PORT || 3000;
const STATIC_DIR = path.join(__dirname, '..');

// Create HTTP server for serving static files
const server = http.createServer((req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Health check endpoint
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
        return;
    }

    // Parse URL and remove query string
    let urlPath = req.url.split('?')[0];

    // Serve index.html for root
    let filePath;
    if (urlPath === '/' || urlPath === '') {
        filePath = path.join(STATIC_DIR, 'index.html');
    } else {
        filePath = path.join(STATIC_DIR, urlPath);
    }

    const extname = path.extname(filePath);
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

    const contentType = contentTypes[extname] || 'application/octet-stream';

    fs.stat(filePath, (statErr, stats) => {
        if (statErr || stats.isDirectory()) {
            fs.readFile(path.join(STATIC_DIR, 'index.html'), (err, content) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Server Error');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(content, 'utf-8');
                }
            });
        } else {
            fs.readFile(filePath, (err, content) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Server Error: ' + err.code);
                } else {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content, 'utf-8');
                }
            });
        }
    });
});

// Create Socket.IO server with CORS and polling fallback
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    transports: ['polling', 'websocket'], // Try polling first, then websocket
    allowEIO3: true
});

// Store active rooms
const rooms = new Map();

// Clean up inactive rooms every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
        if (now - room.lastActivity > 30 * 60 * 1000) {
            console.log(`Cleaning up inactive room: ${roomId}`);
            rooms.delete(roomId);
        }
    }
}, 5 * 60 * 1000);

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id} (transport: ${socket.conn.transport.name})`);

    // Log when transport upgrades
    socket.conn.on('upgrade', (transport) => {
        console.log(`Connection ${socket.id} upgraded to: ${transport.name}`);
    });

    // Create room (host)
    socket.on('create-room', (data) => {
        const { roomId } = data;

        if (rooms.has(roomId)) {
            socket.emit('error', { message: 'Room already exists' });
            return;
        }

        rooms.set(roomId, {
            host: socket,
            hostId: socket.id,
            receiver: null,
            receiverId: null,
            lastActivity: Date.now()
        });

        socket.roomId = roomId;
        socket.role = 'host';
        socket.join(roomId);

        socket.emit('room-created', { roomId });
        console.log(`Room created: ${roomId} by ${socket.id}`);
    });

    // Join room (receiver)
    socket.on('join-room', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', { message: 'Room not found. The sender may have closed their browser.' });
            return;
        }

        if (room.receiver) {
            socket.emit('error', { message: 'Room is full.' });
            return;
        }

        room.receiver = socket;
        room.receiverId = socket.id;
        room.lastActivity = Date.now();

        socket.roomId = roomId;
        socket.role = 'receiver';
        socket.join(roomId);

        socket.emit('room-joined', { roomId });

        // Notify host
        if (room.host) {
            room.host.emit('peer-joined', { roomId });
        }

        console.log(`Receiver ${socket.id} joined room: ${roomId}`);
    });

    // Handle WebRTC signaling
    socket.on('offer', (data) => {
        const room = rooms.get(data.roomId);
        if (room && room.receiver) {
            room.lastActivity = Date.now();
            room.receiver.emit('offer', data);
            console.log(`Offer forwarded in room: ${data.roomId}`);
        }
    });

    socket.on('answer', (data) => {
        const room = rooms.get(data.roomId);
        if (room && room.host) {
            room.lastActivity = Date.now();
            room.host.emit('answer', data);
            console.log(`Answer forwarded in room: ${data.roomId}`);
        }
    });

    socket.on('ice-candidate', (data) => {
        const room = rooms.get(data.roomId);
        if (room) {
            room.lastActivity = Date.now();
            // Forward to the other peer
            if (socket.role === 'host' && room.receiver) {
                room.receiver.emit('ice-candidate', data);
            } else if (socket.role === 'receiver' && room.host) {
                room.host.emit('ice-candidate', data);
            }
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`Disconnected: ${socket.id}`);

        if (!socket.roomId) return;

        const room = rooms.get(socket.roomId);
        if (!room) return;

        if (socket.role === 'host') {
            if (room.receiver) {
                room.receiver.emit('peer-left', { message: 'Sender disconnected' });
            }
            rooms.delete(socket.roomId);
            console.log(`Room closed: ${socket.roomId}`);
        } else if (socket.role === 'receiver') {
            room.receiver = null;
            room.receiverId = null;
            if (room.host) {
                room.host.emit('peer-left', { message: 'Receiver disconnected' });
            }
        }
    });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n========================================');
    console.log('  P2P File Sharing Server (Socket.IO)');
    console.log('========================================\n');
    console.log(`Server running on port ${PORT}`);
    console.log(`Using Socket.IO with polling fallback\n`);

    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    console.log('Access the app at:');
    console.log(`  Local:   http://localhost:${PORT}`);

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`  Network: http://${net.address}:${PORT}`);
            }
        }
    }
    console.log('\nPress Ctrl+C to stop.\n');
});
