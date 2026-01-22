// Blackhole Gravitational Lensing Effect
// Draws a distorted grid that warps around the mouse cursor
// With wave animation and RGB glitch effects

(function() {
    'use strict';

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let targetMouseX = mouseX;
    let targetMouseY = mouseY;
    let gridCanvas = null;
    let gridCtx = null;
    let glowCanvas = null;
    let glowCtx = null;
    let animationId = null;
    let isEnabled = true;
    let time = 0;
    let glitchActive = false;
    let glitchEndTime = 0;

    const config = {
        gridSize: 50,
        gridColor: 'rgba(74, 222, 128, 0.14)',
        distortionRadius: 150,
        distortionStrength: 40,
        blackholeRadius: 15,
        glowRadius: 60,
        eventHorizonRadius: 25,
        waveAmplitude: 1.2,
        waveFrequency: 0.015,
        waveSpeed: 0.8,
        glitchInterval: 10000,
        glitchDuration: 250
    };

    function init() {
        // Hide the CSS grid overlay since we're replacing it with canvas
        const cssGridOverlay = document.querySelector('.grid-overlay');
        if (cssGridOverlay) {
            cssGridOverlay.style.display = 'none';
        }

        // Create canvas for distorted grid
        createGridCanvas();

        // Create canvas for the glow effect
        createGlowCanvas();

        // Event listeners
        document.addEventListener('mousemove', onMouseMove);
        window.addEventListener('resize', onResize);

        // Start glitch timer
        scheduleGlitch();

        // Start animation
        animate();

        console.log('Blackhole gravitational lensing initialized');
    }

    function createGridCanvas() {
        gridCanvas = document.createElement('canvas');
        gridCanvas.id = 'blackhole-grid-canvas';
        gridCanvas.width = window.innerWidth;
        gridCanvas.height = window.innerHeight;
        gridCanvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
            pointer-events: none;
        `;

        document.body.appendChild(gridCanvas);
        gridCtx = gridCanvas.getContext('2d');
    }

    function createGlowCanvas() {
        glowCanvas = document.createElement('canvas');
        glowCanvas.id = 'blackhole-canvas';
        glowCanvas.width = window.innerWidth;
        glowCanvas.height = window.innerHeight;
        glowCanvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 99997;
            pointer-events: none;
        `;

        document.body.appendChild(glowCanvas);
        glowCtx = glowCanvas.getContext('2d');
    }

    function onMouseMove(e) {
        targetMouseX = e.clientX;
        targetMouseY = e.clientY;
    }

    function onResize() {
        if (gridCanvas) {
            gridCanvas.width = window.innerWidth;
            gridCanvas.height = window.innerHeight;
        }
        if (glowCanvas) {
            glowCanvas.width = window.innerWidth;
            glowCanvas.height = window.innerHeight;
        }
    }

    function scheduleGlitch() {
        const randomDelay = config.glitchInterval + (Math.random() - 0.5) * 4000;
        setTimeout(() => {
            if (isEnabled) {
                triggerGlitch();
                scheduleGlitch();
            }
        }, randomDelay);
    }

    function triggerGlitch() {
        glitchActive = true;
        glitchEndTime = Date.now() + config.glitchDuration;
    }

    // Apply wave distortion to a point
    function applyWave(x, y) {
        const waveX = Math.sin(y * config.waveFrequency + time * config.waveSpeed) * config.waveAmplitude;
        const waveY = Math.sin(x * config.waveFrequency + time * config.waveSpeed * 0.7) * config.waveAmplitude;
        return { x: x + waveX, y: y + waveY };
    }

    // Apply gravitational distortion to a point
    function distortPoint(x, y) {
        // First apply wave effect
        const waved = applyWave(x, y);
        x = waved.x;
        y = waved.y;

        const dx = x - mouseX;
        const dy = y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < config.distortionRadius && dist > config.eventHorizonRadius) {
            // Gravitational lensing formula - points get pulled toward the center
            const normalizedDist = dist / config.distortionRadius;
            // Stronger pull closer to center, using inverse square-ish falloff
            const pullStrength = Math.pow(1 - normalizedDist, 2) * config.distortionStrength;

            // Calculate pull direction (toward center)
            const angle = Math.atan2(dy, dx);

            // Apply distortion - pull points toward the blackhole
            const newX = x - Math.cos(angle) * pullStrength;
            const newY = y - Math.sin(angle) * pullStrength;

            return { x: newX, y: newY, distorted: true };
        } else if (dist <= config.eventHorizonRadius) {
            // Points inside event horizon get pulled to center
            return { x: mouseX, y: mouseY, distorted: true, hidden: true };
        }

        return { x, y, distorted: false };
    }

    function getGlitchColor(baseColor, offset) {
        if (!glitchActive) return baseColor;

        const glitchProgress = (glitchEndTime - Date.now()) / config.glitchDuration;
        if (glitchProgress <= 0) {
            glitchActive = false;
            return baseColor;
        }

        // RGB split colors - more visible
        if (offset === 'red') {
            return `rgba(255, 0, 0, ${0.08 + glitchProgress * 0.08})`;
        } else if (offset === 'cyan') {
            return `rgba(0, 255, 255, ${0.08 + glitchProgress * 0.08})`;
        }
        return baseColor;
    }

    function getGlitchOffset() {
        if (!glitchActive) return { x: 0, y: 0 };

        const glitchProgress = (glitchEndTime - Date.now()) / config.glitchDuration;
        if (glitchProgress <= 0) return { x: 0, y: 0 };

        // More visible jitter
        const intensity = glitchProgress * 2.5;
        return {
            x: (Math.random() - 0.5) * intensity,
            y: (Math.random() - 0.5) * intensity
        };
    }

    function drawGridLines(offsetX, offsetY, color) {
        const gridSize = config.gridSize;
        const width = gridCanvas.width;
        const height = gridCanvas.height;

        gridCtx.strokeStyle = color;
        gridCtx.lineWidth = 1;

        // Draw vertical lines with distortion
        for (let x = 0; x <= width + gridSize; x += gridSize) {
            gridCtx.beginPath();
            let lastHidden = false;

            for (let y = 0; y <= height; y += 5) {
                const distorted = distortPoint(x, y);

                if (distorted.hidden) {
                    lastHidden = true;
                    continue;
                }

                const finalX = distorted.x + offsetX;
                const finalY = distorted.y + offsetY;

                if (y === 0 || lastHidden) {
                    gridCtx.moveTo(finalX, finalY);
                    lastHidden = false;
                } else {
                    gridCtx.lineTo(finalX, finalY);
                }
            }

            gridCtx.stroke();
        }

        // Draw horizontal lines with distortion
        for (let y = 0; y <= height + gridSize; y += gridSize) {
            gridCtx.beginPath();
            let lastHidden = false;

            for (let x = 0; x <= width; x += 5) {
                const distorted = distortPoint(x, y);

                if (distorted.hidden) {
                    lastHidden = true;
                    continue;
                }

                const finalX = distorted.x + offsetX;
                const finalY = distorted.y + offsetY;

                if (x === 0 || lastHidden) {
                    gridCtx.moveTo(finalX, finalY);
                    lastHidden = false;
                } else {
                    gridCtx.lineTo(finalX, finalY);
                }
            }

            gridCtx.stroke();
        }
    }

    function drawDistortedGrid() {
        gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

        const glitchOffset = getGlitchOffset();

        // Draw RGB split layers during glitch - more visible offset
        if (glitchActive) {
            // Red layer (offset left)
            drawGridLines(-2 + glitchOffset.x, glitchOffset.y, getGlitchColor(config.gridColor, 'red'));

            // Cyan layer (offset right)
            drawGridLines(2 + glitchOffset.x, glitchOffset.y, getGlitchColor(config.gridColor, 'cyan'));
        }

        // Main green grid layer
        drawGridLines(glitchOffset.x, glitchOffset.y, config.gridColor);

        // Draw subtle radial glow around distortion area
        const radialGradient = gridCtx.createRadialGradient(
            mouseX, mouseY, config.eventHorizonRadius,
            mouseX, mouseY, config.distortionRadius
        );
        radialGradient.addColorStop(0, 'rgba(74, 222, 128, 0.04)');
        radialGradient.addColorStop(0.5, 'rgba(74, 222, 128, 0.015)');
        radialGradient.addColorStop(1, 'rgba(74, 222, 128, 0)');

        gridCtx.fillStyle = radialGradient;
        gridCtx.beginPath();
        gridCtx.arc(mouseX, mouseY, config.distortionRadius, 0, Math.PI * 2);
        gridCtx.fill();

        // Add visible scanline effect during glitch
        if (glitchActive) {
            const glitchProgress = (glitchEndTime - Date.now()) / config.glitchDuration;
            if (glitchProgress > 0) {
                gridCtx.fillStyle = `rgba(74, 222, 128, ${0.025 * glitchProgress})`;
                for (let y = 0; y < gridCanvas.height; y += 4) {
                    gridCtx.fillRect(0, y, gridCanvas.width, 1);
                }
            }
        }
    }

    function drawGlow() {
        glowCtx.clearRect(0, 0, glowCanvas.width, glowCanvas.height);

        const animTime = Date.now() * 0.002;

        // Photon sphere ring (bright ring where light orbits)
        const photonRadius = config.blackholeRadius + 5;
        const photonGradient = glowCtx.createRadialGradient(
            mouseX, mouseY, config.blackholeRadius - 2,
            mouseX, mouseY, photonRadius + 10
        );
        photonGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        photonGradient.addColorStop(0.3, 'rgba(74, 222, 128, 0.9)');
        photonGradient.addColorStop(0.5, 'rgba(74, 222, 128, 0.5)');
        photonGradient.addColorStop(0.7, 'rgba(74, 222, 128, 0.2)');
        photonGradient.addColorStop(1, 'rgba(74, 222, 128, 0)');

        glowCtx.beginPath();
        glowCtx.arc(mouseX, mouseY, photonRadius + 10, 0, Math.PI * 2);
        glowCtx.fillStyle = photonGradient;
        glowCtx.fill();

        // Event horizon (pure black center)
        glowCtx.beginPath();
        glowCtx.arc(mouseX, mouseY, config.blackholeRadius, 0, Math.PI * 2);
        glowCtx.fillStyle = 'rgba(0, 0, 0, 0.98)';
        glowCtx.fill();

        // Accretion disk - spinning particles
        glowCtx.save();
        for (let i = 0; i < 30; i++) {
            const particleAngle = (i / 30) * Math.PI * 2 + animTime * 2;
            const wobble = Math.sin(animTime * 3 + i * 0.5) * 2;
            const particleRadius = config.blackholeRadius + 8 + wobble;

            const px = mouseX + Math.cos(particleAngle) * particleRadius;
            const py = mouseY + Math.sin(particleAngle) * particleRadius;

            const brightness = 0.4 + Math.sin(animTime * 5 + i) * 0.3;
            const size = 1.5 + Math.random() * 1;

            glowCtx.beginPath();
            glowCtx.arc(px, py, size, 0, Math.PI * 2);
            glowCtx.fillStyle = `rgba(74, 222, 128, ${brightness})`;
            glowCtx.fill();
        }
        glowCtx.restore();

        // Outer glow/corona
        const outerGradient = glowCtx.createRadialGradient(
            mouseX, mouseY, config.blackholeRadius + 15,
            mouseX, mouseY, config.glowRadius
        );
        outerGradient.addColorStop(0, 'rgba(74, 222, 128, 0.15)');
        outerGradient.addColorStop(0.5, 'rgba(74, 222, 128, 0.05)');
        outerGradient.addColorStop(1, 'rgba(74, 222, 128, 0)');

        glowCtx.beginPath();
        glowCtx.arc(mouseX, mouseY, config.glowRadius, 0, Math.PI * 2);
        glowCtx.fillStyle = outerGradient;
        glowCtx.fill();

        // Visible RGB glitch on glow during glitch
        if (glitchActive) {
            const glitchProgress = (glitchEndTime - Date.now()) / config.glitchDuration;
            if (glitchProgress > 0) {
                // Red ring offset - more visible
                glowCtx.strokeStyle = `rgba(255, 0, 0, ${0.25 * glitchProgress})`;
                glowCtx.lineWidth = 1.5;
                glowCtx.beginPath();
                glowCtx.arc(mouseX - 2, mouseY, config.blackholeRadius + 5, 0, Math.PI * 2);
                glowCtx.stroke();

                // Cyan ring offset - more visible
                glowCtx.strokeStyle = `rgba(0, 255, 255, ${0.25 * glitchProgress})`;
                glowCtx.beginPath();
                glowCtx.arc(mouseX + 2, mouseY, config.blackholeRadius + 5, 0, Math.PI * 2);
                glowCtx.stroke();
            }
        }
    }

    function animate() {
        if (!isEnabled) return;

        animationId = requestAnimationFrame(animate);

        // Update time for wave animation
        time += 0.016; // Approximately 60fps

        // Smooth mouse following
        mouseX += (targetMouseX - mouseX) * 0.15;
        mouseY += (targetMouseY - mouseY) * 0.15;

        // Draw distorted grid
        drawDistortedGrid();

        // Draw glow effect
        drawGlow();
    }

    // Public API
    window.BlackholeEffect = {
        enable: function() {
            isEnabled = true;
            const cssGridOverlay = document.querySelector('.grid-overlay');
            if (cssGridOverlay) cssGridOverlay.style.display = 'none';
            if (gridCanvas) gridCanvas.style.display = 'block';
            if (glowCanvas) glowCanvas.style.display = 'block';
            animate();
        },
        disable: function() {
            isEnabled = false;
            const cssGridOverlay = document.querySelector('.grid-overlay');
            if (cssGridOverlay) cssGridOverlay.style.display = 'block';
            if (gridCanvas) gridCanvas.style.display = 'none';
            if (glowCanvas) glowCanvas.style.display = 'none';
            if (animationId) cancelAnimationFrame(animationId);
        },
        isEnabled: function() { return isEnabled; },
        triggerGlitch: triggerGlitch,
        setStrength: function(strength) {
            config.distortionStrength = strength;
        },
        setRadius: function(radius) {
            config.distortionRadius = radius;
        },
        setWaveAmplitude: function(amplitude) {
            config.waveAmplitude = amplitude;
        }
    };

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
