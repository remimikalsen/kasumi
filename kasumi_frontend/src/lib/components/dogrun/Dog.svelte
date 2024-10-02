<script>
    export let x = 0;
    export let y = 0;
    export let width = 50;
    export let height = 50;
    export let state = 'normal'; // default state
    export const collisionTolerance = 0;
  
    let dogImage;
    const images = [
      '/images/dogrun/dog/walk-left.png',
      '/images/dogrun/dog/walk-right.png',
      '/images/dogrun/dog/jump-right.png',
      '/images/dogrun/dog/jump-left.png',
      '/images/dogrun/dog/land-right.png',
      '/images/dogrun/dog/land-left.png',
      '/images/dogrun/dog/sitting.png'
    ];

    images.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  
    $: {
      switch (state) {
        case 'turning-left':
          dogImage = images[0];
          break;
        case 'turning-right':
          dogImage = images[1];
          break;
        case 'jumping-right':
          dogImage = images[2];
          break;
        case 'jumping-left':
          dogImage = images[3];
          break;
        case 'landing-right':
          dogImage = images[4];
          break;
        case 'landing-left':
          dogImage = images[5];
          break;
        case 'normal':
        default:
          dogImage = images[6];
          break;
      }
    }
  </script>
  
  <style>
    .dog {
      position: absolute;
      z-index: 1000;
    }
  </style>
  
  <img src={dogImage} class="dog" alt="Dog" style="left: {x}px; top: {y}px; width: {width}px; height: {height}px;">
  