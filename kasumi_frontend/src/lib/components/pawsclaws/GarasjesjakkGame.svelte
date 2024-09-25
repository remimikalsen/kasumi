<script lang="ts">
    import { onMount } from 'svelte';
    import Board from './Board.svelte';
    import Setup from './Setup.svelte';
    import Trophy from './Trophy.svelte';
    import { Fa } from 'svelte-fa';
    import {
      faCat,
      faHorse,
      faCrow,
      faFish,
      faDog,
      faDragon,
      faHippo,
      faFrog,
      faTrophy,
      faCog,
      faSync,
      faUndo,
      faRedo,
    } from '@fortawesome/free-solid-svg-icons';
    import Dropdown from '@lib/components/common/Dropdown.svelte';

    import { getLocalizedText, loadTexts, activeLanguage } from '$lib/stores/translatedTexts.js';

    const pageTexts = 'pawsclaws';
    let isLoading = true;    

    // Constants
    const MIN_BOARD_SIZE = 3;
    const MAX_BOARD_SIZE = 10;
    const MIN_PLAYERS = 2;
    const MAX_PLAYERS = 4;
  
    // Available icons
    let availableIcons = [];
  
    // Reactive variables
    let gameStarted = false;
    let boardWidthOptions = [];
    let boardHeightOptions = [];
    let numPlayersOptions = [];
    let winConditionOptions = [];
    let groundRuleOptions = [];
  
    // State variables
    let history = [];
    let stepNumber = 0;
    let nextPlayer = 1;
    let boardWidth = 3;
    let boardHeight = 3;
    let numPlayers = 2;
    let winCondition = 3;
    let groundRule = 0;
    let playerIcons = [];
    let winner = null;
    let hover = null;
    let winnerSquares = null;
    let showTrophy = false;
  
    async function fetchTexts() {
        isLoading = true;
        await loadTexts(pageTexts);

        availableIcons = [
          { icon: faCat, title: getLocalizedText(pageTexts, 'cat') },
          { icon: faCrow, title: getLocalizedText(pageTexts, 'crow') },
          { icon: faHorse, title: getLocalizedText(pageTexts, 'horse') },
          { icon: faFish, title: getLocalizedText(pageTexts, 'fish') },
          { icon: faDragon, title: getLocalizedText(pageTexts, 'dragon') },
          { icon: faDog, title: getLocalizedText(pageTexts, 'dog') },
          { icon: faHippo, title: getLocalizedText(pageTexts, 'hippo') },
          { icon: faFrog, title: getLocalizedText(pageTexts, 'frog') },
        ];

        groundRuleOptions = [
          { label: getLocalizedText(pageTexts, "rule_1"), value: '1' },
          { label: getLocalizedText(pageTexts, "rule_2"), value: '2' },
        ];
        
        groundRule = groundRuleOptions[0].value;

        boardWidthOptions = Array.from(
          { length: MAX_BOARD_SIZE - MIN_BOARD_SIZE + 1 },
          (_, i) => ({
            label: `${i + MIN_BOARD_SIZE} ${getLocalizedText(pageTexts, 'squares_wide')}`,
            value: i + MIN_BOARD_SIZE,
          })
        );

        boardHeightOptions = Array.from(
          { length: MAX_BOARD_SIZE - MIN_BOARD_SIZE + 1 },
          (_, i) => ({
            label: `${i + MIN_BOARD_SIZE} ${getLocalizedText(pageTexts, 'squares_high')}`,
            value: i + MIN_BOARD_SIZE,
          })
        );
        numPlayersOptions = Array.from(
          { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
          (_, i) => ({
            label: `${i + MIN_PLAYERS} ${getLocalizedText(pageTexts, 'players')}`,
            value: i + MIN_PLAYERS,
          })
        );
    
        boardWidth = boardWidthOptions[0].value;
        boardHeight = boardHeightOptions[0].value;
        numPlayers = numPlayersOptions[0].value;
    
        setWinConditionOptions(boardWidth, boardHeight);
    
        playerIcons = Array.from({ length: numPlayers }, (_, i) => i);
        history = [
          {
            squares: Array(boardWidth * boardHeight).fill(null),
          },
        ];        
          isLoading = false;
      }

    $: $activeLanguage, fetchTexts();

    // Initialize options and default state
    onMount(() => {

      fetchTexts();

    });
  
    // Functions
    function setWinConditionOptions(width, height) {
      const greatestBoardDimension = Math.max(width, height);
      winConditionOptions = [];
      for (let i = 3; i <= greatestBoardDimension; i++) {
        winConditionOptions.push({ label: `${i} ${getLocalizedText(pageTexts, "in_a_row")}`, value: i });
      }
    }
  
    function handleBoardWidthChange(option) {
      boardWidth = option.detail;
      history = [
        {
          squares: Array(boardWidth * boardHeight).fill(null),
        },
      ];
      setWinConditionOptions(boardWidth, boardHeight);
      if (winCondition > Math.max(boardWidth, boardHeight)) {
        winCondition = winConditionOptions[winConditionOptions.length - 1];
      }
    }
  
    function handleBoardHeightChange(option) {
      boardHeight = option.detail;
      history = [
        {
          squares: Array(boardWidth * boardHeight).fill(null),
        },
      ];
      setWinConditionOptions(boardWidth, boardHeight);
      if (winCondition > Math.max(boardWidth, boardHeight)) {
        winCondition = winConditionOptions[winConditionOptions.length - 1];
      }
    }
  
    function handleNumPlayersChange(option) {
      numPlayers = option.detail;
      playerIcons = Array.from({ length: numPlayers }, (_, i) => i);
    }
  
    function handlePlayerIconChange(option) {
      let player = option.detail.player;
      let iconNum = option.detail.iconNum;
      const newPlayerIcons = [...playerIcons];
      const prevIconOwner = newPlayerIcons.findIndex((icon) => icon === iconNum);
      if (prevIconOwner !== -1) {
        newPlayerIcons[prevIconOwner] = newPlayerIcons[player];
      }
      newPlayerIcons[player] = iconNum;
      playerIcons = newPlayerIcons;
    }
  
    function handleWinConditionChange(option) {
      winCondition = option.detail;
    }
  
    function handleGroundRuleChange(option) {
      groundRule = option.detail;
    }
  
    function handleSetupSubmit() {
      gameStarted = true;
      nextPlayer = 1;
      stepNumber = 0;
      winner = null;
      winnerSquares = null;
      showTrophy = false;
      history = [
        {
          squares: Array(boardWidth * boardHeight).fill(null),
        },
      ];
    }
  
    function handleSquareClick(i) {
      const currentHistory = history.slice(0, stepNumber + 1);
      const current = currentHistory[currentHistory.length - 1];
      const squares = [...current.squares];
  
      if (squares[i.detail] || winnerSquares) {
        return;
      }
  
      squares[i.detail] = nextPlayer;
      const newHistory = currentHistory.concat([{ squares }]);
      const newWinnerSquares = calculateWinnerSquares(squares);
      winner = newWinnerSquares ? squares[newWinnerSquares[0]] : null;
      winnerSquares = newWinnerSquares;
      showTrophy = !!winner;
  
      history = newHistory;
      stepNumber = newHistory.length - 1;
      nextPlayer = ((stepNumber) % numPlayers) + 1;
      hover = null;
    }
  
    function calculateWinnerSquares(squares) {
      const width = boardWidth;
      const height = boardHeight;
      const winLen = winCondition;
  
      for (let i = 0; i < squares.length; i++) {
        if (!squares[i]) continue;
        const player = squares[i];
  
        // Directions: E, SE, S, SW
        const directions = [
          { x: 1, y: 0 },   // East
          { x: 1, y: 1 },   // South-East
          { x: 0, y: 1 },   // South
          { x: -1, y: 1 },  // South-West
        ];
  
        for (const { x: dx, y: dy } of directions) {
          const line = [i];
          let x = i % width;
          let y = Math.floor(i / width);
  
          for (let n = 1; n < winLen; n++) {
            x += dx;
            y += dy;
            if (x < 0 || x >= width || y < 0 || y >= height) break;
            const index = y * width + x;
            if (squares[index] !== player) break;
            line.push(index);
          }
  
          if (line.length === winLen) {
            return line;
          }
        }
      }
      return null;
    }
  
    function restartGame() {
      stepNumber = 0;
      nextPlayer = 1;
      winner = null;
      winnerSquares = null;
      showTrophy = false;
      history = [
        {
          squares: Array(boardWidth * boardHeight).fill(null),
        },
      ];
    }
  
    function newSetup() {
      restartGame();
      gameStarted = false;
    }
  
    function handleSquareHover(i) {
      hover = i.detail;
    }
  
    function jumpTo(step) {
      stepNumber = step;
      nextPlayer = (step % numPlayers) + 1;
      const current = history[stepNumber];
      const squares = current.squares;
      winnerSquares = calculateWinnerSquares(squares);
      winner = winnerSquares ? squares[winnerSquares[0]] : null;
      showTrophy = !!winner;
    }

  </script>
  
  {#if !isLoading}

  {#if !gameStarted}
    <!-- Setup Screen -->
    <Setup
      {boardWidthOptions}
      {boardWidth}
      on:boardWidthChange={handleBoardWidthChange}
      {boardHeightOptions}
      {boardHeight}
      on:boardHeightChange={handleBoardHeightChange}
      {numPlayersOptions}
      {numPlayers}
      on:numPlayersChange={handleNumPlayersChange}
      {availableIcons}
      {playerIcons}
      on:playerIconChange={handlePlayerIconChange}
      {winConditionOptions}
      {winCondition}
      on:winConditionChange={handleWinConditionChange}
      {groundRuleOptions}
      {groundRule}
      on:groundRuleChange={handleGroundRuleChange}
      on:submit={handleSetupSubmit}
    />
  {:else}
    <!-- Game Screen -->
    <div class="game">
      <div
        class="game-board"
        on:mouseleave={() => (hover = null)}
      >
        <div class="status">
          {#if winner}
            <div>
              <span class="winner">
                <Fa icon={faTrophy} />
                <Fa icon={faTrophy} />
                <Fa icon={faTrophy} />
              </span>
              <span class="currentPlayer"><Fa icon={availableIcons[playerIcons[winner - 1]].icon} /></span>
              <span class="winner">
                <Fa icon={faTrophy} />
                <Fa icon={faTrophy} />
                <Fa icon={faTrophy} />
              </span>
            </div>
          {:else if stepNumber === boardWidth * boardHeight}
            <span>{getLocalizedText(pageTexts, "last_move_no_winner")}</span>
          {:else}
            <span>{getLocalizedText(pageTexts, "now_playing")} <span class="currentPlayer"><Fa icon={availableIcons[playerIcons[nextPlayer - 1]].icon} /></span></span>
          {/if}
        </div>
        <div class="board-container">
          {#if winner}
            <Trophy {showTrophy} />
          {/if}
          <Board
            width={boardWidth}
            height={boardHeight}
            squares={history[stepNumber].squares}
            {nextPlayer}
            {playerIcons}
            {availableIcons}
            {groundRule}
            {winnerSquares}
            on:squareClick={handleSquareClick}
            on:squareHover={handleSquareHover}
            {hover}
          />
        </div>
      </div>
      <div class="game-tools">
        <div class="navigate">
        <button
          id="undoButton"
          disabled={stepNumber <= 0}
          on:click={() => jumpTo(stepNumber - 1)}
        >
          <Fa icon={faUndo} />
        </button>
        <Dropdown
          id="jumpToSelect"
          className="navigateDropdown"
          onChange={(e) => jumpTo(e)}
          options={[
            { label: getLocalizedText(pageTexts, "start"), value: 0 },
            ...history.slice(1).map((_, index) => ({
              label:
                index + 1 === history.length - 1
                  ? getLocalizedText(pageTexts, "last_move")
                  : `${getLocalizedText(pageTexts, "move")} ${index + 1}`,
              value: index + 1,
            })),
          ]}
          selectedValue={stepNumber}
          selectOptionText={stepNumber === 0 ? getLocalizedText(pageTexts, "start"): stepNumber === history.length - 1 ? getLocalizedText(pageTexts, "last_move") : `${getLocalizedText(pageTexts, "move")} ${stepNumber}`}
        />
        <button
          id="redoButton"
          disabled={stepNumber >= history.length - 1}
          on:click={() => jumpTo(stepNumber + 1)}
        >
          <Fa icon={faRedo} />
        </button>
        </div>
        <ul class="game-options">
          <li>
            <button on:click={restartGame}>
              {getLocalizedText(pageTexts, "play_again")} <Fa icon={faSync} />
            </button>
          </li>
        </ul>
      </div>
      <div class="game-rules">
        <p>{getLocalizedText(pageTexts, "rules")}</p>
        <ul>
          <li>
            {boardWidthOptions.find(option => option.value === boardWidth).label} x {boardHeightOptions.find(option => option.value === boardHeight).label}
          </li>
          <li>{numPlayersOptions.find(option => option.value === numPlayers).label}</li>
          <li>{winConditionOptions.find(option => option.value === winCondition).label} {getLocalizedText(pageTexts, "to_win")}</li>
          <li>{groundRuleOptions.find(option => option.value === groundRule).label}</li>
        </ul>
        <button on:click={newSetup}>
          {getLocalizedText(pageTexts, "choose_rules")} <Fa icon={faCog} />
        </button>
      </div>
    </div>
  {/if}
  {/if}
  
  <style>
  .game {
    text-align: center;
    display: inline-block;
  }
  
  .game-rules {
    text-align: left;
    margin-top: 32px;
  }
  
  .game-rules p {
    font-weight: bold;
    margin-bottom: 5px;
  }
  
  .game-tools {
    /*margin-top: 32px;
    margin-left: -5px;
    margin-right: 20px;
    width: 200px;*/
    margin: 15px auto;
    vertical-align: top;
  }
  
  .game-rules ul,
  .game-tools ul {
    list-style-type: none;
    font-size: 1em;
    padding: 0;
    margin-bottom: 0;
    margin-top: 0;
  }
  
  .game-tools ul li,
  div.game-rules ul.setup li {
    padding: 5px;
  }
  
  
  
  .game-tools ul li button,
  div.game-rules button {
    background-color: white; 
    border: 1px solid hsl(0,0%,80%);
    border-radius: 6px;
    color: hsl(0,0%,20%);
    padding: 8px 10px;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    margin-bottom: 0px;
    font-size: 1em;
    width: 170px;
    display: flex;
    justify-content: space-between;
    margin: 20px auto;    
  }

  .game-tools ul li button {
    margin-top: 15px;
    background-color: #29cd79;
    color: black;
  }
  
  div.game-rules button {
    background-color: #dc301b;
    color: white;  
  }
  
  div.game-tools .navigate {
    margin: 40px;
    margin-bottom: 10px;
    display: flex;
    justify-content: center;
  }

  
  #undoButton,
  #redoButton {
    background-color: #f05972; 
    border: 1px solid #f05972;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font-size: 1.2em;
    height: 40px;
    width: 45px;
  }
  
  #undoButton:disabled,
  #redoButton:disabled {
    background-color: #ee7589;
  }
  
 
  div.game-rules {
    text-align: center;
  }
  
  .game-rules ul {
    margin-top: 10px;
    padding-top: 0;
    margin-bottom: 20px;
    text-align: left;
  }
  
  .game-board {
    margin-top: 40px;
    /*margin-right: 25px;*/
    text-align: center;
  }  

  
  div.status > div > span.winner {
      font-size: 0.7em;
  }
  
  div.board-container {
    position: relative;
    display: inline-block;
    box-sizing: border-box;
  }

  .status {
    text-align: center;
    margin-bottom: 5px;
    color: white;
    line-height: 30px;
    font-size: 1.5em;
    margin: 20px;
  }
  
  div.status > div > span.winner {
    color: #ffd700; /* Golden color */
  }

  div.status span.currentPlayer {
    color: #ee7589;
  }
  
  </style>
  
  