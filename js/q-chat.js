/**
 * Q-Chat - Secure P2P Chat using WebRTC
 * End-to-end encrypted communication with DTLS 1.3
 */

class QChat {
    constructor() {
        this.ws = null;
        this.peerConnection = null;
        this.dataChannel = null;
        this.roomId = null;
        this.isHost = false;
        this.isConnected = false;
        this.unreadCount = 0;
        this.isPanelOpen = false;

        this.initElements();
        this.bindEvents();
    }

    initElements() {
        // Panel elements
        this.panel = document.getElementById('qchatPanel');
        this.toggleBtn = document.getElementById('qchatToggle');
        this.closeBtn = document.getElementById('qchatClose');
        this.badge = document.getElementById('qchatBadge');

        // Connection elements
        this.connectSection = document.getElementById('qchatConnect');
        this.roomInfoSection = document.getElementById('qchatRoomInfo');
        this.messagesSection = document.getElementById('qchatMessages');
        this.inputSection = document.getElementById('qchatInputSection');

        // Status elements
        this.statusEl = document.getElementById('qchatStatus');
        this.roomCodeEl = document.getElementById('qchatRoomCode');

        // Buttons
        this.createBtn = document.getElementById('qchatCreate');
        this.joinBtn = document.getElementById('qchatJoin');
        this.copyCodeBtn = document.getElementById('qchatCopyCode');
        this.sendBtn = document.getElementById('qchatSendBtn');

        // Inputs
        this.roomInput = document.getElementById('qchatRoomInput');
        this.messageInput = document.getElementById('qchatMessageInput');

        // Messages list
        this.messagesList = document.getElementById('qchatMessagesList');
    }

