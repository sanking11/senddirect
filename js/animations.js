// Futuristic Animations and Effects

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
            this.speedX = (Math.random() - 0.5) * 0.5;
            this.speedY = (Math.random() - 0.5) * 0.5;
            this.opacity = Math.random() * 0.5 + 0.1;
            this.pulseSpeed = Math.random() * 0.02 + 0.01;
            this.pulseOffset = Math.random() * Math.PI * 2;
        }

        update(time) {
            this.x += this.speedX;
            this.y += this.speedY;

            // Pulse opacity
            this.currentOpacity = this.opacity + Math.sin(time * this.pulseSpeed + this.pulseOffset) * 0.2;

            // Wrap around edges
            if (this.x < 0) this.x = width;
            if (this.x > width) this.x = 0;
            if (this.y < 0) this.y = height;
            if (this.y > height) this.y = 0;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, this.currentOpacity)})`;
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

                if (distance < 120) {
                    const opacity = (1 - distance / 120) * 0.12;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
                    ctx.lineWidth = 0.5;
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
