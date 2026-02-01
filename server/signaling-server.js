// WebSocket Signaling Server for WebRTC P2P File Sharing
// Pure WebSocket for maximum performance

const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

// Proton Bridge SMTP configuration (runs locally on your server)
function getEmailTransporter() {
    return nodemailer.createTransport({
        host: '127.0.0.1',
        port: 1026,  // Proton Bridge SMTP port
        secure: false,
        auth: {
            user: process.env.SMTP_USER,  // Your Proton Mail email
            pass: process.env.SMTP_PASS   // Proton Bridge password (from Bridge app)
        },
        tls: {
            rejectUnauthorized: false
        }
    });
}

// Send email using Proton Bridge SMTP
async function sendEmailViaSMTP(to, subject, html, replyTo) {
    const transporter = getEmailTransporter();
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

    const mailOptions = {
        from: `"Send Direct" <${fromAddress}>`,
        sender: fromAddress,
        envelope: {
            from: fromAddress,
            to: Array.isArray(to) ? to : [to]
        },
        to: Array.isArray(to) ? to.join(', ') : to,
        replyTo: replyTo,
        subject: subject,
        html: html
    };

    return transporter.sendMail(mailOptions);
}

const PORT = process.env.PORT || 3000;
const STATIC_DIR = path.join(__dirname, '..');

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
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

// Verify email configuration on startup
console.log('Email Configuration (Proton Bridge):');
console.log('  SMTP_USER:', process.env.SMTP_USER ? process.env.SMTP_USER : 'NOT SET');
console.log('  SMTP_PASS:', process.env.SMTP_PASS ? 'Set (' + process.env.SMTP_PASS.length + ' chars)' : 'NOT SET');

if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log('Email service ready (Proton Bridge SMTP on localhost:1025)');
} else {
    console.log('Email not configured - SMTP_USER and SMTP_PASS required');
}

