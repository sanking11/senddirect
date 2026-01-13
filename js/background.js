// Animated Liquid Gradient Blobs Background - Original Gray Theme
const canvas = document.getElementById('liquidCanvas');
if (canvas) {
    const ctx = canvas.getContext('2d');

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    // Blob configuration
    class Blob {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.radius = Math.random() * 300 + 200;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.color = this.randomColor();
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
            this.x += this.vx;
            this.y += this.vy;

            // Bounce off edges
            if (this.x < -this.radius / 2 || this.x > width + this.radius / 2) {
                this.vx *= -1;
            }
            if (this.y < -this.radius / 2 || this.y > height + this.radius / 2) {
                this.vy *= -1;
            }

            // Keep within bounds
            this.x = Math.max(-this.radius / 2, Math.min(width + this.radius / 2, this.x));
            this.y = Math.max(-this.radius / 2, Math.min(height + this.radius / 2, this.y));
        }

        draw() {
            const gradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, this.radius
            );

            gradient.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.color.a})`);
            gradient.addColorStop(0.5, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.color.a * 0.5})`);
            gradient.addColorStop(1, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0)`);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Create blobs
    const blobs = [];
    const blobCount = 6;

    for (let i = 0; i < blobCount; i++) {
        blobs.push(new Blob());
    }

    // Animation loop
    let time = 0;
    function animate() {
        time += 0.01;

        // Base gradient background
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#5f6d78');
        gradient.addColorStop(0.5, '#6b7a87');
        gradient.addColorStop(1, '#5f6d78');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Apply blur for smooth blending
        ctx.filter = 'blur(60px)';

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
