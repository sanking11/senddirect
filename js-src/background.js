// Animated Liquid Gradient Blobs Background - Original Gray Theme
const canvas = document.getElementById('liquidCanvas');
if (canvas) {
    const ctx = canvas.getContext('2d');

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    // Mouse position for blackhole effect
    let mouseX = width / 2;
    let mouseY = height / 2;

    // Blackhole configuration
    const blackhole = {
        attractionRadius: 500,    // How far the attraction reaches
        pullStrength: 2.5,        // Base pull strength (increased for more visible effect)
        eventHorizonRadius: 100,  // Point where blobs get absorbed
        stretchFactor: 2.0        // How much blobs stretch when pulled
    };

    // Track mouse for blackhole center
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    // Blob configuration
    class Blob {
        constructor() {
            this.spawn();
            this.baseRadius = this.radius;
            this.absorbed = false;
            this.respawnTimer = 0;
        }

        spawn() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.radius = Math.random() * 150 + 100; // Smaller blobs for more visible movement
            this.baseRadius = this.radius;
            this.vx = (Math.random() - 0.5) * 1.0;   // Slightly faster initial movement
            this.vy = (Math.random() - 0.5) * 1.0;
            this.color = this.randomColor();
            this.absorbed = false;
            this.stretch = 1;
            this.stretchAngle = 0;
        }

        randomColor() {
            const colors = [
                { r: 95, g: 109, b: 120, a: 0.6 },   // #5f6d78
                { r: 107, g: 122, b: 135, a: 0.5 },  // #6b7a87
                { r: 83, g: 98, b: 112, a: 0.6 },    // #536270
                { r: 105, g: 120, b: 131, a: 0.5 },  // #697883
                { r: 85, g: 101, b: 113, a: 0.6 }    // #556571
            ];
            return colors[Math.floor(Math.random() * colors.length)];
        }

        update() {
            // If absorbed, wait and respawn
            if (this.absorbed) {
                this.respawnTimer++;
                if (this.respawnTimer > 180) { // Respawn after ~3 seconds
                    this.respawnTimer = 0;
                    // Respawn at edge of screen away from cursor
                    const edge = Math.floor(Math.random() * 4);
                    switch(edge) {
                        case 0: this.x = -this.baseRadius; this.y = Math.random() * height; break;
                        case 1: this.x = width + this.baseRadius; this.y = Math.random() * height; break;
                        case 2: this.x = Math.random() * width; this.y = -this.baseRadius; break;
                        case 3: this.x = Math.random() * width; this.y = height + this.baseRadius; break;
                    }
                    this.radius = this.baseRadius;
                    this.absorbed = false;
                    this.stretch = 1;
                }
                return;
            }

            // Calculate distance to blackhole (cursor)
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Apply gravitational attraction
            if (dist < blackhole.attractionRadius && dist > 0) {
                const normalizedDist = dist / blackhole.attractionRadius;
                // Stronger pull closer to center (inverse square-ish)
                const pullForce = Math.pow(1 - normalizedDist, 2) * blackhole.pullStrength;

                // Direction towards blackhole
                const angle = Math.atan2(dy, dx);
                this.stretchAngle = angle;

                // Apply pull force
                this.vx += Math.cos(angle) * pullForce;
                this.vy += Math.sin(angle) * pullForce;

                // Stretch the blob as it gets pulled (spaghettification effect)
                this.stretch = 1 + (1 - normalizedDist) * blackhole.stretchFactor;

                // Shrink as it approaches event horizon
                if (dist < blackhole.eventHorizonRadius * 2) {
                    const shrinkFactor = dist / (blackhole.eventHorizonRadius * 2);
                    this.radius = this.baseRadius * shrinkFactor * 0.5;
                }
            } else {
                // Gradually return to normal shape when far from blackhole
                this.stretch += (1 - this.stretch) * 0.05;
                this.radius += (this.baseRadius - this.radius) * 0.02;
            }

            // Apply velocity with damping
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= 0.98;
            this.vy *= 0.98;

            // Check if absorbed by blackhole
            if (dist < blackhole.eventHorizonRadius) {
                this.absorbed = true;
                this.radius = 0;
                return;
            }

            // Soft bounce off edges (only when not being pulled strongly)
            if (dist > blackhole.attractionRadius * 0.5) {
                if (this.x < -this.radius / 2 || this.x > width + this.radius / 2) {
                    this.vx *= -0.5;
                }
                if (this.y < -this.radius / 2 || this.y > height + this.radius / 2) {
                    this.vy *= -0.5;
                }
            }

            // Keep within reasonable bounds
            this.x = Math.max(-this.radius, Math.min(width + this.radius, this.x));
            this.y = Math.max(-this.radius, Math.min(height + this.radius, this.y));
        }

        draw() {
            if (this.absorbed || this.radius < 5) return;

            ctx.save();
            ctx.translate(this.x, this.y);

            // Rotate and stretch towards blackhole
            if (this.stretch > 1.05) {
                ctx.rotate(this.stretchAngle);
                ctx.scale(this.stretch, 1 / Math.sqrt(this.stretch));
            }

            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);

            gradient.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.color.a})`);
            gradient.addColorStop(0.5, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.color.a * 0.5})`);
            gradient.addColorStop(1, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0)`);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    // Create blobs
    const blobs = [];
    const blobCount = 12; // More blobs for better blackhole effect visibility

    for (let i = 0; i < blobCount; i++) {
        blobs.push(new Blob());
    }

    // Animation loop
    let time = 0;
    function animate() {
        time += 0.01;

        // Base gradient background - lighter gray-blue
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#5a6672');
        gradient.addColorStop(0.5, '#6a7682');
        gradient.addColorStop(1, '#5a6672');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Apply blur for smooth blending (reduced for more visible blob movement)
        ctx.filter = 'blur(40px)';

        // Update and draw all blobs
        blobs.forEach(blob => {
            blob.update();
            blob.draw();
        });

        ctx.filter = 'none';

        // Add subtle noise overlay for texture
        ctx.fillStyle = `rgba(255, 255, 255, ${0.01 + Math.sin(time) * 0.005})`;
        ctx.fillRect(0, 0, width, height);

        requestAnimationFrame(animate);
    }

    // Handle resize
    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    // Start animation
    animate();
}

// Custom Cursor functionality - Original working version
document.addEventListener('DOMContentLoaded', function() {
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');
    const cursorScanline = document.querySelector('.cursor-scanline');
    const cursorData = document.querySelector('.cursor-data');

    if (cursorDot && cursorOutline) {
        let mouseX = 0;
        let mouseY = 0;
        let outlineX = 0;
        let outlineY = 0;
        let velocity = { x: 0, y: 0 };
        let lastX = 0;
        let lastY = 0;
        let isHovering = false;
        let isScrolling = false;
        let scrollTimeout = null;
        let lastScrollY = window.scrollY;
        let particles = [];
        let zCoord = 0;
        let lastZUpdate = 0;
        const CURSOR_SMOOTHING = 0.25;
        const MAX_PARTICLES = 15;

        // Particle trail system
        function createParticle(x, y) {
            if (particles.length >= MAX_PARTICLES) return;

            const particle = document.createElement('div');
            particle.className = 'cursor-particle';
            particle.style.cssText = `transform: translate(${x}px, ${y}px); opacity: 1;`;
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

        function updateParticles() {
            particles = particles.filter(p => {
                p.life -= 0.05;
                p.x += p.vx;
                p.y += p.vy;
                p.element.style.transform = `translate(${p.x}px, ${p.y}px) scale(${p.life})`;
                p.element.style.opacity = p.life;

                if (p.life <= 0) {
                    p.element.remove();
                    return false;
                }
                return true;
            });
        }

        // Throttled Z-coordinate calculation
        function updateZCoord() {
            const now = performance.now();
            if (now - lastZUpdate < 200) return;
            lastZUpdate = now;

            const elementUnderCursor = document.elementFromPoint(mouseX, mouseY);
            if (elementUnderCursor) {
                let domDepth = 0;
                let el = elementUnderCursor;
                let maxDepth = 10;
                while (el && el !== document.body && maxDepth-- > 0) {
                    domDepth++;
                    el = el.parentElement;
                }
                const scrollFactor = Math.round((window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight)) * 100);
                zCoord = domDepth + scrollFactor;
            }
        }

        // Track mouse position - dot and scanline follow immediately
        let particleCounter = 0;
        document.addEventListener('mousemove', (e) => {
            lastX = mouseX;
            lastY = mouseY;
            mouseX = e.clientX;
            mouseY = e.clientY;

            velocity.x = mouseX - lastX;
            velocity.y = mouseY - lastY;
            const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

            // Dot follows immediately (CSS centers it with transform)
            cursorDot.style.left = mouseX + 'px';
            cursorDot.style.top = mouseY + 'px';

            // Scanline follows immediately (CSS centers it with transform)
            if (cursorScanline) {
                cursorScanline.style.left = mouseX + 'px';
                cursorScanline.style.top = mouseY + 'px';
            }

            // Data readout follows cursor
            if (cursorData && !isHovering) {
                cursorData.style.left = (mouseX + 25) + 'px';
                cursorData.style.top = (mouseY - 20) + 'px';
                updateZCoord();
                const now = new Date();
                const tCoord = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
                cursorData.innerHTML = `X:${Math.round(mouseX).toString().padStart(4, '0')}<br>Y:${Math.round(mouseY).toString().padStart(4, '0')}<br>Z:${zCoord.toString().padStart(4, '0')}<br>T:${tCoord}`;
            }

            // Create particles based on speed
            particleCounter++;
            if (speed > 5 && particleCounter % 3 === 0) {
                createParticle(mouseX, mouseY);
            }
        }, { passive: true });

        // Outline follows with smooth delay
        function animateCursor() {
            outlineX += (mouseX - outlineX) * 0.15;
            outlineY += (mouseY - outlineY) * 0.15;
            cursorOutline.style.left = outlineX + 'px';
            cursorOutline.style.top = outlineY + 'px';

            updateParticles();
            requestAnimationFrame(animateCursor);
        }
        animateCursor();

        // Function to toggle cursor visibility
        function setCursorHidden(hidden) {
            const opacity = hidden ? '0.15' : '1';
            cursorDot.style.opacity = opacity;
            cursorOutline.style.opacity = opacity;
            if (cursorScanline) cursorScanline.style.opacity = hidden ? '0' : '0.8';
            if (cursorData) cursorData.style.opacity = hidden ? '0' : '0.8';
        }

        // Use event delegation for hover detection on interactive elements
        document.addEventListener('mouseover', (e) => {
            const target = e.target;
            const isInteractive = target.closest('a, button, .btn, .nav-link, .feature-card, .step-card, .stat-card, input, textarea, .news-card, .widget, [onclick], [role="button"], .card, .clickable, h1, h2, h3, p, span, label');
            if (isInteractive) {
                isHovering = true;
                setCursorHidden(true);
            }
        });

        document.addEventListener('mouseout', (e) => {
            const target = e.target;
            const isInteractive = target.closest('a, button, .btn, .nav-link, .feature-card, .step-card, .stat-card, input, textarea, .news-card, .widget, [onclick], [role="button"], .card, .clickable, h1, h2, h3, p, span, label');
            if (isInteractive) {
                isHovering = false;
                setCursorHidden(false);
            }
        });

        // Click effect - preserve CSS centering transform
        document.addEventListener('mousedown', () => {
            cursorDot.style.transform = 'translate(-50%, -50%) scale(0.8)';
            cursorOutline.style.transform = 'translate(-50%, -50%) scale(0.8)';
            // Create burst of particles on click
            for (let i = 0; i < 8; i++) {
                setTimeout(() => createParticle(mouseX, mouseY), i * 20);
            }
        });

        document.addEventListener('mouseup', () => {
            cursorDot.style.transform = 'translate(-50%, -50%) scale(1)';
            cursorOutline.style.transform = 'translate(-50%, -50%) scale(1)';
        });

        // Hide cursor when leaving window
        document.addEventListener('mouseleave', () => {
            cursorDot.style.opacity = '0';
            cursorOutline.style.opacity = '0';
            if (cursorScanline) cursorScanline.style.opacity = '0';
            if (cursorData) cursorData.style.opacity = '0';
        });

        document.addEventListener('mouseenter', () => {
            cursorDot.style.opacity = '1';
            cursorOutline.style.opacity = '1';
            if (cursorScanline) cursorScanline.style.opacity = '0.8';
            if (cursorData) cursorData.style.opacity = '0.8';
        });

        // Initialize visibility
        if (cursorScanline) cursorScanline.style.opacity = '0.8';
        if (cursorData) cursorData.style.opacity = '0.8';

        // Scroll trail effects
        let lastTrailTime = 0;
        function createScrollTrail(direction, isHorizontal = false) {
            const now = performance.now();
            if (now - lastTrailTime < 100) return;
            lastTrailTime = now;

            const trail = document.createElement('div');
            let dirClass = 'down';

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
            }
            createScrollTrail(direction, isHorizontal);
        }

        function stopScrollAnimation() {
            isScrolling = false;
        }

        // Listen for scroll events
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

        // Detect wheel events for more responsive feedback
        window.addEventListener('wheel', (e) => {
            const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
            const direction = isHorizontal ? (e.deltaX > 0 ? 1 : -1) : (e.deltaY > 0 ? 1 : -1);
            startScrollAnimation(direction, isHorizontal);

            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                stopScrollAnimation();
            }, 150);
        }, { passive: true });
    }
});
