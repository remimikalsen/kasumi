export class Bullet {
    constructor(x, y, angle = 0) {
      this.x = x;
      this.y = y;
      this.speed = 7;
      this.width = 5;
      this.height = 10;
      this.angle = angle; // degrees
    }
  
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      ctx.rotate((this.angle * Math.PI) / 180);
      ctx.fillStyle = 'red';
      ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
      ctx.restore();
    }
  
    update() {
      this.x += this.speed * Math.sin((this.angle * Math.PI) / 180);
      this.y -= this.speed * Math.cos((this.angle * Math.PI) / 180);
    }
  }
  