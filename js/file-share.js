// WebRTC Peer-to-Peer File Sharing
// End-to-end encrypted using DTLS 1.3
// Pure WebSocket for maximum performance

class FileShare {
    constructor() {
        this.files = [];
        this.peerConnection = null;
        this.dataChannel = null;
        this.ws = null;
        this.roomId = null;
        this.isHost = false;
        this.receivedChunks = [];
        this.receivedFileInfo = null;
        this.chunkSize = 64 * 1024;
        this.transferStartTime = null;
        this.totalBytesTransferred = 0;
        this.transferComplete = false; // Track if transfer finished successfully

        this.init();
    }

    init() {
        this.bindEvents();
        this.checkUrlForRoom();
    }

    bindEvents() {
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const shareBtn = document.getElementById('shareBtn');
        const copyLink = document.getElementById('copyLink');
        const browseLink = document.querySelector('.browse-link');

        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
            dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            dropZone.addEventListener('drop', (e) => this.handleDrop(e));
            dropZone.addEventListener('click', () => fileInput?.click());
        }

        if (fileInput) fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        if (browseLink) browseLink.addEventListener('click', (e) => { e.stopPropagation(); fileInput?.click(); });
        if (shareBtn) shareBtn.addEventListener('click', () => this.createShareLink());
        if (copyLink) copyLink.addEventListener('click', () => this.copyShareLink());

        const clearFilesBtn = document.getElementById('clearFiles');
        if (clearFilesBtn) clearFilesBtn.addEventListener('click', () => this.clearAllFiles());

