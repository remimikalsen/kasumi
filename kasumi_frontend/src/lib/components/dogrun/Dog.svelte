<script>
    export let x = 0;
    export let y = 0;
    export let width = 50;
    export let height = 50;
    export let state = 'normal'; // default state
    export const collisionTolerance = 0;
  
    let dogImage;
  
    $: {
      switch (state) {
        case 'turning-left':
          dogImage = '/images/dogrun/dog/walk-left.png';
          break;
        case 'turning-right':
          dogImage = '/images/dogrun/dog/walk-right.png';
          break;
        case 'jumping-right':
          dogImage = '/images/dogrun/dog/jump-right.png';
          break;
        case 'jumping-left':
          dogImage = '/images/dogrun/dog/jump-left.png';
          break;
        case 'landing-right':
          dogImage = '/images/dogrun/dog/land-right.png';
          break;
        case 'landing-left':
          dogImage = '/images/dogrun/dog/land-left.png';
          break;
        case 'normal':
        default:
          dogImage = '/images/dogrun/dog/sitting.png';
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
  