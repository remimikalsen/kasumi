export class Asteroid {
    constructor(canvasWidth) {
      this.size = Math.floor(Math.random() * 5) + 1; // Sizes 1-5
      this.x = Math.random() * (canvasWidth - this.size * 20);
      this.y = -this.size * 20;
      this.speed = 1; // + this.size * 0.5;
      this.hp = this.size;
      this.speedFactor = 1;
  
      // Load the image based on the size
      this.image = new Image();
      this.image.src = `/spaceadventure/asteroid_${this.size}.png`;
    }
  
    draw(ctx) {
      if (this.image.complete) {
        ctx.drawImage(this.image, this.x - (this.size * 10), this.y - (this.size * 10), this.size * 20, this.size * 20);
      } else {
        // Fallback to a gray circle if the image is not yet loaded
        ctx.fillStyle = 'gray';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  
    update(speedFactor) {
      this.y += this.speed * speedFactor;
    }

    takeHit(ctx) {
      this.hp -= 1;

        // Draw a red overlay to indicate a hit
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, (this.size * 10) + 10, 0, Math.PI * 2);
        ctx.fill();

        // Remove the red overlay after 0.2 seconds
        setTimeout(() => {
        this.draw(ctx);
        }, 200);
    }

  }