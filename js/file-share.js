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
        this.wakeLock = null;
        this.webLock = null;

        // Stats tracking for receiver
        this.receivedFilesCount = 0;
        this.receivedTotalBytes = 0;

        this.init();
    }

    init() {
        this.bindEvents();
        this.checkUrlForRoom();
        this.setupBackgroundSupport();
    }

    // Keep transfer running when browser is minimized
    setupBackgroundSupport() {
        // Handle visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isTransferring()) {
                this.acquireWakeLock();
            }
        });
    }

    isTransferring() {
        return this.dataChannel && this.dataChannel.readyState === 'open' && !this.transferComplete;
    }

    // Request wake lock to prevent device sleep during transfer
    async acquireWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake lock acquired for background transfer');

                this.wakeLock.addEventListener('release', () => {
                    console.log('Wake lock released');
                });
            } catch (err) {
                console.log('Wake lock not available:', err.message);
            }
        }
    }

    releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release();
            this.wakeLock = null;
        }
    }

    // Acquire Web Lock to prevent tab from being discarded
    async acquireWebLock() {
        if ('locks' in navigator) {
            try {
                navigator.locks.request('file-transfer-lock', { mode: 'exclusive' }, async (lock) => {
                    console.log('Web lock acquired - transfer protected');
                    // Hold the lock until transfer completes
                    await new Promise((resolve) => {
                        this.releaseWebLock = resolve;
                    });
                });
            } catch (err) {
                console.log('Web lock not available:', err.message);
            }
        }
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

        // Password checkbox toggle
        const enablePassword = document.getElementById('enablePassword');
        const passwordInput = document.getElementById('sharePassword');
        if (enablePassword && passwordInput) {
            enablePassword.addEventListener('change', (e) => {
                passwordInput.style.display = e.target.checked ? 'block' : 'none';
                if (!e.target.checked) passwordInput.value = '';
            });
        }

        // Transfer mode toggle (link vs email)
        this.transferMode = 'link';
        const modeLinkBtn = document.getElementById('modeLinkBtn');
        const modeEmailBtn = document.getElementById('modeEmailBtn');
        const emailForm = document.getElementById('emailForm');
        const shareBtnText = document.getElementById('shareBtnText');

        if (modeLinkBtn && modeEmailBtn) {
            modeLinkBtn.addEventListener('click', () => {
                this.transferMode = 'link';
                modeLinkBtn.classList.add('active');
                modeEmailBtn.classList.remove('active');
                if (emailForm) emailForm.style.display = 'none';
                if (shareBtnText) shareBtnText.textContent = 'Generate Share Link';
            });

            modeEmailBtn.addEventListener('click', () => {
                this.transferMode = 'email';
                modeEmailBtn.classList.add('active');
                modeLinkBtn.classList.remove('active');
                if (emailForm) emailForm.style.display = 'block';
                if (shareBtnText) shareBtnText.textContent = 'Send Files';
            });
        }

        window.addEventListener('beforeunload', () => { if (this.ws) this.ws.close(); });
    }

    clearAllFiles() {
        this.files = [];
        this.updateFilesList();
        this.hideSelectedFiles();
        this.updateShareButton();
        // Resume stripe animation when files cleared
        const dropZone = document.getElementById('dropZone');
        if (dropZone) dropZone.classList.remove('has-files');
        // Stop circuit data flow animation when files cleared
        const heroCard = document.querySelector('.hero-card');
        if (heroCard) heroCard.classList.remove('data-flowing');
        // Hide share options when files cleared
        const shareOptions = document.getElementById('shareOptions');
        if (shareOptions) shareOptions.style.display = 'none';
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
        // Stop stripe animation when files are added
        const dropZone = document.getElementById('dropZone');
        if (dropZone && this.files.length > 0) {
            dropZone.classList.add('has-files');
        }
        // Start circuit data flow animation when files are added
        const heroCard = document.querySelector('.hero-card');
        if (heroCard && this.files.length > 0) {
            heroCard.classList.add('data-flowing');
        }
        // Show share options when files are added
        const shareOptions = document.getElementById('shareOptions');
        if (shareOptions && this.files.length > 0) {
            shareOptions.style.display = 'block';
        }
    }

    removeFile(index) {
        this.files.splice(index, 1);
        this.updateFilesList();
        this.updateShareButton();
        if (this.files.length === 0) {
            this.hideSelectedFiles();
            // Resume stripe animation when all files removed
            const dropZone = document.getElementById('dropZone');
            if (dropZone) dropZone.classList.remove('has-files');
            // Stop circuit data flow animation when all files removed
            const heroCard = document.querySelector('.hero-card');
            if (heroCard) heroCard.classList.remove('data-flowing');
            // Hide share options when all files removed
            const shareOptions = document.getElementById('shareOptions');
            if (shareOptions) shareOptions.style.display = 'none';
        }
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
                // Scroll to transfer section when peer connects
                this.scrollToTransferSection();
                await this.createAndSendOffer();
                break;

            case 'peer-left':
                // Don't show error if transfer completed successfully
                if (this.transferComplete) {
                    this.updateConnectionStatus('Peer disconnected');
                } else {
                    this.showNotification(msg.message || 'Peer disconnected', 'error');
                    this.updateTransferStatus('Peer disconnected');
                    this.updateConnectionStatus('Peer disconnected');
                }
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

            case 'password-required':
                this.pendingRoomId = msg.roomId;
                this.showPasswordPrompt();
                break;

            case 'room-closed':
                this.showNotification(msg.reason || 'Room closed', 'info');
                this.updateTransferStatus(msg.reason || 'Room closed');
                break;

            case 'error':
                this.showNotification(msg.message, 'error');
                if (msg.message === 'Room not found') {
                    this.updateTransferStatus('Share link expired or invalid. Ask sender for a new link.');
                } else if (msg.message === 'Incorrect password') {
                    this.showPasswordPrompt(true);
                } else {
                    this.updateTransferStatus(msg.message);
                }
                break;
        }
    }

    showPasswordPrompt(isRetry = false) {
        const password = prompt(isRetry ? 'Incorrect password. Please try again:' : 'This file is password protected. Enter password:');
        if (password) {
            this.send({
                type: 'verify-password',
                roomId: this.pendingRoomId,
                password: password
            });
        } else {
            this.showNotification('Password required to access files', 'error');
            this.updateTransferStatus('Access denied - password required');
        }
    }

    getShareOptions() {
        const downloadLimit = document.getElementById('downloadLimit');
        const expiryTime = document.getElementById('expiryTime');
        const enablePassword = document.getElementById('enablePassword');
        const sharePassword = document.getElementById('sharePassword');

        return {
            maxDownloads: downloadLimit ? parseInt(downloadLimit.value) : 1,
            expiryHours: expiryTime ? parseInt(expiryTime.value) : 24,
            password: (enablePassword?.checked && sharePassword?.value) ? sharePassword.value : null
        };
    }

    getEmailData() {
        return {
            recipients: document.getElementById('recipientEmails')?.value || '',
            senderEmail: document.getElementById('senderEmail')?.value || '',
            title: document.getElementById('transferTitle')?.value || '',
            message: document.getElementById('transferMessage')?.value || ''
        };
    }

    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    }

    async sendEmailNotification(link, emailData) {
        try {
            const totalSize = this.files.reduce((sum, f) => sum + f.size, 0);
            // Use Railway for email API (Render blocks SMTP ports)
            const emailApiUrl = 'https://p2p-file-share-production-6da9.up.railway.app/api/send-email';
            const response = await fetch(emailApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipients: emailData.recipients,
                    senderEmail: emailData.senderEmail,
                    title: emailData.title,
                    message: emailData.message,
                    link: link,
                    fileCount: this.files.length,
                    totalSize: this.formatFileSize(totalSize),
                    password: this.shareOptions.password,
                    expiryHours: this.shareOptions.expiryHours
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to send email');
            }

            return await response.json();
        } catch (error) {
            console.error('Email send error:', error);
            throw error;
        }
    }

    async createShareLink() {
        if (this.files.length === 0) {
            this.showNotification('Please select files', 'error');
            return;
        }

        // Validate password if enabled
        const enablePassword = document.getElementById('enablePassword');
        const sharePassword = document.getElementById('sharePassword');
        if (enablePassword?.checked && !sharePassword?.value) {
            this.showNotification('Please enter a password', 'error');
            return;
        }

        // Validate email inputs if in email mode
        if (this.transferMode === 'email') {
            const emailData = this.getEmailData();

            if (!emailData.recipients.trim()) {
                this.showNotification('Please enter recipient email(s)', 'error');
                return;
            }

            // Validate all recipient emails
            const emails = emailData.recipients.split(',').map(e => e.trim()).filter(e => e);
            const invalidEmails = emails.filter(e => !this.validateEmail(e));
            if (invalidEmails.length > 0) {
                this.showNotification(`Invalid email(s): ${invalidEmails.join(', ')}`, 'error');
                return;
            }

            if (!emailData.senderEmail.trim()) {
                this.showNotification('Please enter your email', 'error');
                return;
            }

            if (!this.validateEmail(emailData.senderEmail)) {
                this.showNotification('Please enter a valid sender email', 'error');
                return;
            }
        }

        this.isHost = true;
        this.roomId = this.generateRoomId();
        this.shareOptions = this.getShareOptions();

        try {
            await this.connectToServer();

            // Wait for room-created confirmation
            const roomCreated = new Promise((resolve, reject) => {
                this.onRoomCreated = resolve;
                setTimeout(() => reject(new Error('Room creation timeout')), 10000);
            });

            this.send({
                type: 'create-room',
                roomId: this.roomId,
                options: this.shareOptions
            });
            await roomCreated;

            const shareLinkSection = document.getElementById('shareLinkSection');
            const shareLink = document.getElementById('shareLink');

            // Use clean URL without index.html
            const basePath = window.location.pathname.replace(/index\.html$/, '');
            const link = `${window.location.origin}${basePath}?Q-Gate=${this.roomId}`;

            // If email mode, send the email
            let emailSentSuccessfully = false;
            if (this.transferMode === 'email') {
                const emailData = this.getEmailData();
                try {
                    await this.sendEmailNotification(link, emailData);
                    emailSentSuccessfully = true;
                } catch (emailError) {
                    this.showNotification('Email sending failed: ' + emailError.message, 'error');
                    // Continue anyway - link is still created
                }
            }

            if (shareLinkSection && shareLink) {
                shareLink.value = link;
                shareLinkSection.style.display = 'block';

                // Stop circuit data flow animation when share link is generated
                const heroCard = document.querySelector('.hero-card');
                if (heroCard) heroCard.classList.remove('data-flowing');

                // Update UI based on mode
                const statusTitle = document.querySelector('.status-title');
                const statusText = document.querySelector('.status-text');
                const radarLoader = document.querySelector('.radar-loader');

                if (this.transferMode === 'email' && emailSentSuccessfully) {
                    // Email mode - show success message
                    if (statusTitle) statusTitle.textContent = 'Email Sent Successfully!';
                    if (statusText) statusText.textContent = 'The recipient will receive an email with the download link.';
                    if (radarLoader) radarLoader.innerHTML = '<div style="font-size: 48px;">✓</div>';
                } else if (this.transferMode === 'email' && !emailSentSuccessfully) {
                    // Email failed - show link sharing fallback
                    if (statusTitle) statusTitle.textContent = 'Email Failed - Share Link Instead';
                    if (statusText) statusText.textContent = 'Copy this link and share it manually with the recipient.';
                }

                // Smooth scroll to share link section
                setTimeout(() => {
                    shareLinkSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);

                // Animated QR code generation with status messages
                this.generateAnimatedQRCode(link);
            }

            await this.initializeWebRTC();

            if (this.transferMode === 'email' && emailSentSuccessfully) {
                this.showNotification('Email sent! Waiting for recipient to download...', 'success');
            } else if (this.transferMode === 'link') {
                this.showNotification('Share link created!', 'success');
            }

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

    generateAnimatedQRCode(link) {
        const qrContainer = document.getElementById('qrCode');
        const qrHint = document.querySelector('.qr-hint');
        if (!qrContainer) return;

        // Quantum status messages
        const statusMessages = [
            'Initializing quantum state...',
            'Merging qubits...',
            'Stabilizing wormhole...',
            'Entangling particles...',
            'Calibrating tunnel coordinates...',
            'Locking dimensional rift...',
            'Synchronizing timelines...',
            'Quantum link established!'
        ];

        // Show loading animation first
        qrContainer.innerHTML = `
            <div class="qr-loading">
                <div class="qr-spinner"></div>
                <div class="qr-status-text">${statusMessages[0]}</div>
            </div>
        `;
        if (qrHint) qrHint.style.opacity = '0';

        // Cycle through status messages (slower - 1 second per message)
        let messageIndex = 0;
        const statusInterval = setInterval(() => {
            messageIndex++;
            const statusText = qrContainer.querySelector('.qr-status-text');
            if (statusText && messageIndex < statusMessages.length - 1) {
                statusText.style.opacity = '0';
                setTimeout(() => {
                    statusText.textContent = statusMessages[messageIndex];
                    statusText.style.opacity = '1';
                }, 200);
            }
        }, 1000);

        // After delay, show the actual QR code (8 seconds total for all messages)
        setTimeout(() => {
            clearInterval(statusInterval);
            const statusText = qrContainer.querySelector('.qr-status-text');
            if (statusText) {
                statusText.style.opacity = '0';
                setTimeout(() => {
                    statusText.textContent = statusMessages[statusMessages.length - 1];
                    statusText.style.opacity = '1';
                }, 200);
            }
            // Show QR code after final message
            setTimeout(() => {
                this.generateQRCode(link);
                if (qrHint) {
                    qrHint.style.opacity = '1';
                    qrHint.style.transition = 'opacity 0.5s ease';
                }
            }, 1000);
        }, 7000);
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
        // Add scanning line for futuristic effect
        qrContainer.innerHTML = svg + '<div class="scan-line"></div>';
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
            this.showNotification('Link copied! Waiting for receiver...', 'success');
        } catch (err) {
            shareLink.select();
            document.execCommand('copy');
            this.showNotification('Link copied! Waiting for receiver...', 'success');
        }
    }

    scrollToTransferSection() {
        const transferSection = document.getElementById('transferSection');
        if (transferSection) {
            transferSection.style.display = 'block';
            setTimeout(() => {
                transferSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }

    checkUrlForRoom() {
        const urlParams = new URLSearchParams(window.location.search);
        // Check for Q-Gate parameter (new) or room parameter (legacy)
        const roomId = urlParams.get('Q-Gate') || urlParams.get('room');
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
                this.updateConnectionStatus('Connecting...');
            } else if (state === 'connected') {
                this.showNotification('Connected!', 'success');
                this.updateConnectionStatus('P2P Connected');
                if (this.isHost) this.updateShareStatus('Transfer starting...');
            } else if (state === 'failed' || state === 'disconnected') {
                // Only show error if transfer didn't complete successfully
                if (this.transferComplete) {
                    // Transfer was successful, connection closing is normal
                    console.log('Connection closed after successful transfer');
                    this.updateConnectionStatus('Transfer completed - connection closed');
                } else {
                    if (state === 'failed') {
                        this.showNotification('P2P connection failed. Try refreshing both devices.', 'error');
                        this.updateTransferStatus('Connection failed - try again');
                        this.updateConnectionStatus('Connection failed');
                    } else {
                        this.updateTransferStatus('Connection interrupted...');
                        this.updateConnectionStatus('Disconnected');
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
            this.updateConnectionStatus('Waiting for files...');
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
                this.updateConnectionStatus('Sending files...');
                this.startFileTransfer();
            } else {
                this.updateTransferStatus('Receiving files...');
                this.updateConnectionStatus('Receiving files...');
            }
        };

        this.dataChannel.onclose = () => console.log('Data channel closed');
        this.dataChannel.onerror = (e) => {
            console.error('Data channel error:', e);
            this.showNotification('Transfer error', 'error');
        };

        this.dataChannel.onmessage = (e) => this.handleDataChannelMessage(e);
    }

    async handleDataChannelMessage(event) {
        if (typeof event.data === 'string') {
            const msg = JSON.parse(event.data);

            if (msg.type === 'file-info') {
                // Acquire locks when receiving starts (first file)
                if (msg.currentIndex === 1) {
                    await this.acquireWakeLock();
                    await this.acquireWebLock();
                }
                this.receivedFileInfo = msg;
                this.receivedChunks = [];
                this.totalBytesTransferred = 0;
                this.transferStartTime = Date.now();
                this.updateTransferStatus(`Receiving: ${msg.name} (${msg.currentIndex}/${msg.totalFiles})`);
                this.updateCurrentFileName(msg.name);
            } else if (msg.type === 'file-complete') {
                // Track received file stats before downloading
                if (this.receivedFileInfo) {
                    this.receivedFilesCount++;
                    this.receivedTotalBytes += this.receivedFileInfo.size;
                }
                this.assembleAndDownloadFile();
            } else if (msg.type === 'all-complete') {
                this.transferComplete = true; // Mark transfer as successful
                this.updateTransferStatus('Transfer Complete!');
                this.updateConnectionStatus('All files received successfully');
                this.updateProgressBar(100);
                this.showNotification('All files received!', 'success');

                // Update global stats (receiver side)
                const transferDuration = Date.now() - this.transferStartTime;
                if (window.globalStats && this.receivedFilesCount > 0) {
                    window.globalStats.addTransfer(this.receivedFilesCount, this.receivedTotalBytes, transferDuration);
                }

                // Update stats widgets with real transfer data (receiver side)
                if (window.statsWidgets && this.receivedFilesCount > 0) {
                    const speedMBps = this.receivedTotalBytes / (transferDuration / 1000) / (1024 * 1024);
                    window.statsWidgets.onTransferComplete(this.receivedFilesCount, speedMBps, transferDuration);
                }

                // Notify server that transfer is complete (for download count tracking)
                this.send({ type: 'transfer-complete', roomId: this.roomId });

                // Release locks after transfer complete
                this.releaseWakeLock();
                if (this.releaseWebLock) this.releaseWebLock();
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

        // Acquire locks to keep transfer running in background
        await this.acquireWakeLock();
        await this.acquireWebLock();

        this.transferStartTime = Date.now();

        for (let i = 0; i < this.files.length; i++) {
            await this.sendFile(this.files[i], i + 1, this.files.length);
        }

        this.dataChannel.send(JSON.stringify({ type: 'all-complete' }));
        this.transferComplete = true; // Mark transfer as successful
        this.updateTransferStatus('Transfer Complete!');
        this.updateShareStatus('Transfer Complete!');
        this.updateConnectionStatus('All files sent successfully');
        this.updateProgressBar(100);
        this.showNotification('All files sent!', 'success');

        // Update global stats (sender side)
        const totalBytes = this.files.reduce((sum, file) => sum + file.size, 0);
        const transferDuration = Date.now() - this.transferStartTime;
        if (window.globalStats) {
            window.globalStats.addTransfer(this.files.length, totalBytes, transferDuration);
        }

        // Update stats widgets with real transfer data (sender side)
        if (window.statsWidgets) {
            const speedMBps = totalBytes / (transferDuration / 1000) / (1024 * 1024);
            window.statsWidgets.onTransferComplete(this.files.length, speedMBps, transferDuration);
        }

        // Release locks after transfer complete
        this.releaseWakeLock();
        if (this.releaseWebLock) this.releaseWebLock();
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

        // Check if transfer is complete and update icon
        if (text === 'Transfer Complete!') {
            this.showTransferComplete();
        }
    }

    showTransferComplete() {
        const icon = document.querySelector('.transfer-icon');
        const title = document.querySelector('.transfer-title');
        if (icon) icon.classList.add('completed');
        if (title) title.classList.add('completed');
    }

    updateConnectionStatus(text) {
        const el = document.getElementById('connectionStatus');
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

// ============================================
// GLOBAL TRANSFER STATS TRACKER (Server-backed)
// ============================================

class GlobalStats {
    constructor() {
        this.apiUrl = '/api/stats';
        this.stats = {
            totalFiles: 0,
            totalBytes: 0,
            totalSessions: 0,
            totalDuration: 0
        };
        this.init();
    }

    async init() {
        await this.fetchStats();
        this.updateDisplay();
    }

    async fetchStats() {
        try {
            const response = await fetch(this.apiUrl);
            if (response.ok) {
                this.stats = await response.json();
            }
        } catch (e) {
            console.error('Error fetching global stats:', e);
        }
    }

    async addTransfer(fileCount, totalBytes, durationMs = 0) {
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    files: fileCount,
                    bytes: totalBytes,
                    duration: durationMs / 1000 // Convert to seconds
                })
            });
            if (response.ok) {
                const data = await response.json();
                this.stats = data.stats;
                this.updateDisplay();
            }
        } catch (e) {
            console.error('Error updating global stats:', e);
        }
    }

    formatGB(bytes) {
        const gb = bytes / (1024 * 1024 * 1024);
        if (gb >= 1000) {
            return (gb / 1000).toFixed(2) + ' TB';
        }
        return gb.toFixed(1) + ' GB';
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    formatSpeed(bytesPerSecond) {
        const mbps = bytesPerSecond / (1024 * 1024);
        if (mbps >= 1000) {
            return (mbps / 1000).toFixed(1) + ' GB/s';
        }
        return mbps.toFixed(1) + ' MB/s';
    }

    updateDisplay() {
        const filesEl = document.getElementById('globalTotalFiles');
        const sizeEl = document.getElementById('globalTotalSize');
        const sessionsEl = document.getElementById('globalTotalSessions');
        const speedEl = document.getElementById('globalAvgSpeed');

        if (filesEl) {
            filesEl.textContent = this.formatNumber(this.stats.totalFiles);
        }
        if (sizeEl) {
            sizeEl.textContent = this.formatGB(this.stats.totalBytes);
        }
        if (sessionsEl) {
            sessionsEl.textContent = this.formatNumber(this.stats.totalSessions);
        }
        if (speedEl) {
            // Calculate average speed: total bytes / total duration
            if (this.stats.totalDuration > 0) {
                const avgSpeed = this.stats.totalBytes / this.stats.totalDuration;
                speedEl.textContent = this.formatSpeed(avgSpeed);
            } else {
                speedEl.textContent = '--';
            }
        }
    }

    getStats() {
        return {
            totalFiles: this.stats.totalFiles,
            totalBytes: this.stats.totalBytes,
            totalSessions: this.stats.totalSessions
        };
    }
}

// Initialize global stats on page load
document.addEventListener('DOMContentLoaded', () => {
    window.globalStats = new GlobalStats();

    // Helper function to animate elements with glitch effect
    function animateElements(elements) {
        elements.forEach((el, index) => {
            el.classList.remove('live-pulse');

            setTimeout(() => {
                el.classList.remove('glitch-animate');
                void el.offsetWidth; // Force reflow
                el.classList.add('glitch-animate');

                // Add live pulse after glitch animation completes (0.8s)
                setTimeout(() => {
                    el.classList.add('live-pulse');
                }, 800);
            }, index * 150);
        });
    }

    // Create intersection observer for animations
    const animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const container = entry.target;

                // Determine which elements to animate based on container
                if (container.classList.contains('global-stats-container')) {
                    animateElements(container.querySelectorAll('.global-stat-number'));
                } else if (container.classList.contains('steps-grid')) {
                    animateElements(container.querySelectorAll('.step-number'));
                } else if (container.classList.contains('features-grid')) {
                    animateElements(container.querySelectorAll('.feature-icon'));
                }
            }
        });
    }, { threshold: 0.5 });

    // Observe all containers
    const statsContainer = document.querySelector('.global-stats-container');
    const stepsGrid = document.querySelector('.steps-grid');
    const featuresGrid = document.querySelector('.features-grid');

    if (statsContainer) animationObserver.observe(statsContainer);
    if (stepsGrid) animationObserver.observe(stepsGrid);
    if (featuresGrid) animationObserver.observe(featuresGrid);

    // Custom Cursor (Enhanced with futuristic effects)
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');
    const cursorGlitch = document.querySelector('.cursor-glitch');
    const cursorBrackets = document.querySelector('.cursor-brackets');
    const cursorData = document.querySelector('.cursor-data');
    const cursorScanline = document.querySelector('.cursor-scanline');
    const scrollIndicatorUp = document.querySelector('.cursor-scroll-indicator.up');
    const scrollIndicatorDown = document.querySelector('.cursor-scroll-indicator.down');
    const scrollRing = document.querySelector('.cursor-scroll-ring');

    if (cursorDot && cursorOutline) {
        let mouseX = 0, mouseY = 0;
        let outlineX = 0, outlineY = 0;
        let bracketsX = 0, bracketsY = 0;
        let lastX = 0, lastY = 0;
        let velocity = { x: 0, y: 0 };
        let particles = [];
        let isHovering = false;
        let isScrolling = false;
        let scrollTimeout = null;
        let lastScrollY = window.scrollY;
        let scrollDirection = 0;

        // Particle trail system
        function createParticle(x, y) {
            const particle = document.createElement('div');
            particle.className = 'cursor-particle';
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';
            particle.style.opacity = '1';
            document.body.appendChild(particle);

            const offsetX = (Math.random() - 0.5) * 20;
            const offsetY = (Math.random() - 0.5) * 20;

            particles.push({
                element: particle,
                x: x,
                y: y,
                vx: offsetX * 0.1,
                vy: offsetY * 0.1,
                life: 1
            });
        }

        // Update particles
        function updateParticles() {
            particles = particles.filter(p => {
                p.life -= 0.03;
                p.x += p.vx;
                p.y += p.vy;
                p.element.style.left = p.x + 'px';
                p.element.style.top = p.y + 'px';
                p.element.style.opacity = p.life;
                p.element.style.transform = `scale(${p.life})`;

                if (p.life <= 0) {
                    p.element.remove();
                    return false;
                }
                return true;
            });
        }

        // Show cursor when mouse enters window
        document.addEventListener('mouseenter', () => {
            cursorDot.style.opacity = '1';
            cursorOutline.style.opacity = '1';
            if (cursorScanline) cursorScanline.style.opacity = '0.5';
            if (cursorData) cursorData.style.opacity = '0.8';
        });

        // Hide cursor when mouse leaves window
        document.addEventListener('mouseleave', () => {
            cursorDot.style.opacity = '0';
            cursorOutline.style.opacity = '0';
            if (cursorScanline) cursorScanline.style.opacity = '0';
            if (cursorBrackets) cursorBrackets.style.opacity = '0';
            if (cursorData) cursorData.style.opacity = '0';
        });

        // Track mouse position
        let particleCounter = 0;
        document.addEventListener('mousemove', (e) => {
            lastX = mouseX;
            lastY = mouseY;
            mouseX = e.clientX;
            mouseY = e.clientY;

            // Calculate velocity
            velocity.x = mouseX - lastX;
            velocity.y = mouseY - lastY;
            const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

            // Dot follows immediately
            cursorDot.style.left = mouseX + 'px';
            cursorDot.style.top = mouseY + 'px';

            // Update scanline
            if (cursorScanline) {
                cursorScanline.style.left = mouseX + 'px';
                cursorScanline.style.top = mouseY + 'px';
                cursorScanline.style.width = Math.min(100 + speed * 2, 200) + 'px';
            }

            // Update data readout - 4D coordinates (X, Y, Z depth, T time)
            if (cursorData) {
                cursorData.style.left = mouseX + 'px';
                cursorData.style.top = mouseY + 'px';

                // Calculate Z (DOM depth + stacking context + scroll position)
                const elementUnderCursor = document.elementFromPoint(mouseX, mouseY);
                let zCoord = 0;
                if (elementUnderCursor) {
                    // Calculate DOM depth (how deep in the HTML tree)
                    let domDepth = 0;
                    let el = elementUnderCursor;
                    while (el && el !== document.body) {
                        domDepth++;
                        // Check for z-index on this element
                        const style = window.getComputedStyle(el);
                        const zIndex = parseInt(style.zIndex);
                        if (!isNaN(zIndex) && zIndex > 0) {
                            domDepth += Math.min(zIndex, 100); // Cap z-index contribution
                        }
                        el = el.parentElement;
                    }
                    // Add scroll position as depth factor (0-100 based on scroll %)
                    const scrollFactor = Math.round((window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight)) * 100);
                    zCoord = domDepth + scrollFactor;
                }

                // Calculate T (real timestamp - HH:MM:SS:ms format)
                const now = new Date();
                const hours = now.getHours();
                const minutes = now.getMinutes();
                const seconds = now.getSeconds();
                const ms = Math.floor(now.getMilliseconds() / 10); // 2 digits
                const tCoord = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;

                cursorData.innerHTML = `X:${Math.round(mouseX).toString().padStart(4, '0')}<br>Y:${Math.round(mouseY).toString().padStart(4, '0')}<br>Z:${zCoord.toString().padStart(4, '0')}<br>T:${tCoord}`;
            }

            // Update glitch position
            if (cursorGlitch) {
                cursorGlitch.style.left = mouseX + 'px';
                cursorGlitch.style.top = mouseY + 'px';
            }

            // Create particles based on speed
            particleCounter++;
            if (speed > 5 && particleCounter % 3 === 0) {
                createParticle(mouseX, mouseY);
            }
        });

        // Smooth outline and brackets follow
        function animateCursor() {
            outlineX += (mouseX - outlineX) * 0.15;
            outlineY += (mouseY - outlineY) * 0.15;
            cursorOutline.style.left = outlineX + 'px';
            cursorOutline.style.top = outlineY + 'px';

            // Brackets follow with slower easing
            if (cursorBrackets) {
                bracketsX += (mouseX - bracketsX) * 0.08;
                bracketsY += (mouseY - bracketsY) * 0.08;
                cursorBrackets.style.left = bracketsX + 'px';
                cursorBrackets.style.top = bracketsY + 'px';
            }

            updateParticles();
            requestAnimationFrame(animateCursor);
        }
        animateCursor();

        // Hover effect on interactive elements
        const interactiveElements = document.querySelectorAll('a, button, input, .feature-card, .step-card, .global-stat-card, .stat-card, .nav-link, .btn, [onclick]');
        interactiveElements.forEach(el => {
            el.addEventListener('mouseenter', () => {
                isHovering = true;
                cursorDot.style.transform = 'translate(-50%, -50%) scale(1.5)';
                cursorOutline.classList.add('cursor-hover');

                if (cursorBrackets) {
                    cursorBrackets.style.opacity = '1';
                    cursorBrackets.style.width = '60px';
                    cursorBrackets.style.height = '60px';
                }

                if (cursorData) {
                    cursorData.classList.add('hover-mode');
                }
            });
            el.addEventListener('mouseleave', () => {
                isHovering = false;
                cursorDot.style.transform = 'translate(-50%, -50%) scale(1)';
                cursorOutline.classList.remove('cursor-hover');

                if (cursorBrackets) {
                    cursorBrackets.style.opacity = '0';
                    cursorBrackets.style.width = '50px';
                    cursorBrackets.style.height = '50px';
                }

                if (cursorData) {
                    cursorData.classList.remove('hover-mode');
                }
            });
        });

        // Click effect with glitch burst
        document.addEventListener('mousedown', () => {
            cursorDot.style.transform = 'translate(-50%, -50%) scale(0.8)';
            cursorOutline.classList.add('cursor-click');

            // Trigger glitch effect
            if (cursorGlitch) {
                cursorGlitch.classList.remove('active');
                void cursorGlitch.offsetWidth;
                cursorGlitch.classList.add('active');
            }

            // Create burst of particles
            for (let i = 0; i < 8; i++) {
                setTimeout(() => createParticle(mouseX, mouseY), i * 20);
            }
        });

        document.addEventListener('mouseup', () => {
            cursorDot.style.transform = isHovering ? 'translate(-50%, -50%) scale(1.5)' : 'translate(-50%, -50%) scale(1)';
            cursorOutline.classList.remove('cursor-click');
        });

        // Initialize scanline visibility and cursor data
        if (cursorScanline) cursorScanline.style.opacity = '0.5';
        if (cursorData) cursorData.style.opacity = '0.8';

        // Scroll detection and animation
        function updateScrollIndicators() {
            if (scrollIndicatorUp) {
                scrollIndicatorUp.style.left = mouseX + 'px';
                scrollIndicatorUp.style.top = (mouseY - 30) + 'px';
            }
            if (scrollIndicatorDown) {
                scrollIndicatorDown.style.left = mouseX + 'px';
                scrollIndicatorDown.style.top = (mouseY + 30) + 'px';
            }
            if (scrollRing) {
                scrollRing.style.left = mouseX + 'px';
                scrollRing.style.top = mouseY + 'px';
            }
        }

        function createScrollTrail(direction, isHorizontal = false) {
            const trail = document.createElement('div');
            let dirClass = 'down'; // default

            if (isHorizontal) {
                dirClass = direction > 0 ? 'right' : 'left';
            } else {
                dirClass = direction > 0 ? 'down' : 'up';
            }

            trail.className = `cursor-scroll-trail ${dirClass} active`;
            trail.style.left = mouseX + 'px';
            trail.style.top = mouseY + 'px';
            document.body.appendChild(trail);
            setTimeout(() => trail.remove(), 400);
        }

        function startScrollAnimation(direction, isHorizontal = false) {
            if (!isScrolling) {
                isScrolling = true;
                cursorDot.classList.add('scrolling');
                cursorOutline.classList.add('scrolling');
            }

            scrollDirection = direction;
            updateScrollIndicators();

            if (scrollIndicatorUp && scrollIndicatorDown) {
                if (direction < 0) {
                    scrollIndicatorUp.classList.add('active');
                    scrollIndicatorDown.classList.remove('active');
                } else {
                    scrollIndicatorDown.classList.add('active');
                    scrollIndicatorUp.classList.remove('active');
                }
            }

            createScrollTrail(direction, isHorizontal);

            if (scrollRing) {
                scrollRing.classList.remove('active');
                void scrollRing.offsetWidth;
                scrollRing.classList.add('active');
            }
        }

        function stopScrollAnimation() {
            isScrolling = false;
            scrollDirection = 0;
            cursorDot.classList.remove('scrolling');
            cursorOutline.classList.remove('scrolling');

            if (scrollIndicatorUp) scrollIndicatorUp.classList.remove('active');
            if (scrollIndicatorDown) scrollIndicatorDown.classList.remove('active');
        }

        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            const direction = currentScrollY > lastScrollY ? 1 : -1;
            lastScrollY = currentScrollY;

            startScrollAnimation(direction);

            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                stopScrollAnimation();
            }, 150);
        }, { passive: true });

        window.addEventListener('wheel', (e) => {
            // Detect if scrolling is more horizontal or vertical
            const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
            const direction = isHorizontal ? (e.deltaX > 0 ? 1 : -1) : (e.deltaY > 0 ? 1 : -1);
            startScrollAnimation(direction, isHorizontal);

            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                stopScrollAnimation();
            }, 150);
        }, { passive: true });

        // Random glitch effect every few seconds
        setInterval(() => {
            if (Math.random() > 0.7 && cursorGlitch) {
                cursorGlitch.classList.remove('active');
                void cursorGlitch.offsetWidth;
                cursorGlitch.classList.add('active');

                // Brief RGB split on dot
                cursorDot.style.filter = 'drop-shadow(2px 0 0 rgba(255,0,0,0.8)) drop-shadow(-2px 0 0 rgba(0,255,255,0.8))';
                setTimeout(() => {
                    cursorDot.style.filter = 'none';
                }, 150);
            }
        }, 3000);
    }
});
