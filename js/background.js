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

// Custom Cursor functionality
document.addEventListener('DOMContentLoaded', function() {
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
        let mouseX = 0;
        let mouseY = 0;
        let outlineX = 0;
        let outlineY = 0;
        let bracketsX = 0;
        let bracketsY = 0;
        let velocity = { x: 0, y: 0 };
        let lastX = 0;
        let lastY = 0;
        let particles = [];
        let isHovering = false;
        let isScrolling = false;
        let scrollTimeout = null;
        let lastScrollY = window.scrollY;
        let scrollDirection = 0; // -1 up, 1 down, 0 none

        // Particle trail system
        function createParticle(x, y) {
            const particle = document.createElement('div');
            particle.className = 'cursor-particle';
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';
            particle.style.opacity = '1';
            document.body.appendChild(particle);

            // Random offset for organic feel
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

            // Dot follows instantly
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

            // Create particles based on speed (only when moving fast enough)
            particleCounter++;
            if (speed > 5 && particleCounter % 3 === 0) {
                createParticle(mouseX, mouseY);
            }
        });

        // Smooth outline and brackets following
        function animateCursor() {
            // Outline follows with easing
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

            // Update particles
            updateParticles();

            requestAnimationFrame(animateCursor);
        }
        animateCursor();

        // Hover effect on interactive elements
        const interactiveElements = document.querySelectorAll('a, button, .btn, .nav-link, .feature-card, .step-card, .stat-card, input, textarea');

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
                void cursorGlitch.offsetWidth; // Force reflow
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

        // Hide cursor when leaving window
        document.addEventListener('mouseleave', () => {
            cursorDot.style.opacity = '0';
            cursorOutline.style.opacity = '0';
            if (cursorScanline) cursorScanline.style.opacity = '0';
            if (cursorBrackets) cursorBrackets.style.opacity = '0';
            if (cursorData) cursorData.style.opacity = '0';
        });

        document.addEventListener('mouseenter', () => {
            cursorDot.style.opacity = '1';
            cursorOutline.style.opacity = '1';
            if (cursorScanline) cursorScanline.style.opacity = '0.5';
            if (cursorData) cursorData.style.opacity = '0.8';
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

            // Show appropriate direction indicator
            if (scrollIndicatorUp && scrollIndicatorDown) {
                if (direction < 0) {
                    scrollIndicatorUp.classList.add('active');
                    scrollIndicatorDown.classList.remove('active');
                } else {
                    scrollIndicatorDown.classList.add('active');
                    scrollIndicatorUp.classList.remove('active');
                }
            }

            // Create scroll trail
            createScrollTrail(direction, isHorizontal);

            // Trigger scroll ring effect
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

        // Listen for scroll events
        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            const direction = currentScrollY > lastScrollY ? 1 : -1;
            lastScrollY = currentScrollY;

            startScrollAnimation(direction);

            // Clear previous timeout
            if (scrollTimeout) clearTimeout(scrollTimeout);

            // Stop animation after scrolling stops
            scrollTimeout = setTimeout(() => {
                stopScrollAnimation();
            }, 150);
        }, { passive: true });

        // Also detect wheel events for more responsive feedback
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
