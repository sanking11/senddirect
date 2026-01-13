// WebRTC Peer-to-Peer File Sharing
// End-to-end encrypted using DTLS 1.3
// Uses Socket.IO for signaling (with HTTP polling fallback)

class FileShare {
    constructor() {
        this.files = [];
        this.peerConnection = null;
        this.dataChannel = null;
        this.socket = null;
        this.roomId = null;
        this.isHost = false;
        this.receivedChunks = [];
        this.receivedFileInfo = null;
        this.chunkSize = 64 * 1024; // 64KB chunks
        this.transferStartTime = null;
        this.totalBytesTransferred = 0;

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

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        if (browseLink) {
            browseLink.addEventListener('click', (e) => {
                e.stopPropagation();
                fileInput?.click();
            });
        }

        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.createShareLink());
        }

        if (copyLink) {
            copyLink.addEventListener('click', () => this.copyShareLink());
        }

        const clearFilesBtn = document.getElementById('clearFiles');
        if (clearFilesBtn) {
            clearFilesBtn.addEventListener('click', () => this.clearAllFiles());
        }

        window.addEventListener('beforeunload', () => {
            if (this.socket) {
                this.socket.disconnect();
            }
        });
    }

    clearAllFiles() {
        this.files = [];
        this.updateFilesList();
        this.hideSelectedFiles();
        this.updateShareButton();
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files);
        this.addFiles(files);
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.addFiles(files);
    }

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
        if (this.files.length === 0) {
            this.hideSelectedFiles();
        }
    }

    updateShareButton() {
        const shareBtn = document.getElementById('shareBtn');
        if (shareBtn) {
            shareBtn.disabled = this.files.length === 0;
        }
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
                const index = parseInt(btn.dataset.index);
                this.removeFile(index);
            });
        });

        const totalSize = this.files.reduce((sum, file) => sum + file.size, 0);
        const totalSizeEl = document.getElementById('totalSize');
        const fileCountEl = document.getElementById('fileCount');

        if (totalSizeEl) totalSizeEl.textContent = this.formatFileSize(totalSize);
        if (fileCountEl) fileCountEl.textContent = `${this.files.length} file${this.files.length !== 1 ? 's' : ''}`;
    }

    showSelectedFiles() {
        const selectedFiles = document.getElementById('selectedFiles');
        if (selectedFiles && this.files.length > 0) {
            selectedFiles.style.display = 'block';
        }
    }

    hideSelectedFiles() {
        const selectedFiles = document.getElementById('selectedFiles');
        if (selectedFiles) selectedFiles.style.display = 'none';
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
        for (let i = 0; i < 12; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Connect to Socket.IO server
    connectToSignalingServer() {
        return new Promise((resolve, reject) => {
            try {
                const serverUrl = window.location.origin;
                console.log('Connecting to Socket.IO server:', serverUrl);

                this.socket = io(serverUrl, {
                    transports: ['polling', 'websocket'], // Try polling first
                    timeout: 20000,
                    forceNew: true
                });

                this.socket.on('connect', () => {
                    console.log('Connected to server via:', this.socket.io.engine.transport.name);
                    resolve();
                });

                this.socket.on('connect_error', (error) => {
                    console.error('Connection error:', error);
                    reject(new Error('Failed to connect to server'));
                });

                this.socket.on('disconnect', (reason) => {
                    console.log('Disconnected:', reason);
                    if (reason === 'io server disconnect') {
                        this.showNotification('Disconnected from server', 'error');
                    }
                });

                // Setup signaling event handlers
                this.setupSignalingHandlers();

                // Timeout
                setTimeout(() => {
                    if (!this.socket.connected) {
                        this.socket.disconnect();
                        reject(new Error('Connection timeout'));
                    }
                }, 15000);

            } catch (e) {
                console.error('Error creating socket:', e);
                reject(e);
            }
        });
    }

    setupSignalingHandlers() {
        this.socket.on('room-created', (data) => {
            console.log('Room created:', data.roomId);
        });

        this.socket.on('room-joined', (data) => {
            console.log('Joined room:', data.roomId);
            this.updateTransferStatus('Connected! Waiting for sender...');
        });

        this.socket.on('peer-joined', async (data) => {
            console.log('Peer joined');
            this.showNotification('Receiver connected!', 'success');
            this.updateShareStatus('Receiver connected! Establishing connection...');
            await this.createAndSendOffer();
        });

        this.socket.on('peer-left', (data) => {
            console.log('Peer left:', data.message);
            this.showNotification(data.message || 'Peer disconnected', 'error');
            this.updateTransferStatus('Peer disconnected');
        });

        this.socket.on('offer', async (data) => {
            console.log('Received offer');
            await this.handleOffer(data);
        });

        this.socket.on('answer', async (data) => {
            console.log('Received answer');
            await this.handleAnswer(data);
        });

        this.socket.on('ice-candidate', async (data) => {
            await this.handleIceCandidate(data);
        });

        this.socket.on('error', (data) => {
            console.error('Server error:', data.message);
            this.showNotification(data.message, 'error');
            this.updateTransferStatus(data.message);
        });
    }

    async createShareLink() {
        if (this.files.length === 0) {
            this.showNotification('Please select files to share', 'error');
            return;
        }

        this.isHost = true;
        this.roomId = this.generateRoomId();

        try {
            await this.connectToSignalingServer();

            this.socket.emit('create-room', { roomId: this.roomId });

            const shareLinkSection = document.getElementById('shareLinkSection');
            const shareLink = document.getElementById('shareLink');

            if (shareLinkSection && shareLink) {
                const link = `${window.location.origin}${window.location.pathname}?room=${this.roomId}`;
                shareLink.value = link;
                shareLinkSection.style.display = 'block';
                this.generateQRCode(link);
            }

            await this.initializeWebRTC();
            this.showNotification('Share link created! Waiting for receiver...', 'success');

        } catch (error) {
            console.error('Failed to create share link:', error);
            this.showNotification('Failed to connect: ' + error.message, 'error');
        }
    }

    generateQRCode(link) {
        const qrContainer = document.getElementById('qrCode');
        if (!qrContainer) return;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(link)}&bgcolor=1a1a1a&color=ffffff`;
        qrContainer.innerHTML = `<img src="${qrUrl}" alt="QR Code" style="border-radius: 8px;">`;
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
            this.updateTransferStatus('Connecting to server...');
            await this.connectToSignalingServer();

            this.updateTransferStatus('Joining room...');
            this.socket.emit('join-room', { roomId: this.roomId });

            await this.initializeWebRTC();
            this.updateTransferStatus('Waiting for sender...');

        } catch (error) {
            console.error('Failed to join room:', error);
            this.showNotification('Failed to connect: ' + error.message, 'error');
            this.updateTransferStatus('Connection failed: ' + error.message);
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
        const statusTitle = document.querySelector('.status-title');
        if (statusTitle) statusTitle.textContent = text;
    }

    async initializeWebRTC() {
        const config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                {
                    urls: 'turn:a.relay.metered.ca:80',
                    username: 'e8dd65c92f6ec4ee0c991153',
                    credential: 'uWdEpQ1hHqXY3M2q'
                },
                {
                    urls: 'turn:a.relay.metered.ca:443?transport=tcp',
                    username: 'e8dd65c92f6ec4ee0c991153',
                    credential: 'uWdEpQ1hHqXY3M2q'
                }
            ],
            iceCandidatePoolSize: 10
        };

        this.peerConnection = new RTCPeerConnection(config);

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.socket && this.socket.connected) {
                this.socket.emit('ice-candidate', {
                    roomId: this.roomId,
                    candidate: event.candidate
                });
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'connected') {
                this.showNotification('Connected! Ready to transfer.', 'success');
                if (this.isHost) {
                    this.updateShareStatus('Connected! Transfer starting...');
                }
            } else if (this.peerConnection.connectionState === 'failed') {
                this.showNotification('Connection failed.', 'error');
            }
        };

        if (this.isHost) {
            this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', { ordered: true });
            this.setupDataChannel();
        } else {
            this.peerConnection.ondatachannel = (event) => {
                this.dataChannel = event.channel;
                this.setupDataChannel();
            };
        }
    }

    async createAndSendOffer() {
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            this.socket.emit('offer', { roomId: this.roomId, sdp: offer.sdp });
        } catch (error) {
            console.error('Error creating offer:', error);
            this.showNotification('Failed to establish connection', 'error');
        }
    }

    async handleOffer(data) {
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            this.socket.emit('answer', { roomId: this.roomId, sdp: answer.sdp });
            this.updateTransferStatus('Connection established. Waiting for files...');
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }

    async handleAnswer(data) {
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    async handleIceCandidate(data) {
        try {
            if (data.candidate) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }

    setupDataChannel() {
        this.dataChannel.binaryType = 'arraybuffer';

        this.dataChannel.onopen = () => {
            console.log('Data channel opened');
            if (this.isHost) {
                this.showNotification('Starting transfer...', 'success');
                this.startFileTransfer();
            } else {
                this.updateTransferStatus('Receiving files...');
            }
        };

        this.dataChannel.onclose = () => console.log('Data channel closed');
        this.dataChannel.onerror = (error) => {
            console.error('Data channel error:', error);
            this.showNotification('Transfer error', 'error');
        };

        this.dataChannel.onmessage = (event) => this.handleDataChannelMessage(event);
    }

    handleDataChannelMessage(event) {
        if (typeof event.data === 'string') {
            const message = JSON.parse(event.data);

            if (message.type === 'file-info') {
                this.receivedFileInfo = message;
                this.receivedChunks = [];
                this.totalBytesTransferred = 0;
                this.transferStartTime = Date.now();
                this.updateTransferStatus(`Receiving: ${message.name} (${message.currentIndex}/${message.totalFiles})`);
                this.updateCurrentFileName(message.name);
            } else if (message.type === 'file-complete') {
                this.assembleAndDownloadFile();
            } else if (message.type === 'all-complete') {
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
                const slice = file.slice(offset, offset + this.chunkSize);
                reader.readAsArrayBuffer(slice);
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

                    const progress = Math.round((Math.min(offset, file.size) / file.size) * 100);
                    this.updateProgressBar(progress);
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
        const progressFill = document.getElementById('progressFill');
        const progressPercent = document.getElementById('progressPercent');
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressPercent) progressPercent.textContent = `${percent}%`;
    }

    updateTransferSpeed(totalSize) {
        const progressSpeed = document.getElementById('progressSpeed');
        const transferredSize = document.getElementById('transferredSize');
        const remainingSize = document.getElementById('remainingSize');
        const timeLeft = document.getElementById('timeLeft');

        if (!this.transferStartTime) return;

        const elapsed = (Date.now() - this.transferStartTime) / 1000;
        const speed = this.totalBytesTransferred / elapsed;

        if (progressSpeed) progressSpeed.textContent = `${this.formatFileSize(speed)}/s`;
        if (transferredSize) transferredSize.textContent = this.formatFileSize(this.totalBytesTransferred);
        if (remainingSize && totalSize) {
            remainingSize.textContent = this.formatFileSize(Math.max(0, totalSize - this.totalBytesTransferred));
        }
        if (timeLeft && speed > 0 && totalSize) {
            const secondsLeft = (totalSize - this.totalBytesTransferred) / speed;
            if (secondsLeft < 60) timeLeft.textContent = `${Math.ceil(secondsLeft)}s`;
            else timeLeft.textContent = `${Math.ceil(secondsLeft / 60)}m`;
        }
    }

    updateCurrentFileName(name) {
        const el = document.getElementById('currentFileName');
        if (el) el.textContent = name;
    }

    updateProgress() {
        if (!this.receivedFileInfo) return;
        const receivedSize = this.receivedChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        const percent = Math.round((receivedSize / this.receivedFileInfo.size) * 100);
        this.updateProgressBar(Math.min(percent, 100));
        this.updateTransferSpeed(this.receivedFileInfo.size);
    }

    assembleAndDownloadFile() {
        if (!this.receivedFileInfo || this.receivedChunks.length === 0) return;

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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.fileShare = new FileShare();
});

// Notification styles
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .notification-toast {
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: rgba(30, 30, 30, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 1rem 1.5rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        z-index: 10000;
        backdrop-filter: blur(10px);
        transition: transform 0.3s ease, opacity 0.3s ease;
        opacity: 0;
    }
    .notification-toast.show {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
    }
    .notification-success { border-color: rgba(74, 222, 128, 0.3); }
    .notification-success .notification-icon { color: #4ade80; }
    .notification-error { border-color: rgba(239, 68, 68, 0.3); }
    .notification-error .notification-icon { color: #ef4444; }
    .notification-icon { font-size: 1.2rem; font-weight: bold; }
    .notification-message { color: rgba(255, 255, 255, 0.9); font-size: 0.95rem; }
`;
document.head.appendChild(notificationStyles);
