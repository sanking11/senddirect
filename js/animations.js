// Futuristic Animations and Effects

// Quantum Loading Screen
class QuantumLoader {
    constructor() {
        this.loader = document.getElementById('quantumLoader');
        this.progressBar = document.getElementById('loaderProgress');
        this.progressPercent = document.getElementById('loaderPercent');
        this.steps = document.querySelectorAll('.loading-steps .step');
        this.wormholeCanvas = document.getElementById('wormholeCanvas');

        this.loadingSteps = [
            { percent: 5, delay: 800 },
            { percent: 12, delay: 900 },
            { percent: 20, delay: 1000 },
            { percent: 28, delay: 900 },
            { percent: 36, delay: 1100 },
            { percent: 48, delay: 1000 },
            { percent: 60, delay: 1200 },
            { percent: 72, delay: 1000 },
            { percent: 84, delay: 1100 },
            { percent: 95, delay: 900 },
            { percent: 100, delay: 800 }
        ];

        if (this.loader) {
            this.init();
        }
    }

    init() {
        this.initWormholeAnimation();
        this.startLoadingSequence();
    }

    initWormholeAnimation() {
        if (!this.wormholeCanvas) return;

        const ctx = this.wormholeCanvas.getContext('2d');
        const resize = () => {
            this.wormholeCanvas.width = window.innerWidth;
            this.wormholeCanvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        const centerX = () => this.wormholeCanvas.width / 2;
        const centerY = () => this.wormholeCanvas.height / 2;

        const particles = [];
        const numParticles = 150;

        // Create particles
        for (let i = 0; i < numParticles; i++) {
            particles.push({
                angle: Math.random() * Math.PI * 2,
                radius: Math.random() * 300 + 50,
                speed: Math.random() * 0.02 + 0.01,
                size: Math.random() * 2 + 1,
                opacity: Math.random() * 0.5 + 0.3,
                color: Math.random() > 0.5 ? '#4ade80' : (Math.random() > 0.5 ? '#60a5fa' : '#a855f7')
            });
        }

        let time = 0;
        const animate = () => {
            if (!this.loader || this.loader.classList.contains('hidden')) return;

            ctx.fillStyle = 'rgba(10, 10, 15, 0.1)';
            ctx.fillRect(0, 0, this.wormholeCanvas.width, this.wormholeCanvas.height);

            time += 0.01;

            // Draw wormhole rings
            for (let i = 0; i < 8; i++) {
                const ringRadius = 50 + i * 40 + Math.sin(time * 2 + i) * 10;
                const opacity = 0.1 - i * 0.01;

                ctx.beginPath();
                ctx.arc(centerX(), centerY(), ringRadius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(74, 222, 128, ${opacity})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // Draw and update particles (tunnel effect)
            particles.forEach(p => {
                p.angle += p.speed;
                p.radius -= 0.5;

                if (p.radius < 10) {
                    p.radius = 300 + Math.random() * 100;
                    p.angle = Math.random() * Math.PI * 2;
                }

                const x = centerX() + Math.cos(p.angle) * p.radius;
                const y = centerY() + Math.sin(p.angle) * p.radius * 0.6;

                const distanceRatio = p.radius / 300;
                const size = p.size * (1 - distanceRatio * 0.5);

                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fillStyle = p.color.replace(')', `, ${p.opacity * distanceRatio})`).replace('rgb', 'rgba').replace('#', '');

                // Convert hex to rgba
                const hex = p.color;
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.opacity * distanceRatio})`;
                ctx.fill();

                // Draw trail
                ctx.beginPath();
                ctx.moveTo(x, y);
                const trailX = centerX() + Math.cos(p.angle - p.speed * 10) * (p.radius + 20);
                const trailY = centerY() + Math.sin(p.angle - p.speed * 10) * (p.radius + 20) * 0.6;
                ctx.lineTo(trailX, trailY);
                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${p.opacity * distanceRatio * 0.3})`;
                ctx.lineWidth = size * 0.5;
                ctx.stroke();
            });

            // Draw center glow
            const gradient = ctx.createRadialGradient(centerX(), centerY(), 0, centerX(), centerY(), 100);
            gradient.addColorStop(0, 'rgba(74, 222, 128, 0.3)');
            gradient.addColorStop(0.5, 'rgba(96, 165, 250, 0.1)');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, this.wormholeCanvas.width, this.wormholeCanvas.height);

            requestAnimationFrame(animate);
        };

        animate();
    }

