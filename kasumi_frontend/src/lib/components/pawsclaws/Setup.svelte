<script lang="ts">
  import { onMount } from 'svelte';
  import Dropdown from '@lib/components/common/Dropdown.svelte';
  import SelectPlayerIcons from './SelectPlayerIcons.svelte';
  import { createEventDispatcher } from 'svelte';
  import { Fa } from 'svelte-fa';
  import { faPlayCircle } from '@fortawesome/free-solid-svg-icons';    

  import { getLocalizedText, loadTexts, activeLanguage } from '$lib/stores/translatedTexts.js';

  const pageTexts = 'pawsclaws';
  let isLoading = true;
  
  export let boardWidthOptions;
  export let boardWidth;
  export let boardHeightOptions;
  export let boardHeight;
  export let numPlayersOptions;
  export let numPlayers;
  export let availableIcons;
  export let playerIcons;
  export let winConditionOptions;
  export let winCondition;
  export let groundRuleOptions;
  export let groundRule;

  const dispatch = createEventDispatcher();

  function handleSubmit() {
    dispatch('submit');
  }

  async function fetchTexts() {
        isLoading = true;
        await loadTexts(pageTexts);
        isLoading = false;
  }

  onMount(() => {
    fetchTexts();
  });  

</script>

{#if !isLoading}
<div class="setup">
  <div class="columns">
  <div class="left-column">
  <label for="boardWidthSelect">{getLocalizedText(pageTexts, "breadth")}:</label>
  <Dropdown
    id="boardWidthSelect"
    className="garasjesjakkSetupSelect"
    onChange={e => dispatch('boardWidthChange', e)}
    options={boardWidthOptions}
    selectedValue={boardWidth}
    selectOptionText={getLocalizedText(pageTexts, "choose_breadth")}
    dropdownLabel={getLocalizedText(pageTexts, "choose_breadth")}
  />
  <label for="boardHeightSelect">{getLocalizedText(pageTexts, "height")}:</label>
  <Dropdown
    id="boardHeightSelect"
    className="garasjesjakkSetupSelect"
    onChange={(e) => dispatch('boardHeightChange', e)}
    options={boardHeightOptions}
    selectedValue={boardHeight}
    selectOptionText={getLocalizedText(pageTexts, "choose_height")}
    dropdownLabel={getLocalizedText(pageTexts, "choose_height")}
  />
  <label for="winConditionSelect">{getLocalizedText(pageTexts, "wins_with")}:</label>
  <Dropdown
    id="winConditionSelect"
    className="garasjesjakkSetupSelect"
    onChange={(e) => dispatch('winConditionChange', e)}
    options={winConditionOptions}
    selectedValue={winCondition}
    selectOptionText={getLocalizedText(pageTexts, "choose_winner_condition")}
    dropdownLabel={getLocalizedText(pageTexts, "choose_winner_condition")}
  />
  <label for="groundRuleSelect">{getLocalizedText(pageTexts, "ground_rule")}:</label>
  <Dropdown
    id="groundRuleSelect"
    className="garasjesjakkSetupSelectLong"
    onChange={(e) => dispatch('groundRuleChange', e)}
    options={groundRuleOptions}
    selectedValue={groundRule}
    selectOptionText={getLocalizedText(pageTexts, "choose_ground_rule")}
    dropdownLabel={getLocalizedText(pageTexts, "choose_ground_rule")}
  />
  </div>
  <div class="right-column">
  <label for="numPlayersSelect">{getLocalizedText(pageTexts, "number_of_players")}:</label>
  <Dropdown
    id="numPlayersSelect"
    className="garasjesjakkSetupSelect"
    onChange={(e) => dispatch('numPlayersChange', e)}
    options={numPlayersOptions}
    selectedValue={numPlayers}
    selectOptionText={getLocalizedText(pageTexts, "choose_number_of_players")}
    dropdownLabel={getLocalizedText(pageTexts, "choose_number_of_players")}
  />
  <SelectPlayerIcons
    {availableIcons}
    {playerIcons}
    playerText={getLocalizedText(pageTexts, "player")}
    on:playerIconChange={(e) =>
      dispatch('playerIconChange', e.detail)
    }
  />
  </div>
  </div>
  <div class="startButton">
    <button on:click={handleSubmit}>
      {getLocalizedText(pageTexts, "start_game")} <Fa icon={faPlayCircle} />
    </button>
  </div>
</div>
{/if}
<style>
  
  div.columns {
    display: flex;
    justify-content: space-between;
  }

  div.right-column,
  div.left-column {
    margin: 20px;
    flex: 1;
    flex-direction: column;
  }


  div.setup {
    display: flex;
    flex-direction: column;
    margin: 0 auto;
    text-align: left;
    max-width:500px;
  }
  
  div.setup label {
    margin-top: 20px;
    display: block;
  }
  
  div.setup button {
    margin-top: 25px;
    background-color: #29cd79; 
    border: 1px solid hsl(0,0%,80%);
    border-radius: 10px;
    color: hsl(0,0%,20%);
    color: black;
    padding: 10px 20px;
    text-align: center;
    text-decoration: none;
    display: inline-block;
    font-size: 1.5em;
    cursor: pointer;
  }

  div.startButton {
    display: inline-block;
    width: 100%;
    text-align: center;
    margin-bottom: 50px;
  }

</style>