    bindEvents() {
        // Toggle panel
        this.toggleBtn?.addEventListener('click', () => this.togglePanel());
        this.closeBtn?.addEventListener('click', () => this.closePanel());

        // Create/Join room
        this.createBtn?.addEventListener('click', () => this.createRoom());
        this.joinBtn?.addEventListener('click', () => this.joinRoom());
        this.roomInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });

        // Copy room code
        this.copyCodeBtn?.addEventListener('click', () => this.copyRoomCode());

        // Send message
        this.sendBtn?.addEventListener('click', () => this.sendMessage());
        this.messageInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isPanelOpen &&
                !this.panel?.contains(e.target) &&
                !this.toggleBtn?.contains(e.target)) {
                this.closePanel();
            }
        });
    }

    togglePanel() {
        if (this.isPanelOpen) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }

    openPanel() {
        this.panel?.classList.add('open');
        this.toggleBtn?.classList.add('active');
        this.isPanelOpen = true;
        this.clearUnread();
    }

    closePanel() {
        this.panel?.classList.remove('open');
        this.toggleBtn?.classList.remove('active');
        this.isPanelOpen = false;
    }

    generateRoomId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    getWebSocketUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/ws`;
    }

    async connectToServer() {
        return new Promise((resolve, reject) => {
            const wsUrl = this.getWebSocketUrl();
            console.log('Q-Chat: Connecting to:', wsUrl);

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('Q-Chat: WebSocket connected');
                resolve();
            };

            this.ws.onerror = (error) => {
                console.error('Q-Chat: WebSocket error:', error);
                reject(error);
            };

            this.ws.onclose = () => {
                console.log('Q-Chat: WebSocket closed');
                this.handleDisconnect();
            };

            this.ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                this.handleSignalingMessage(msg);
            };
        });
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    async createRoom() {
        this.isHost = true;
        this.roomId = this.generateRoomId();
        this.updateStatus('connecting', 'Connecting...');

        try {
            await this.connectToServer();
            this.send({ type: 'create-room', roomId: this.roomId });
        } catch (error) {
            this.showSystemMessage('Failed to connect to server');
            this.updateStatus('disconnected', 'Connection failed');
        }
    }

    async joinRoom() {
        const roomId = this.roomInput?.value.trim().toUpperCase();
        if (!roomId || roomId.length < 4) {
            this.showSystemMessage('Please enter a valid room code');
            return;
        }

        this.isHost = false;
        this.roomId = roomId;
        this.updateStatus('connecting', 'Joining...');

        try {
            await this.connectToServer();
            this.send({ type: 'join-room', roomId: this.roomId });
        } catch (error) {
            this.showSystemMessage('Failed to connect to server');
            this.updateStatus('disconnected', 'Connection failed');
        }
    }

    async handleSignalingMessage(msg) {
        switch (msg.type) {
            case 'room-created':
                this.showRoomInfo();
                this.updateStatus('connecting', 'Waiting for peer...');
                break;

            case 'room-joined':
                this.showSystemMessage('Joined room! Waiting for host...');
                this.updateStatus('connecting', 'Waiting for host...');
                break;

            case 'peer-joined':
                this.showSystemMessage('Peer connected! Setting up secure channel...');
                this.updateStatus('connecting', 'Establishing P2P...');
                await this.initializeWebRTC();
                if (this.isHost) {
                    await this.createAndSendOffer();
                }
                break;

            case 'peer-left':
                this.showSystemMessage('Peer disconnected');
                this.updateStatus('disconnected', 'Peer left');
                this.disableChat();
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
                this.showSystemMessage(`Error: ${msg.message}`);
                this.updateStatus('disconnected', 'Error');
                console.error('Q-Chat Server Error:', msg.message);
                break;
        }
    }

    async initializeWebRTC() {
        // Fetch TURN credentials from server (API key hidden)
        let iceServers = [];
        try {
            const response = await fetch('/api/turn-credentials');
            iceServers = await response.json();
            console.log('Q-Chat: Using TURN servers for NAT traversal');
        } catch (err) {
            console.log('Q-Chat: TURN fetch failed, using STUN fallback');
            iceServers = [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ];
        }

        const config = { iceServers };

        this.peerConnection = new RTCPeerConnection(config);

        this.peerConnection.onicecandidate = (e) => {
            if (e.candidate) {
                this.send({
                    type: 'ice-candidate',
                    roomId: this.roomId,
                    candidate: e.candidate
                });
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log('Q-Chat: Connection state:', state);

            if (state === 'connected') {
                this.updateStatus('connected', 'Secure P2P');
                this.showSystemMessage('🔒 Secure connection established (DTLS 1.3)');
            } else if (state === 'disconnected' || state === 'failed') {
                this.updateStatus('disconnected', 'Disconnected');
                this.disableChat();
            }
        };

        if (this.isHost) {
            this.dataChannel = this.peerConnection.createDataChannel('qchat', {
                ordered: true
            });
            this.setupDataChannel();
        } else {
            this.peerConnection.ondatachannel = (event) => {
                this.dataChannel = event.channel;
                this.setupDataChannel();
            };
        }
    }

    setupDataChannel() {
        this.dataChannel.onopen = () => {
            console.log('Q-Chat: Data channel open');
            this.isConnected = true;
            this.enableChat();
            this.showChatUI();
        };

        this.dataChannel.onclose = () => {
            console.log('Q-Chat: Data channel closed');
            this.isConnected = false;
            this.disableChat();
        };

        this.dataChannel.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.receiveMessage(data);
        };
    }

    async createAndSendOffer() {
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            this.send({
                type: 'offer',
                roomId: this.roomId,
                sdp: offer.sdp
            });
        } catch (error) {
            console.error('Q-Chat: Error creating offer:', error);
        }
    }

    async handleOffer(msg) {
        try {
            await this.initializeWebRTC();
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription({ type: 'offer', sdp: msg.sdp })
            );
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            this.send({
                type: 'answer',
                roomId: this.roomId,
                sdp: answer.sdp
            });
        } catch (error) {
            console.error('Q-Chat: Error handling offer:', error);
        }
    }

    async handleAnswer(msg) {
        try {
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription({ type: 'answer', sdp: msg.sdp })
            );
        } catch (error) {
            console.error('Q-Chat: Error handling answer:', error);
        }
    }

    async handleIceCandidate(msg) {
        try {
            if (msg.candidate) {
                await this.peerConnection.addIceCandidate(
                    new RTCIceCandidate(msg.candidate)
                );
            }
        } catch (error) {
            console.error('Q-Chat: Error handling ICE candidate:', error);
        }
    }

    showRoomInfo() {
        if (this.connectSection) this.connectSection.style.display = 'none';
        if (this.roomInfoSection) this.roomInfoSection.style.display = 'block';

        // Start the matrix sphere animation sequence
        this.startMatrixSphereAnimation();
    }

    startMatrixSphereAnimation() {
        const sphereContainer = document.getElementById('matrixSphereContainer');
        const sphere = document.getElementById('matrixSphere');
        const statusText = document.getElementById('matrixSphereStatus');
        const roomCodeSection = document.getElementById('qchatRoomCodeSection');
        const waitingText = document.getElementById('qchatWaiting');

        if (!sphere || !sphereContainer) {
            // Fallback: show code immediately if animation elements don't exist
            if (this.roomCodeEl) this.roomCodeEl.textContent = this.roomId;
            return;
        }

        // Create the matrix sphere with random digits
        this.createMatrixSphere(sphere);

        // Status messages sequence
        const statusMessages = [
            'Generating Quantum Tunnel...',
            'Encrypting Neural Pathway...',
            'Establishing Secure Link...',
            'Finalizing Quantum Code...'
        ];

        let statusIndex = 0;
        const statusInterval = setInterval(() => {
            statusIndex++;
            if (statusIndex < statusMessages.length && statusText) {
                statusText.textContent = statusMessages[statusIndex];
            }
        }, 600);

        // After animation, reveal the code
        setTimeout(() => {
            clearInterval(statusInterval);

            // Fade out the sphere
            sphere.classList.add('fade-out');
            if (statusText) statusText.style.display = 'none';

            // After fade out, hide sphere and reveal code
            setTimeout(() => {
                sphereContainer.style.display = 'none';

                // Set and reveal the room code
                if (this.roomCodeEl) this.roomCodeEl.textContent = this.roomId;
                if (roomCodeSection) {
                    roomCodeSection.classList.remove('hidden');
                    roomCodeSection.classList.add('reveal');
                }
                if (waitingText) {
                    waitingText.classList.remove('hidden');
                }
            }, 800);
        }, 2500);
    }

    createMatrixSphere(container) {
        container.innerHTML = '';
        const numDigits = 120;
        const radius = 60;

        for (let i = 0; i < numDigits; i++) {
            const digit = document.createElement('span');
            digit.className = 'matrix-digit';
            digit.textContent = Math.floor(Math.random() * 10);

            // Distribute points on a sphere using golden spiral
            const phi = Math.acos(1 - 2 * (i + 0.5) / numDigits);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;

            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);

            digit.style.transform = `translate3d(${x}px, ${y}px, ${z}px)`;
            digit.style.left = '50%';
            digit.style.top = '50%';
            digit.style.marginLeft = '-7px';
            digit.style.marginTop = '-10px';

            // Random animation delay for flickering effect
            digit.style.animationDelay = `${Math.random() * 0.5}s`;

            // Vary opacity based on z position for depth
            const opacity = 0.4 + (z + radius) / (2 * radius) * 0.6;
            digit.style.opacity = opacity;

            container.appendChild(digit);
        }

        // Randomly change digits periodically
        this.digitChangeInterval = setInterval(() => {
            const digits = container.querySelectorAll('.matrix-digit');
            const randomDigit = digits[Math.floor(Math.random() * digits.length)];
            if (randomDigit) {
                randomDigit.textContent = Math.floor(Math.random() * 10);
            }
        }, 50);

        // Clear interval after animation completes
        setTimeout(() => {
            if (this.digitChangeInterval) {
                clearInterval(this.digitChangeInterval);
            }
        }, 3500);
    }

    showChatUI() {
        if (this.connectSection) this.connectSection.style.display = 'none';
        if (this.roomInfoSection) this.roomInfoSection.style.display = 'none';
        if (this.messagesSection) this.messagesSection.style.display = 'flex';
        if (this.inputSection) this.inputSection.style.display = 'block';
    }

    enableChat() {
        if (this.messageInput) {
            this.messageInput.disabled = false;
            this.messageInput.focus();
        }
        if (this.sendBtn) this.sendBtn.disabled = false;
    }

    disableChat() {
        if (this.messageInput) this.messageInput.disabled = true;
        if (this.sendBtn) this.sendBtn.disabled = true;
    }

    sendMessage() {
        const text = this.messageInput?.value.trim();
        if (!text || !this.isConnected) return;

        const message = {
            type: 'message',
            text: text,
            timestamp: Date.now()
        };

        try {
            this.dataChannel.send(JSON.stringify(message));
            this.addMessage(text, 'sent', message.timestamp);
            this.messageInput.value = '';
        } catch (error) {
            console.error('Q-Chat: Error sending message:', error);
            this.showSystemMessage('Failed to send message');
        }
    }

    receiveMessage(data) {
        if (data.type === 'message') {
            this.addMessage(data.text, 'received', data.timestamp);

            // Update unread count if panel is closed
            if (!this.isPanelOpen) {
                this.unreadCount++;
                this.updateBadge();
            }
        }
    }

    addMessage(text, type, timestamp) {
        const messageEl = document.createElement('div');
        messageEl.className = `qchat-message ${type}`;

        const time = new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageEl.innerHTML = `
            <div class="qchat-message-text">${this.escapeHtml(text)}</div>
            <div class="qchat-message-time">
                ${type === 'sent' ? '✓ ' : ''}${time}
            </div>
        `;

        this.messagesList?.appendChild(messageEl);
        this.scrollToBottom();
    }

    showSystemMessage(text) {
        const messageEl = document.createElement('div');
        messageEl.className = 'qchat-system-message';
        messageEl.textContent = text;
        this.messagesList?.appendChild(messageEl);
        this.scrollToBottom();
    }

    scrollToBottom() {
        if (this.messagesSection) {
            this.messagesSection.scrollTop = this.messagesSection.scrollHeight;
        }
    }

    updateStatus(state, text) {
        if (this.statusEl) {
            this.statusEl.className = `qchat-status ${state}`;
            const textEl = this.statusEl.querySelector('.status-text');
            if (textEl) textEl.textContent = text;
        }
    }

    updateBadge() {
        if (this.badge) {
            if (this.unreadCount > 0) {
                this.badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                this.badge.style.display = 'flex';
            } else {
                this.badge.style.display = 'none';
            }
        }
    }

    clearUnread() {
        this.unreadCount = 0;
        this.updateBadge();
    }

    copyRoomCode() {
        if (this.roomId) {
            navigator.clipboard.writeText(this.roomId).then(() => {
                this.showSystemMessage('Room code copied!');
            }).catch(() => {
                // Fallback
                const textArea = document.createElement('textarea');
                textArea.value = this.roomId;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showSystemMessage('Room code copied!');
            });
        }
    }

    handleDisconnect() {
        this.isConnected = false;
        this.updateStatus('disconnected', 'Disconnected');
        this.disableChat();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize Q-Chat when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.qChat = new QChat();
});