// Build HTML email template
function buildEmailTemplate({ senderEmail, title, message, link, fileCount, totalSize, hasPassword, expiryHours }) {
    const expiryText = expiryHours === 1 ? '1 hour' :
                       expiryHours === 24 ? '1 day' :
                       expiryHours === 168 ? '7 days' :
                       expiryHours === 720 ? '30 days' : `${expiryHours} hours`;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a1f26;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1f26; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background: linear-gradient(135deg, #2a3441 0%, #1e2530 100%); border-radius: 16px; border: 1px solid rgba(74, 222, 128, 0.2); overflow: hidden;">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 30px 30px 20px; text-align: center; border-bottom: 1px solid rgba(74, 222, 128, 0.1);">
                            <div style="display: inline-block; background: rgba(74, 222, 128, 0.1); border-radius: 12px; padding: 12px 20px; margin-bottom: 15px;">
                                <span style="color: #4ade80; font-size: 24px; font-weight: 700; letter-spacing: 2px;">SEND DIRECT</span>
                            </div>
                            <h1 style="color: #ffffff; font-size: 22px; font-weight: 600; margin: 0;">Secure File Transfer</h1>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 30px;">
                            <p style="color: #9ca3af; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                                <strong style="color: #ffffff;">${senderEmail}</strong> has sent you ${fileCount} file${fileCount > 1 ? 's' : ''} (${totalSize}) using end-to-end encrypted P2P transfer.
                            </p>

                            ${title ? `<p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0 0 10px;">${title}</p>` : ''}
                            ${message ? `<p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 0 0 25px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 8px; border-left: 3px solid #4ade80;">${message}</p>` : ''}

                            <!-- Download Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 25px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${link}" style="display: inline-block; background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); color: #1a1f26; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-weight: 600; font-size: 15px; letter-spacing: 0.5px;">
                                            Download Files
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            ${hasPassword ? `
                            <div style="background: rgba(74, 222, 128, 0.1); border: 1px solid rgba(74, 222, 128, 0.2); border-radius: 8px; padding: 15px; margin: 20px 0;">
                                <p style="color: #4ade80; font-size: 13px; margin: 0; display: flex; align-items: center;">
                                    <span style="margin-right: 8px;">🔒</span>
                                    <strong>Password Protected</strong> - The sender will share the password with you separately.
                                </p>
                            </div>
                            ` : ''}

                            <!-- Info -->
                            <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 15px; margin-top: 20px;">
                                <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px;">
                                    <span style="color: #9ca3af;">Files:</span> ${fileCount} (${totalSize})
                                </p>
                                <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px;">
                                    <span style="color: #9ca3af;">Expires in:</span> ${expiryText}
                                </p>
                                <p style="color: #6b7280; font-size: 12px; margin: 0;">
                                    <span style="color: #9ca3af;">Security:</span> End-to-end encrypted P2P transfer
                                </p>
                            </div>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 30px; text-align: center; border-top: 1px solid rgba(74, 222, 128, 0.1); background: rgba(0,0,0,0.2);">
                            <p style="color: #6b7280; font-size: 12px; margin: 0 0 10px;">
                                Files are transferred directly between devices using WebRTC.<br>
                                No data is stored on our servers.
                            </p>
                            <p style="color: #4b5563; font-size: 11px; margin: 0;">
                                Powered by <span style="color: #4ade80;">Send Direct</span> - Quantum-Speed File Transfer
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

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

    // Git version info
    if (req.url === '/api/version') {
        try {
            const { execSync } = require('child_process');
            const hash = execSync('git rev-parse --short HEAD', { cwd: STATIC_DIR }).toString().trim();
            const date = execSync('git log -1 --format=%ci', { cwd: STATIC_DIR }).toString().trim();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ hash, date }));
        } catch {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ hash: 'unknown', date: '' }));
        }
        return;
    }

    // GitHub Webhook - auto deploy on push
    if (req.url === '/api/webhook/deploy' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            // Verify webhook secret (required environment variable)
            const crypto = require('crypto');
            const secret = process.env.WEBHOOK_SECRET;
            if (!secret) {
                console.error('WEBHOOK_SECRET environment variable is not set');
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Webhook not configured' }));
                return;
            }
            const signature = req.headers['x-hub-signature-256'];
            if (!signature) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing signature' }));
                return;
            }
            const hash = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
            if (hash !== signature) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid signature' }));
                return;
            }

            console.log('Webhook received - deploying...');
            const { exec } = require('child_process');
            exec('cd /var/www/senddirect && git pull origin master && npm install', (err, stdout, stderr) => {
                if (err) {
                    console.error('Deploy error:', err.message);
                } else {
                    console.log('Deploy output:', stdout);
                    // PM2 watch mode will auto-restart
                }
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Deploying...' }));
        });
        return;
    }

    // Proxy TURN credentials (keeps API key hidden)
    if (req.url === '/api/turn-credentials') {
        const apiKey = process.env.METERED_API_KEY;

        // Free public STUN + TURN servers for NAT traversal
        const freeServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            // Free TURN servers from Open Relay (metered.ca)
            { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
        ];

        if (!apiKey) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(freeServers));
            return;
        }

        const url = `https://senddirect.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`;

        https.get(url, (apiRes) => {
            let data = '';
            apiRes.on('data', chunk => data += chunk);
            apiRes.on('end', () => {
                try {
                    // Combine Metered servers with free servers for redundancy
                    const meteredServers = JSON.parse(data);
                    const combined = [...freeServers, ...meteredServers];
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(combined));
                } catch (e) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(freeServers));
                }
            });
        }).on('error', () => {
            // Fallback to free STUN + TURN servers on error
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(freeServers));
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

    // POST to send email with share link
    if (req.url === '/api/send-email' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { recipients, senderEmail, title, message, link, fileCount, totalSize, password, expiryHours } = data;

                if (!recipients || !senderEmail || !link) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing required fields' }));
                    return;
                }

                // Parse recipient emails
                const recipientList = recipients.split(',').map(e => e.trim()).filter(e => e);

                if (recipientList.length === 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No valid recipients' }));
                    return;
                }

                // Build email HTML
                const emailHtml = buildEmailTemplate({
                    senderEmail,
                    title: title || 'File Transfer',
                    message,
                    link,
                    fileCount,
                    totalSize,
                    hasPassword: !!password,
                    expiryHours
                });

                // Send email via Proton Bridge SMTP
                const emailSubject = title ? `${title} - Secure File Transfer` : `Secure File Transfer from ${senderEmail}`;

                console.log('Attempting to send email via Proton Bridge...');
                console.log('To:', recipientList.join(', '));
                console.log('Reply-To:', senderEmail);

                const result = await sendEmailViaSMTP(recipientList, emailSubject, emailHtml, senderEmail);
                console.log('Email sent successfully:', result.messageId);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Email sent successfully' }));

            } catch (e) {
                console.error('Email send error:', e.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to send email', message: e.message }));
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

            // Get options from message
            const options = msg.options || {};
            const maxDownloads = options.maxDownloads || 0; // 0 = unlimited
            const expiryHours = options.expiryHours || 24;
            const password = options.password || null;

            rooms.set(roomId, {
                host: ws,
                receiver: null,
                lastActivity: Date.now(),
                createdAt: Date.now(),
                // Room options
                maxDownloads: maxDownloads,
                downloadCount: 0,
                expiresAt: Date.now() + (expiryHours * 60 * 60 * 1000),
                password: password
            });
            ws.roomId = roomId;
            ws.role = 'host';
            send(ws, { type: 'room-created', roomId });
            console.log(`Room created: ${roomId} (max: ${maxDownloads}, expires: ${expiryHours}h, password: ${password ? 'yes' : 'no'})`);
            break;

        case 'join-room':
            const room = rooms.get(roomId);
            if (!room) {
                send(ws, { type: 'error', message: 'Room not found' });
                return;
            }

            // Check if room has expired
            if (room.expiresAt && Date.now() > room.expiresAt) {
                rooms.delete(roomId);
                send(ws, { type: 'error', message: 'This share link has expired' });
                return;
            }

            // Check if download limit reached
            if (room.maxDownloads > 0 && room.downloadCount >= room.maxDownloads) {
                rooms.delete(roomId);
                send(ws, { type: 'error', message: 'Download limit reached' });
                return;
            }

            // Check if password is required
            if (room.password) {
                // Send password-required response
                ws.pendingRoomId = roomId;
                send(ws, { type: 'password-required', roomId });
                return;
            }

            // No password required, join directly
            joinRoom(ws, room, roomId);
            break;

        case 'verify-password':
            const targetRoom = rooms.get(roomId);
            if (!targetRoom) {
                send(ws, { type: 'error', message: 'Room not found' });
                return;
            }

            if (msg.password === targetRoom.password) {
                joinRoom(ws, targetRoom, roomId);
            } else {
                send(ws, { type: 'error', message: 'Incorrect password' });
            }
            break;

        case 'transfer-complete':
            // Increment download count when transfer completes
            const transferRoom = rooms.get(roomId);
            if (transferRoom) {
                transferRoom.downloadCount++;
                console.log(`Room ${roomId} download count: ${transferRoom.downloadCount}/${transferRoom.maxDownloads || 'unlimited'}`);

                // Delete room if download limit reached
                if (transferRoom.maxDownloads > 0 && transferRoom.downloadCount >= transferRoom.maxDownloads) {
                    console.log(`Room ${roomId} reached download limit, deleting...`);
                    // Notify host that room is closing
                    if (transferRoom.host) {
                        send(transferRoom.host, { type: 'room-closed', reason: 'Download limit reached' });
                    }
                    rooms.delete(roomId);
                }
            }
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

function joinRoom(ws, room, roomId) {
    if (room.receiver) {
        console.log(`Room ${roomId} is full - receiver already exists`);
        send(ws, { type: 'error', message: 'Room full' });
        return;
    }
    if (!room.host || room.host.readyState !== WebSocket.OPEN) {
        console.log(`Room ${roomId} host disconnected`);
        rooms.delete(roomId);
        send(ws, { type: 'error', message: 'Host disconnected' });
        return;
    }
    room.receiver = ws;
    room.lastActivity = Date.now();
    ws.roomId = roomId;
    ws.role = 'receiver';
    console.log(`Receiver joining room ${roomId}, sending messages to both peers`);
    send(ws, { type: 'room-joined', roomId });
    // Send peer-joined to BOTH so both sides initialize WebRTC
    send(ws, { type: 'peer-joined', roomId });
    send(room.host, { type: 'peer-joined', roomId });
    console.log(`Receiver joined: ${roomId}`);
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