        window.addEventListener('beforeunload', () => { if (this.ws) this.ws.close(); });
    }

    clearAllFiles() {
        this.files = [];
        this.updateFilesList();
        this.hideSelectedFiles();
        this.updateShareButton();
    }

    handleDragOver(e) { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('drag-over'); }
    handleDragLeave(e) { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('drag-over'); }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');
        this.addFiles(Array.from(e.dataTransfer.files));
    }

    handleFileSelect(e) { this.addFiles(Array.from(e.target.files)); }

    addFiles(newFiles) {
        this.files = [...this.files, ...newFiles];
        this.updateFilesList();
        this.showSelectedFiles();
        this.updateShareButton();
    }

    removeFile(index) {
        this.files.splice(index, 1);
        this.updateFilesList();
        this.updateShareButton();
        if (this.files.length === 0) this.hideSelectedFiles();
    }

    updateShareButton() {
        const shareBtn = document.getElementById('shareBtn');
        if (shareBtn) shareBtn.disabled = this.files.length === 0;
    }

    updateFilesList() {
        const filesList = document.getElementById('filesList');
        if (!filesList) return;

        filesList.innerHTML = this.files.map((file, index) => `
            <div class="file-item">
                <div class="file-icon">${this.getFileIcon(file.type)}</div>
                <div class="file-info">
                    <span class="file-name">${this.escapeHtml(file.name)}</span>
                    <span class="file-size">${this.formatFileSize(file.size)}</span>
                </div>
                <button class="remove-file" data-index="${index}" title="Remove file">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `).join('');

        filesList.querySelectorAll('.remove-file').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeFile(parseInt(btn.dataset.index));
            });
        });

        const totalSize = this.files.reduce((sum, file) => sum + file.size, 0);
        const totalSizeEl = document.getElementById('totalSize');
        const fileCountEl = document.getElementById('fileCount');
        if (totalSizeEl) totalSizeEl.textContent = this.formatFileSize(totalSize);
        if (fileCountEl) fileCountEl.textContent = `${this.files.length} file${this.files.length !== 1 ? 's' : ''}`;
    }

    showSelectedFiles() {
        const el = document.getElementById('selectedFiles');
        if (el && this.files.length > 0) el.style.display = 'block';
    }

    hideSelectedFiles() {
        const el = document.getElementById('selectedFiles');
        if (el) el.style.display = 'none';
    }

    getFileIcon(mimeType) {
        if (!mimeType) return '📁';
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.startsWith('video/')) return '🎬';
        if (mimeType.startsWith('audio/')) return '🎵';
        if (mimeType.includes('pdf')) return '📄';
        if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '📦';
        if (mimeType.includes('text') || mimeType.includes('document')) return '📝';
        return '📁';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    generateRoomId() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 12; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return result;
    }

    getWebSocketUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Add explicit /ws path for better compatibility
        return `${protocol}//${window.location.host}/ws`;
    }

    connectToServer(retries = 3) {
        return new Promise((resolve, reject) => {
            const wsUrl = this.getWebSocketUrl();
            console.log('Connecting to:', wsUrl);

            const attemptConnection = (attempt) => {
                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log('WebSocket connected');
                    this.reconnectAttempts = 0;
                    resolve();
                };

                this.ws.onclose = () => {
                    console.log('WebSocket closed');
                    if (this.isHost && this.roomId) {
                        // Host: try to reconnect and recreate room
                        this.attemptReconnect();
                    }
                };

                this.ws.onerror = (err) => {
                    console.error('WebSocket error:', err);
                    if (attempt < retries) {
                        console.log(`Retrying... (${attempt + 1}/${retries})`);
                        setTimeout(() => attemptConnection(attempt + 1), 1000);
                    } else {
                        reject(new Error('Connection failed after ' + retries + ' attempts'));
                    }
                };

                this.ws.onmessage = (e) => {
                    try {
                        this.handleMessage(JSON.parse(e.data));
                    } catch (err) {
                        console.error('Message error:', err);
                    }
                };

                setTimeout(() => {
                    if (this.ws.readyState !== WebSocket.OPEN && attempt >= retries) {
                        this.ws.close();
                        reject(new Error('Connection timeout'));
                    }
                }, 10000);
            };

            attemptConnection(1);
        });
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= 5) {
            this.showNotification('Connection lost. Please refresh the page.', 'error');
            return;
        }
        this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;
        console.log('Reconnecting... attempt', this.reconnectAttempts);

        setTimeout(async () => {
            try {
                await this.connectToServer(1);
                if (this.isHost && this.roomId) {
                    this.send({ type: 'create-room', roomId: this.roomId });
                }
            } catch (e) {
                this.attemptReconnect();
            }
        }, 2000);
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    async handleMessage(msg) {
        console.log('Received:', msg.type);

        switch (msg.type) {
            case 'room-created':
                console.log('Room created:', msg.roomId);
                if (this.onRoomCreated) this.onRoomCreated();
                break;

            case 'room-joined':
                this.updateTransferStatus('Connected! Waiting for sender...');
                break;

            case 'peer-joined':
                this.showNotification('Receiver connected!', 'success');
                this.updateShareStatus('Establishing connection...');
                await this.createAndSendOffer();
                break;

            case 'peer-left':
                this.showNotification(msg.message || 'Peer disconnected', 'error');
                this.updateTransferStatus('Peer disconnected');
                break;

            case 'offer':
                await this.handleOffer(msg);
                break;

            case 'answer':
                await this.handleAnswer(msg);
                break;

            case 'ice-candidate':
                await this.handleIceCandidate(msg);
                break;

            case 'error':
                this.showNotification(msg.message, 'error');
                if (msg.message === 'Room not found') {
                    this.updateTransferStatus('Share link expired or invalid. Ask sender for a new link.');
                } else {
                    this.updateTransferStatus(msg.message);
                }
                break;
        }
    }

    async createShareLink() {
        if (this.files.length === 0) {
            this.showNotification('Please select files', 'error');
            return;
        }

        this.isHost = true;
        this.roomId = this.generateRoomId();

        try {
            await this.connectToServer();

            // Wait for room-created confirmation
            const roomCreated = new Promise((resolve, reject) => {
                this.onRoomCreated = resolve;
                setTimeout(() => reject(new Error('Room creation timeout')), 10000);
            });

            this.send({ type: 'create-room', roomId: this.roomId });
            await roomCreated;

            const shareLinkSection = document.getElementById('shareLinkSection');
            const shareLink = document.getElementById('shareLink');

            if (shareLinkSection && shareLink) {
                const link = `${window.location.origin}${window.location.pathname}?room=${this.roomId}`;
                shareLink.value = link;
                shareLinkSection.style.display = 'block';
                this.generateQRCode(link);
            }

            await this.initializeWebRTC();
            this.showNotification('Share link created!', 'success');

            // Start keepalive ping
            this.startKeepalive();

        } catch (error) {
            console.error('Error:', error);
            this.showNotification('Failed to connect: ' + error.message, 'error');
        }
    }

    startKeepalive() {
        // Send ping every 25 seconds to keep connection alive
        this.keepaliveInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send({ type: 'ping' });
            }
        }, 25000);
    }

    generateQRCode(link) {
        const qrContainer = document.getElementById('qrCode');
        if (!qrContainer) return;

        // Use local QR code generator (instant)
        const qr = qrcode(0, 'M');
        qr.addData(link);
        qr.make();

        const moduleCount = qr.getModuleCount();
        const cellSize = 5;
        const size = moduleCount * cellSize;
        const padding = 15;
        const totalSize = size + padding * 2;

        // Create SVG with animated dots
        let svg = `<svg width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}" class="qr-animated">`;
        svg += `<rect width="100%" height="100%" fill="rgba(255,255,255,0.1)" rx="12"/>`;

        let dotIndex = 0;
        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                if (qr.isDark(row, col)) {
                    const x = padding + col * cellSize + cellSize / 2;
                    const y = padding + row * cellSize + cellSize / 2;
                    const delay = (dotIndex * 5) % 500;
                    const isCorner = this.isQRCorner(row, col, moduleCount);
                    const radius = isCorner ? cellSize / 2 : cellSize / 2.5;

                    svg += `<circle cx="${x}" cy="${y}" r="${radius}" fill="#4ade80" class="qr-dot" style="animation-delay: ${delay}ms">`;
                    svg += `<animate attributeName="opacity" values="0;1;1" dur="0.5s" begin="${delay}ms" fill="freeze"/>`;
                    svg += `</circle>`;
                    dotIndex++;
                }
            }
        }

        svg += `</svg>`;
        qrContainer.innerHTML = svg;
    }

    isQRCorner(row, col, size) {
        // Check if dot is part of the three corner finder patterns
        const cornerSize = 7;
        // Top-left
        if (row < cornerSize && col < cornerSize) return true;
        // Top-right
        if (row < cornerSize && col >= size - cornerSize) return true;
        // Bottom-left
        if (row >= size - cornerSize && col < cornerSize) return true;
        return false;
    }

    async copyShareLink() {
        const shareLink = document.getElementById('shareLink');
        if (!shareLink) return;
        try {
            await navigator.clipboard.writeText(shareLink.value);
            this.showNotification('Link copied!', 'success');
        } catch (err) {
            shareLink.select();
            document.execCommand('copy');
            this.showNotification('Link copied!', 'success');
        }
    }

    checkUrlForRoom() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        if (roomId) {
            this.isHost = false;
            this.roomId = roomId;
            this.showReceiverMode();
            setTimeout(() => this.joinRoom(), 500);
        }
    }

    async joinRoom() {
        try {
            this.updateTransferStatus('Connecting...');
            await this.connectToServer();
            this.send({ type: 'join-room', roomId: this.roomId });
            await this.initializeWebRTC();
            this.updateTransferStatus('Waiting for sender...');
        } catch (error) {
            console.error('Join error:', error);
            this.showNotification('Failed: ' + error.message, 'error');
            this.updateTransferStatus('Connection failed');
        }
    }

    showReceiverMode() {
        const heroTitle = document.querySelector('.hero-title');
        const heroSubtitle = document.querySelector('.hero-subtitle');
        const dropZone = document.getElementById('dropZone');
        const selectedFiles = document.getElementById('selectedFiles');
        const shareBtn = document.getElementById('shareBtn');

        if (heroTitle) heroTitle.innerHTML = 'Receiving <span class="highlight">Files</span>';
        if (heroSubtitle) heroSubtitle.textContent = 'Connecting to sender...';
        if (dropZone) dropZone.style.display = 'none';
        if (selectedFiles) selectedFiles.style.display = 'none';
        if (shareBtn) shareBtn.style.display = 'none';

        const transferSection = document.getElementById('transferSection');
        if (transferSection) {
            transferSection.style.display = 'block';
            this.updateTransferStatus('Connecting...');
        }
    }

    updateShareStatus(text) {
        const el = document.querySelector('.status-title');
        if (el) el.textContent = text;
    }

    async initializeWebRTC() {
        // Fetch TURN credentials from server (API key hidden)
        let iceServers = [];
        try {
            const response = await fetch('/api/turn-credentials');
            iceServers = await response.json();
            console.log('TURN credentials loaded:', iceServers.length, 'servers');
        } catch (err) {
            console.error('Failed to fetch TURN credentials:', err);
            // Fallback to STUN only
            iceServers = [{ urls: 'stun:stun.relay.metered.ca:80' }];
        }

        const config = {
            iceServers: iceServers,
            iceCandidatePoolSize: 10
        };

        this.peerConnection = new RTCPeerConnection(config);

        this.peerConnection.onicecandidate = (e) => {
            if (e.candidate) {
                this.send({ type: 'ice-candidate', roomId: this.roomId, candidate: e.candidate });
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log('Connection state:', state);
            if (state === 'connecting') {
                this.updateTransferStatus('Establishing P2P connection...');
            } else if (state === 'connected') {
                this.showNotification('Connected!', 'success');
                if (this.isHost) this.updateShareStatus('Transfer starting...');
            } else if (state === 'failed' || state === 'disconnected') {
                // Only show error if transfer didn't complete successfully
                if (this.transferComplete) {
                    // Transfer was successful, connection closing is normal
                    console.log('Connection closed after successful transfer');
                } else {
                    if (state === 'failed') {
                        this.showNotification('P2P connection failed. Try refreshing both devices.', 'error');
                        this.updateTransferStatus('Connection failed - try again');
                    } else {
                        this.updateTransferStatus('Connection interrupted...');
                    }
                }
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            const state = this.peerConnection.iceConnectionState;
            console.log('ICE state:', state);
            if (state === 'checking') {
                this.updateTransferStatus('Finding best connection path...');
            } else if (state === 'failed' && !this.transferComplete) {
                this.showNotification('Network connection failed', 'error');
                this.updateTransferStatus('Network error - check firewall');
            }
        };

        if (this.isHost) {
            this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', { ordered: true });
            this.setupDataChannel();
        } else {
            this.peerConnection.ondatachannel = (e) => {
                this.dataChannel = e.channel;
                this.setupDataChannel();
            };
        }
    }

    async createAndSendOffer() {
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            this.send({ type: 'offer', roomId: this.roomId, sdp: offer.sdp });
        } catch (error) {
            console.error('Offer error:', error);
            this.showNotification('Connection failed', 'error');
        }
    }

    async handleOffer(msg) {
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            this.send({ type: 'answer', roomId: this.roomId, sdp: answer.sdp });
            this.updateTransferStatus('Connected! Waiting for files...');
        } catch (error) {
            console.error('Offer handling error:', error);
        }
    }

    async handleAnswer(msg) {
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }));
        } catch (error) {
            console.error('Answer error:', error);
        }
    }

    async handleIceCandidate(msg) {
        try {
            if (msg.candidate) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
            }
        } catch (error) {
            console.error('ICE error:', error);
        }
    }

    setupDataChannel() {
        this.dataChannel.binaryType = 'arraybuffer';

        this.dataChannel.onopen = () => {
            console.log('Data channel open');
            if (this.isHost) {
                this.showNotification('Starting transfer...', 'success');
                this.startFileTransfer();
            } else {
                this.updateTransferStatus('Receiving files...');
            }
        };

        this.dataChannel.onclose = () => console.log('Data channel closed');
        this.dataChannel.onerror = (e) => {
            console.error('Data channel error:', e);
            this.showNotification('Transfer error', 'error');
        };

        this.dataChannel.onmessage = (e) => this.handleDataChannelMessage(e);
    }

    handleDataChannelMessage(event) {
        if (typeof event.data === 'string') {
            const msg = JSON.parse(event.data);

            if (msg.type === 'file-info') {
                this.receivedFileInfo = msg;
                this.receivedChunks = [];
                this.totalBytesTransferred = 0;
                this.transferStartTime = Date.now();
                this.updateTransferStatus(`Receiving: ${msg.name} (${msg.currentIndex}/${msg.totalFiles})`);
                this.updateCurrentFileName(msg.name);
            } else if (msg.type === 'file-complete') {
                this.assembleAndDownloadFile();
            } else if (msg.type === 'all-complete') {
                this.transferComplete = true; // Mark transfer as successful
                this.updateTransferStatus('All files received!');
                this.updateProgressBar(100);
                this.showNotification('All files received!', 'success');
            }
        } else {
            this.receivedChunks.push(event.data);
            this.totalBytesTransferred += event.data.byteLength;
            this.updateProgress();
        }
    }

    async startFileTransfer() {
        const transferSection = document.getElementById('transferSection');
        if (transferSection) transferSection.style.display = 'block';

        this.transferStartTime = Date.now();

        for (let i = 0; i < this.files.length; i++) {
            await this.sendFile(this.files[i], i + 1, this.files.length);
        }

        this.dataChannel.send(JSON.stringify({ type: 'all-complete' }));
        this.transferComplete = true; // Mark transfer as successful
        this.updateTransferStatus('All files sent!');
        this.updateProgressBar(100);
        this.showNotification('All files sent!', 'success');
    }

    async sendFile(file, currentIndex, totalFiles) {
        return new Promise((resolve) => {
            this.dataChannel.send(JSON.stringify({
                type: 'file-info',
                name: file.name,
                size: file.size,
                mimeType: file.type,
                currentIndex,
                totalFiles
            }));

            this.updateTransferStatus(`Sending: ${file.name} (${currentIndex}/${totalFiles})`);
            this.updateCurrentFileName(file.name);

            const reader = new FileReader();
            let offset = 0;
            this.totalBytesTransferred = 0;

            const readNextChunk = () => {
                reader.readAsArrayBuffer(file.slice(offset, offset + this.chunkSize));
            };

            reader.onload = (e) => {
                const sendChunk = () => {
                    if (this.dataChannel.bufferedAmount > this.chunkSize * 16) {
                        setTimeout(sendChunk, 10);
                        return;
                    }

                    this.dataChannel.send(e.target.result);
                    this.totalBytesTransferred = offset + e.target.result.byteLength;
                    offset += this.chunkSize;

                    this.updateProgressBar(Math.round((Math.min(offset, file.size) / file.size) * 100));
                    this.updateTransferSpeed(file.size);

                    if (offset < file.size) {
                        readNextChunk();
                    } else {
                        this.dataChannel.send(JSON.stringify({ type: 'file-complete' }));
                        setTimeout(resolve, 100);
                    }
                };
                sendChunk();
            };

            readNextChunk();
        });
    }

    updateProgressBar(percent) {
        const fill = document.getElementById('progressFill');
        const text = document.getElementById('progressPercent');
        if (fill) fill.style.width = `${percent}%`;
        if (text) text.textContent = `${percent}%`;
    }

    updateTransferSpeed(totalSize) {
        if (!this.transferStartTime) return;
        const elapsed = (Date.now() - this.transferStartTime) / 1000;
        const speed = this.totalBytesTransferred / elapsed;

        const speedEl = document.getElementById('progressSpeed');
        const transferredEl = document.getElementById('transferredSize');
        const remainingEl = document.getElementById('remainingSize');
        const timeEl = document.getElementById('timeLeft');

        if (speedEl) speedEl.textContent = `${this.formatFileSize(speed)}/s`;
        if (transferredEl) transferredEl.textContent = this.formatFileSize(this.totalBytesTransferred);
        if (remainingEl) remainingEl.textContent = this.formatFileSize(Math.max(0, totalSize - this.totalBytesTransferred));
        if (timeEl && speed > 0) {
            const secs = (totalSize - this.totalBytesTransferred) / speed;
            timeEl.textContent = secs < 60 ? `${Math.ceil(secs)}s` : `${Math.ceil(secs / 60)}m`;
        }
    }

    updateCurrentFileName(name) {
        const el = document.getElementById('currentFileName');
        if (el) el.textContent = name;
    }

    updateProgress() {
        if (!this.receivedFileInfo) return;
        const received = this.receivedChunks.reduce((sum, c) => sum + c.byteLength, 0);
        this.updateProgressBar(Math.min(Math.round((received / this.receivedFileInfo.size) * 100), 100));
        this.updateTransferSpeed(this.receivedFileInfo.size);
    }

    assembleAndDownloadFile() {
        if (!this.receivedFileInfo || !this.receivedChunks.length) return;

        const blob = new Blob(this.receivedChunks, { type: this.receivedFileInfo.mimeType || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = this.receivedFileInfo.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification(`Downloaded: ${this.receivedFileInfo.name}`, 'success');

        this.receivedChunks = [];
        this.receivedFileInfo = null;
        this.totalBytesTransferred = 0;
        this.transferStartTime = Date.now();
    }

    updateTransferStatus(text) {
        const el = document.querySelector('.transfer-title');
        if (el) el.textContent = text;
    }

    showNotification(message, type = 'info') {
        const existing = document.querySelector('.notification-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `notification-toast notification-${type}`;
        toast.innerHTML = `
            <span class="notification-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
            <span class="notification-message">${this.escapeHtml(message)}</span>
        `;

        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
}

document.addEventListener('DOMContentLoaded', () => { window.fileShare = new FileShare(); });

const styles = document.createElement('style');
styles.textContent = `
    .notification-toast {
        position: fixed; bottom: 30px; left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: rgba(30, 30, 30, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px; padding: 1rem 1.5rem;
        display: flex; align-items: center; gap: 0.75rem;
        z-index: 10000; backdrop-filter: blur(10px);
        transition: transform 0.3s ease, opacity 0.3s ease; opacity: 0;
    }
    .notification-toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
    .notification-success { border-color: rgba(74, 222, 128, 0.3); }
    .notification-success .notification-icon { color: #4ade80; }
    .notification-error { border-color: rgba(239, 68, 68, 0.3); }
    .notification-error .notification-icon { color: #ef4444; }
    .notification-icon { font-size: 1.2rem; font-weight: bold; }
    .notification-message { color: rgba(255, 255, 255, 0.9); font-size: 0.95rem; }
`;
document.head.appendChild(styles);