    async startLoadingSequence() {
        for (let i = 0; i < this.loadingSteps.length; i++) {
            await this.delay(this.loadingSteps[i].delay);
            this.updateProgress(this.loadingSteps[i].percent, i);
        }

        // Final delay before hiding
        await this.delay(1500);
        this.hideLoader();
    }

    updateProgress(percent, stepIndex) {
        // Update progress bar
        if (this.progressBar) {
            this.progressBar.style.width = `${percent}%`;
        }

        // Update percent text
        if (this.progressPercent) {
            this.progressPercent.textContent = `${percent}%`;
        }

        // Update steps
        this.steps.forEach((step, index) => {
            if (index < stepIndex) {
                step.classList.remove('active');
                step.classList.add('completed');
            } else if (index === stepIndex) {
                step.classList.add('active');
                step.classList.remove('completed');
            } else {
                step.classList.remove('active', 'completed');
            }
        });

        // Add glitch effect randomly
        if (Math.random() > 0.7) {
            this.triggerGlitch();
        }
    }

    triggerGlitch() {
        const glitchOverlay = document.querySelector('.loader-glitch-overlay');
        if (glitchOverlay) {
            glitchOverlay.style.opacity = '1';
            setTimeout(() => {
                glitchOverlay.style.opacity = '0';
            }, 50);
        }
    }

    hideLoader() {
        if (this.loader) {
            this.loader.classList.add('hidden');
            // Remove from DOM after animation
            setTimeout(() => {
                this.loader.style.display = 'none';
            }, 800);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize loader immediately
const quantumLoader = new QuantumLoader();

// Scroll Reveal Animation
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.animation = 'fadeInUp 0.8s ease-out forwards';
        }
    });
}, observerOptions);

// Observe news cards on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all futuristic features
    initSystemTime();
    initParticleCanvas();
    initCardObserver();
    initButtonEffects();
    initStatusIndicators();
    initMouseParallax();
    initFeatureCardMouseTracking();
    initTypingEffect();
    initWidgetScrollCollapse();
});

// System Time Display
function initSystemTime() {
    const timeDisplay = document.getElementById('systemTime');
    if (!timeDisplay) return;

    function updateTime() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        timeDisplay.textContent = `${hours}:${minutes}:${seconds}`;
    }

    updateTime();
    setInterval(updateTime, 1000);
}

// Card Observer for Scroll Animations
function initCardObserver() {
    const cards = document.querySelectorAll('.news-card, .featured-card, .large-feature, .widget');

    const cardObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '0';
                entry.target.style.transform = 'translateY(30px)';

                setTimeout(() => {
                    entry.target.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 100);

                cardObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    cards.forEach(card => cardObserver.observe(card));
}

// Floating Particle System
function initParticleCanvas() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    class Particle {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 2 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.6;
            this.speedY = (Math.random() - 0.5) * 0.6;
            this.opacity = Math.random() * 0.6 + 0.3;
            this.pulseSpeed = Math.random() * 0.02 + 0.01;
            this.pulseOffset = Math.random() * Math.PI * 2;
            // Some particles are green, some are white
            this.isGreen = Math.random() > 0.5;
        }

        update(time) {
            this.x += this.speedX;
            this.y += this.speedY;

            // Pulse opacity
            this.currentOpacity = this.opacity + Math.sin(time * this.pulseSpeed + this.pulseOffset) * 0.25;

            // Wrap around edges
            if (this.x < 0) this.x = width;
            if (this.x > width) this.x = 0;
            if (this.y < 0) this.y = height;
            if (this.y > height) this.y = 0;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            if (this.isGreen) {
                ctx.fillStyle = `rgba(74, 222, 128, ${Math.max(0, this.currentOpacity)})`;
            } else {
                ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, this.currentOpacity)})`;
            }
            ctx.fill();
        }
    }

    // Create particles
    const particleCount = Math.min(80, Math.floor((width * height) / 20000));
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    // Connection lines between nearby particles
    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 150) {
                    const opacity = (1 - distance / 150) * 0.25;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    // Green connection lines
                    ctx.strokeStyle = `rgba(74, 222, 128, ${opacity})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }
    }

    // Animation loop
    let time = 0;
    function animate() {
        time += 0.016;
        ctx.clearRect(0, 0, width, height);

        particles.forEach(particle => {
            particle.update(time);
            particle.draw();
        });

        drawConnections();
        requestAnimationFrame(animate);
    }

    animate();

    // Handle resize
    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });
}

