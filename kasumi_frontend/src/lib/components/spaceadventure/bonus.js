// Since JavaScript doesn't have enums, we'll simulate it with an object.
export const BonusType = {
    Trident: 0,
    DoubleTrouble: 1,
    MonsterShot: 2
  };
  
  const images = {};

  function preloadImages() {
    if (typeof window !== 'undefined') {
      images[BonusType.Trident] = new Image();
      images[BonusType.Trident].src = '/spaceadventure/trident.png';
    
      images[BonusType.DoubleTrouble] = new Image();
      images[BonusType.DoubleTrouble].src = '/spaceadventure/double-trouble.png';
    
      images[BonusType.MonsterShot] = new Image();
      images[BonusType.MonsterShot].src = '/spaceadventure/monster-wave.png';
    }

  }

// Call the preload function
preloadImages();

  export class BonusPack {
    constructor(canvasWidth) {
      this.x = Math.random() * (canvasWidth - 20);
      this.y = -20;
      this.speed = 2;
        const randomValue = Math.random();
        if (randomValue < 0.1) {
        this.type = BonusType.MonsterShot; // 10% chance
        } else {
        this.type = Math.random() < 0.5 ? BonusType.Trident : BonusType.DoubleTrouble; // 90% chance split between Trident and DoubleTrouble
        }
    }
  
    draw(ctx) {
        const boxSize = 44;
        const padding = 4; // Increased padding to make room for the shadow effect
        const imageSize = boxSize - 2 * padding;

        ctx.lineWidth = 2;
        ctx.strokeStyle = this.getColor();
        ctx.shadowColor = this.getShadowColor();
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // Draw rounded rectangle
        const radius = 8;
        ctx.beginPath();
        ctx.moveTo(this.x + radius, this.y);
        ctx.lineTo(this.x + boxSize - radius, this.y);
        ctx.quadraticCurveTo(this.x + boxSize, this.y, this.x + boxSize, this.y + radius);
        ctx.lineTo(this.x + boxSize, this.y + boxSize - radius);
        ctx.quadraticCurveTo(this.x + boxSize, this.y + boxSize, this.x + boxSize - radius, this.y + boxSize);
        ctx.lineTo(this.x + radius, this.y + boxSize);
        ctx.quadraticCurveTo(this.x, this.y + boxSize, this.x, this.y + boxSize - radius);
        ctx.lineTo(this.x, this.y + radius);
        ctx.quadraticCurveTo(this.x, this.y, this.x + radius, this.y);
        ctx.closePath();
        ctx.stroke();

        // Reset shadow settings for the image
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        const img = images[this.type];
        if (img) {
            ctx.drawImage(img, this.x + padding, this.y + padding, imageSize, imageSize);
        }
      
    }
  
    update() {
      this.y += this.speed;
    }
  
    getColor() {
      switch (this.type) {
        case BonusType.Trident:
          return 'gold';
        case BonusType.DoubleTrouble:
          return 'silver';
        case BonusType.MonsterShot:
          return 'purple';
        default:
          return 'white'; // Default color if type is undefined
      }
    }

    getShadowColor() {
        switch (this.type) {
          case BonusType.Trident:
            return 'rgba(255, 215, 0, 0.05)'; // gold with 5% transparency
          case BonusType.DoubleTrouble:
            return 'rgba(192, 192, 192, 0.05)'; // silver with 5% transparency
          case BonusType.MonsterShot:
            return 'rgba(128, 0, 128, 0.05)'; // purple with 5% transparency
          default:
            return 'rgba(255, 255, 255, 0.05)'; // white with 5% transparency
        }
      }
  }
  