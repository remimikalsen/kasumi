<script lang="ts">
    import { Fa } from 'svelte-fa';
    import { createEventDispatcher } from 'svelte';
  
    export let availableIcons;
    export let playerIcons;
    export let playerText;
  
    const dispatch = createEventDispatcher();
  
    function handleIconChange(player, iconNum) {
      dispatch('playerIconChange', { player, iconNum });
    }
  </script>
  
  <div class="playerIconSetup">
    {#each playerIcons as iconIndex, i}
      <div>
        <div class="playerNumber">{playerText} {i + 1}</div>
        <div class="iconSelector">
          {#each availableIcons as iconData, idx}
            <button
              class={iconIndex === idx ? 'mine' : 'change'}
              on:click={() =>
                iconIndex !== idx && handleIconChange(i, idx)
              }
            >
              <Fa
                icon={iconData.icon}
                color={iconIndex === idx ? 'black' : '#c0c0c0'}
              />
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
  
  <style>
  div.playerIconSetup {
    margin-left: 5px;
    margin-top: 20px;
    vertical-align: top;
  }
  
  div.playerIconSetup div.playerNumber {
    padding-right: 5px;
    font-style: italic;
    display: inline-block;
    vertical-align: top;
    padding-top: 12px;
  }

  div.playerNumber {
    text-transform: capitalize;
  }
  
  div.playerIconSetup div.iconSelector {
    display: inline-block;
    margin-top: 5px;
    width: 190px;
  }
  
  div.iconSelector button {
    background: white; 
    border: 1px solid hsl(0,0%,80%);
    border-radius: 3px;
    padding: 2px 3px;
    text-align: center;
    text-decoration: none;
    font-size: 1.3em;
    margin-left: 5px;
    margin-top: 0;
    margin-bottom: 5px;
    width: 35px;
    height: 30px;
    cursor: default;
  }
  
  div.iconSelector button svg {
    color: #c0c0c0;
  }
  
  div.iconSelector button.mine svg {
    color: black;
    transition: all 1s ease-in;
  }
  
  div.iconSelector button.change:hover svg {
    color: red;
    cursor: pointer;
    
  }
  div.iconSelector button.change:focus svg {
    color: #c0c0c0;
    transition: all .5s linear;
  }
  div.iconSelector button.change:focus {
    outline: none;  
  }
  div.iconSelector button.mine:focus {
    outline: none;  
  }

  </style>
  