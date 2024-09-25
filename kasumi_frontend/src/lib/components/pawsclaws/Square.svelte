<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { Fa } from 'svelte-fa';
  
    export let squares;
    export let square;
    export let width;
    export let height;
    export let groundRule;
    export let nextPlayer;
    export let playerIcons;
    export let availableIcons;
    export let winnerSquares;
    export let hover;
  
    const dispatch = createEventDispatcher();
  
    let clickable = false;
  
    $: {
      const y = Math.floor(square / width);
      if (groundRule === '2') {
        clickable =
          !squares[square] &&
          ((y + 1 === height && !squares[square]) ||
            (y + 1 < height && squares[square + width]));
      } else {
        clickable = !squares[square];
      }
    }
  
    function handleClick() {
      if (clickable && !winnerSquares) {
        dispatch('squareClick', square);
      }
    }
  
    function handleHover() {
      if (clickable && !winnerSquares) {
        dispatch('squareHover', square);
      }
    }
  </script>
  
  <div class="square">
    <button
      class:winner={winnerSquares && winnerSquares.includes(square)}
      on:mouseover={handleHover}
      on:click={handleClick}
    >
      {#if squares[square]}
        <Fa
          icon={
            availableIcons[playerIcons[squares[square] - 1]].icon
          }
        />
      {:else if hover === square && clickable && !winnerSquares}
        <Fa
          icon={availableIcons[playerIcons[nextPlayer - 1]].icon}
          color="red"
        />
      {:else}
        &nbsp;
      {/if}
    </button>
  </div>
  
  <style>

.square {
    display: inline-block;
    border: 1px solid #999;
    margin: 0;
    padding: 0;
    margin-right: -2px;
  }
  
  .square > button {
    background: #fff;
    border: 0;
    font-size: 40px;
    font-weight: bold;
    line-height: 60px;
    height: 60px;
    padding: 0;
    text-align: center;
    width: 60px;
    float: left;
    outline: none;
    color: hsl(0, 0%, 15%);
  }
  
  .square:focus {
    outline: none;
  }
  
  .kbd-navigation .square:focus {
    background: #ddd;
  }
  
  .square > button.winner {
      color: #FFD700;
      color: #DAA520;
  }
  
  </style>
  