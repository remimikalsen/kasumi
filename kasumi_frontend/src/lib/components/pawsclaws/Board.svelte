<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import Square from './Square.svelte';
  
    export let width;
    export let height;
    export let squares;
    export let nextPlayer;
    export let playerIcons;
    export let availableIcons;
    export let groundRule;
    export let winnerSquares;
    export let hover;
  
    const dispatch = createEventDispatcher();
  
    function handleSquareClick(i) {
      dispatch('squareClick', i.detail);
    }
  
    function handleSquareHover(i) {
      dispatch('squareHover', i.detail);
    }
  </script>
  
  <div>
    {#each Array(height) as _, rowIndex}
      <div class="board-row">
        {#each Array(width) as _, colIndex}
          <Square
            {squares}
            square={rowIndex * width + colIndex}
            {width}
            {height}
            groundRule={groundRule}
            {nextPlayer}
            {playerIcons}
            {availableIcons}
            {winnerSquares}
            on:squareClick={handleSquareClick}
            on:squareHover={handleSquareHover}
            {hover}
          />
        {/each}
      </div>
    {/each}
  </div>
  
  <style>

    .board-row {
      white-space: nowrap;
      margin: 0;
      margin-bottom: -1px;
      line-height: 0;
      margin-right: 2px;
    }
    
    .board-row:after {
      clear: both;
      content: "";
      display: table;
    }

    .board-row:last-child {
      margin-bottom: 0;
    }
  </style>
  