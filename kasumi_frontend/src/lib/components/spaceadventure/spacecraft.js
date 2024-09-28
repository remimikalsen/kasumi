export class Spacecraft {
    constructor(canvasWidth, canvasHeight) {
      this.width = 40;
      this.height = 60;
      this.speed = 5;
      this.x = canvasWidth / 2 - this.width / 2;
      this.y = canvasHeight - this.height - 10;
      this.img = new Image();
      this.img.src = '/spaceadventure/spacecraft.png'; // Ensure this image exists in the 'static' folder
    }
  
    draw(ctx) {
      ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
    }
  
    moveLeft() {
      this.x = Math.max(this.x - this.speed, 0);
    }
  
    moveRight(canvasWidth) {
      this.x = Math.min(this.x + this.speed, canvasWidth - this.width);
    }
  
    moveUp() {
      this.y = Math.max(this.y - this.speed, 0);
    }
  
    moveDown(canvasHeight) {
      this.y = Math.min(this.y + this.speed, canvasHeight - this.height);
    }
  }
  