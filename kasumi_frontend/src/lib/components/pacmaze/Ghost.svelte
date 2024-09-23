<script>
  import Icon from '@iconify/svelte';
  import ghostIcon from '@iconify-icons/twemoji/ghost'; // Ghost icon

  export let position;
</script>

<div
  style="
    grid-row: {position.y + 1};
    grid-column: {position.x + 1};
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
  "
>
  <Icon icon={ghostIcon} width="90%" height="90%" />
</div>

<style>
  div {
    width: 100%;
    height: 100%;
  }
</style>