// Button Effects (Ripple)
function initButtonEffects() {
    const buttons = document.querySelectorAll('.action-btn, .nav-link, .search-btn, .refresh-btn');

    buttons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            createRipple(this, e);
        });
    });
}

function createRipple(element, event) {
    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';

    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event ? event.clientX - rect.left - size / 2 : rect.width / 2 - size / 2;
    const y = event ? event.clientY - rect.top - size / 2 : rect.height / 2 - size / 2;

    ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: rippleEffect 0.6s ease-out forwards;
        pointer-events: none;
    `;

    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
}

// Status Indicators Animation
function initStatusIndicators() {
    const apiStatusDot = document.querySelectorAll('.status-dot')[1];
    if (!apiStatusDot) return;

    // Simulate API connection after a delay
    setTimeout(() => {
        apiStatusDot.classList.add('active');
    }, 2000);
}

// Mouse Parallax Effect
function initMouseParallax() {
    const cornerDecorations = document.querySelectorAll('.corner-decoration');

    document.addEventListener('mousemove', (e) => {
        const x = (e.clientX - window.innerWidth / 2) / 100;
        const y = (e.clientY - window.innerHeight / 2) / 100;

        cornerDecorations.forEach(decoration => {
            decoration.style.transform = `translate(${x}px, ${y}px)`;
        });
    });
}

// Add required keyframes to stylesheet
const animationStyles = document.createElement('style');
animationStyles.textContent = `
    @keyframes rippleEffect {
        to {
            transform: scale(2.5);
            opacity: 0;
        }
    }

    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @keyframes dataStream {
        0% {
            transform: translateY(-100%);
            opacity: 0;
        }
        10% {
            opacity: 1;
        }
        90% {
            opacity: 1;
        }
        100% {
            transform: translateY(100vh);
            opacity: 0;
        }
    }

    @keyframes glowPulse {
        0%, 100% {
            box-shadow: 0 0 5px rgba(255, 255, 255, 0.2);
        }
        50% {
            box-shadow: 0 0 20px rgba(255, 255, 255, 0.4);
        }
    }
`;
document.head.appendChild(animationStyles);

// Smooth scroll for navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;

        const target = document.querySelector(targetId);
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Dynamic card scan effect on hover
document.addEventListener('mouseover', (e) => {
    const card = e.target.closest('.news-card');
    if (card) {
        const scanEffect = card.querySelector('.card-scan-effect');
        if (scanEffect) {
            scanEffect.style.animation = 'none';
            scanEffect.offsetHeight; // Trigger reflow
            scanEffect.style.animation = 'cardScan 0.8s ease-out';
        }
    }
});

// Intersection observer for widgets with stagger effect
const widgetObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            setTimeout(() => {
                entry.target.classList.add('visible');
            }, index * 150);
            widgetObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.2 });

document.querySelectorAll('.widget').forEach(widget => {
    widget.style.opacity = '0';
    widget.style.transform = 'translateX(30px)';
    widgetObserver.observe(widget);
});

// Add visible class styles
const visibleStyles = document.createElement('style');
visibleStyles.textContent = `
    .widget.visible {
        opacity: 1 !important;
        transform: translateX(0) !important;
        transition: opacity 0.5s ease, transform 0.5s ease;
    }
`;
document.head.appendChild(visibleStyles);

// Feature Card Mouse Tracking for Radial Glow
function initFeatureCardMouseTracking() {
    const featureCards = document.querySelectorAll('.feature-card');

    featureCards.forEach(card => {
        const mouseGlow = card.querySelector('.mouse-glow');
        if (!mouseGlow) return;

        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            mouseGlow.style.setProperty('--mouse-x', `${x}%`);
            mouseGlow.style.setProperty('--mouse-y', `${y}%`);
        });
    });
}

// Typing Effect for Hero Subtitle
function initTypingEffect() {
    const subtitle = document.querySelector('.hero-subtitle');
    if (!subtitle) return;

    // Store original text
    const originalText = subtitle.textContent;
    const words = originalText.split(' ');

    // Add typing cursor class temporarily
    subtitle.innerHTML = '';
    subtitle.classList.add('typing-cursor');

    let wordIndex = 0;

    function typeWord() {
        if (wordIndex < words.length) {
            subtitle.textContent += (wordIndex > 0 ? ' ' : '') + words[wordIndex];
            wordIndex++;
            setTimeout(typeWord, 50 + Math.random() * 50);
        } else {
            // Remove cursor after typing complete
            setTimeout(() => {
                subtitle.classList.remove('typing-cursor');
            }, 1000);
        }
    }

    // Start typing after a short delay
    setTimeout(typeWord, 500);
}

// Enhanced hover effects for all liquid-glass elements
document.addEventListener('mouseenter', (e) => {
    if (!e.target || typeof e.target.closest !== 'function') return;
    const glassElement = e.target.closest('.liquid-glass');
    if (glassElement && !glassElement.classList.contains('header')) {
        // Trigger the holographic shimmer
        const beforePseudo = glassElement;
        beforePseudo.style.setProperty('--shimmer-active', '1');
    }
}, true);

// Add hexagonal grid hover effect
const hexGridStyle = document.createElement('style');
hexGridStyle.textContent = `
    .liquid-glass:hover .hex-pattern {
        opacity: 0.8;
    }
`;
document.head.appendChild(hexGridStyle);

// Widget Scroll Collapse - collapses widgets when scrolling down, expands when scrolling up
function initWidgetScrollCollapse() {
    const dashboardWidgets = document.querySelector('.dashboard-widgets');
    const dropZone = document.getElementById('dropZone');
    if (!dashboardWidgets) return;

    let isCollapsed = false;
    let initialHeight = 0;

    // Wait for layout to complete before measuring
    setTimeout(() => {
        initialHeight = dashboardWidgets.offsetHeight;
        if (initialHeight > 0) {
            dashboardWidgets.style.maxHeight = initialHeight + 'px';
        }
    }, 100);

    function collapseWidgets() {
        if (isCollapsed) return;
        isCollapsed = true;
        dashboardWidgets.style.maxHeight = '0px';
        dashboardWidgets.style.opacity = '0';
        dashboardWidgets.style.paddingTop = '0';
        dashboardWidgets.style.paddingBottom = '0';
        dashboardWidgets.style.marginBottom = '0';
        dashboardWidgets.style.pointerEvents = 'none';

        // Add top padding to hero section so dropzone doesn't go too high
        const heroSection = document.querySelector('.hero-section');
        if (heroSection) {
            heroSection.style.paddingTop = '3rem';
        }

        if (dropZone) {
            dropZone.classList.add('focus-mode');
        }

        // Scroll to top so dropzone title stays visible below header
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function expandWidgets() {
        if (!isCollapsed) return;
        isCollapsed = false;
        // Re-measure height if needed
        if (initialHeight === 0) {
            initialHeight = dashboardWidgets.scrollHeight || 200;
        }
        dashboardWidgets.style.maxHeight = initialHeight + 'px';
        dashboardWidgets.style.opacity = '1';
        dashboardWidgets.style.paddingTop = '';
        dashboardWidgets.style.paddingBottom = '';
        dashboardWidgets.style.marginBottom = '';
        dashboardWidgets.style.pointerEvents = '';

        // Remove top padding from hero section
        const heroSection = document.querySelector('.hero-section');
        if (heroSection) {
            heroSection.style.paddingTop = '';
        }

        if (dropZone) {
            dropZone.classList.remove('focus-mode');
        }
    }

    // Use wheel event - collapse on ANY scroll down, expand on scroll up when at top
    window.addEventListener('wheel', (e) => {
        if (e.deltaY > 0) {
            // Scrolling down - collapse immediately
            collapseWidgets();
        } else if (e.deltaY < 0 && window.scrollY <= 10) {
            // Scrolling up and at/near top - expand
            expandWidgets();
        }
    }, { passive: true });

    // Also handle touch devices
    let touchStartY = 0;
    window.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        const touchY = e.touches[0].clientY;
        const delta = touchStartY - touchY;

        if (delta > 10) {
            // Swiping up (scrolling down) - collapse
            collapseWidgets();
        } else if (delta < -10 && window.scrollY <= 10) {
            // Swiping down (scrolling up) at top - expand
            expandWidgets();
        }
    }, { passive: true });
}
