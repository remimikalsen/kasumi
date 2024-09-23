<script>
  import Icon from '@iconify/svelte';
  import pacmanIcon from '@iconify-icons/twemoji/face-screaming-in-fear';
  import { createEventDispatcher, onMount } from 'svelte';

  export let playerPosition;

  const dispatch = createEventDispatcher();

  function handleKeydown(event) {
    let move = { x: 0, y: 0 };
    if (event.key === 'ArrowUp') move.y = -1;
    if (event.key === 'ArrowDown') move.y = 1;
    if (event.key === 'ArrowLeft') move.x = -1;
    if (event.key === 'ArrowRight') move.x = 1;
    event.preventDefault();
    dispatch('move', move); // Dispatch the event within the component
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>

<div style="grid-row: {playerPosition.y + 1}; grid-column: {playerPosition.x + 1}; display: flex; justify-content: center; align-items: center;">
  <Icon icon={pacmanIcon} width="90%" height="90%" />
</div>

<style>
  div {
    width: 100%;
    height: 100%;
  }
</style>
