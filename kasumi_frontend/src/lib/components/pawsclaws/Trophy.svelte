<script lang="ts">
    import { Fa } from 'svelte-fa';
    import { faTrophy } from '@fortawesome/free-solid-svg-icons';
  
    export let showTrophy;
  
    let fadeClass = '';
  
    $: if (showTrophy) {
      fadeClass = '';
      setTimeout(() => {
        fadeClass = 'fadeTrophy';
      }, 1000);
    }
  </script>
  
  <div id="trophy" class="trophy {fadeClass}">
    <Fa icon={faTrophy} />
  </div>
  
  <style>
    /* Include your CSS styles here */
    .trophy {
      position: absolute;
      z-index: 1000;
      opacity: 0.8;
      width: 100%;
      height: 100%;
      color: #daa520;
      background-color: #f05972;
      font-size: 8em;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: opacity 2s ease-in-out, visibility 0s 2s;
    }
    .trophy.fadeTrophy {
      opacity: 0;
      visibility: hidden;
    }
  </style>
  