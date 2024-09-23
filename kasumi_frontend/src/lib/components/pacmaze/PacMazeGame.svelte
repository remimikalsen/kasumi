<script>
  import { onMount } from 'svelte';
  import Icon from '@iconify/svelte';
  import houseWithGarden from '@iconify-icons/twemoji/house-with-garden';
  import Player from '$lib/components/pacmaze/Player.svelte';
  import Ghost from '$lib/components/pacmaze/Ghost.svelte';
  import VirtualKeyboard from '$lib/components/common/VirtualKeyboard.svelte';
  import VirtualJoystick from '$lib/components/common/VirtualJoystickFourWay.svelte';
  import Message from '$lib/components/common/Message.svelte';
  import { getLocalizedText, loadTexts, activeLanguage } from '$lib/stores/translatedTexts.js';  
    import { page } from '$app/stores';

  let showNextLevelMessage = false;
  let nextLevelButton;
  let showCongratulations = false;
  let showErrorMessage = false;
  let showGameOverMessage = false;
  let showVirtualJoystick = false;
  let currentMessage = '';
  let currentLevel = 1;
  let leaderboard = [];
  let startTime; // Start time of the level
  let levelTime = 0.0; // Time spent on the current level
  let totalTime = 0.0; // Total time spent on all levels  

  let showKeyboard = false;
  let playerInitials = '';

  let playerPosition;
  let targetPosition;
  let ghosts = [];
  let maze;
  let ghostInterval;

  const pageTexts = 'pacmaze';
  //const commonTexts = 'common';
  let isLoadingTexts = true;

  const mazes = [
    // Level 1 Maze
    [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1],
      [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      [1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
        // Level 2 Maze
    [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
      [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
        // Level 3 Maze
    [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
  ];

  async function fetchTexts() {
            isLoadingTexts = true;
            await loadTexts(pageTexts);
            //await loadTexts(commonTexts);
            isLoadingTexts = false;
        }
  $: $activeLanguage, fetchTexts();

  function resetGame() {
    totalTime = 0;
    showNextLevelMessage = false;
    showCongratulations = false;
    showErrorMessage = false;
    showGameOverMessage = false;    
    clearInterval(ghostInterval);
    startLevel(1);
  }

  async function handleSubmitInitials(initials) {
    playerInitials = initials;
    await storeScore(playerInitials, totalTime);  // Wait for the score to be stored
    await loadLeaderboard();  // Load the updated leaderboard after the score is stored
    showKeyboard = false;
    showCongratulations = false;
  }

  function startLevel(level) {

    if (level < 1 || level > mazes.length) {      
      showErrorMessage = true;
      currentMessage = 'Invalid level number';
      return;
    }

    maze = mazes[level - 1];
    let gridSize = maze.length;

    // Check if all elements of maze are of equal length as gridSize
    for (let i = 0; i < maze.length; i++) {
      if (maze[i].length !== gridSize) {
        showErrorMessage = true;
        currentMessage = `Invalid maze dimensions in maze ${currentLevel}, line ${i + 1}`;
      return;
      }
    }

    // Player always starts in upper left corner
    playerPosition = { x: 1, y: 1 };

    // Ghost always starts in a random position
    ghosts = [];
    const initialPositions = [
      { x: Math.floor(Math.random() * (gridSize - 2)) + 1, y: Math.floor(Math.random() * (gridSize - 2)) + 1 },
      { x: Math.floor(Math.random() * (gridSize - 2)) + 1, y: Math.floor(Math.random() * (gridSize - 2)) + 1 },
      { x: Math.floor(Math.random() * (gridSize - 2)) + 1, y: Math.floor(Math.random() * (gridSize - 2)) + 1 },
    ];

    for (let i = 0; i < level; i++) {
      ghosts.push({
        position: initialPositions[i],
        currentDirection: null,
        previousPosition: null
      });
    }

    // Target position always downer right corner
    targetPosition = { x: gridSize - 2, y: gridSize - 2 };

    currentLevel = level;
    showVirtualJoystick = true;
    // Clear any existing interval before starting a new one
    if (ghostInterval) clearInterval(ghostInterval);
    ghostInterval = setInterval(moveGhosts, 1000 / currentLevel); // Move ghosts every second
    startTime = new Date();
    return () => clearInterval(ghostInterval);
  }

  // Dispatched from Player.svelte
  function handleMove(event) {
    let direction = event.detail;
    let newPosX = playerPosition.x + direction.x;
    let newPosY = playerPosition.y + direction.y;

    if (maze[newPosY][newPosX] === 0) {
      playerPosition = { x: newPosX, y: newPosY };
    }
    checkWinCondition();
    checkCollision();
  }
 
  function startNextLevel() {
    showNextLevelMessage = false;
    startLevel(currentLevel + 1);
  }  

  function handleVirtualKey(event) {
        const { key } = event.detail;
        const direction = { x: 0, y: 0 };

        switch (key) {
            case 'ArrowUp':
                direction.y = -1;
                break;
            case 'ArrowDown':
                direction.y = 1;
                break;
            case 'ArrowLeft':
                direction.x = -1;
                break;
            case 'ArrowRight':
                direction.x = 1;
                break;
        }

        if (direction.x !== 0 || direction.y !== 0) {
            handleMove({ detail: direction });
        }
    }
  
  function moveGhosts() {
    const directions = [
      { x: 0, y: -1 }, // Up
      { x: 0, y: 1 },  // Down
      { x: -1, y: 0 }, // Left
      { x: 1, y: 0 }   // Right
    ];

    function isValidMove(position, dir) {
      const newX = position.x + dir.x;
      const newY = position.y + dir.y;
      return maze[newY] && maze[newY][newX] === 0;
    }

    ghosts.forEach(ghost => {
      const validMoves = directions.filter(dir => isValidMove(ghost.position, dir));
      let changeDirection = false;

      if (validMoves.length > 0) {
        const baseProbability = 0.15;
        const totalProbability = baseProbability * validMoves.length;

        const previousDirection = ghost.currentDirection
          ? { x: -ghost.currentDirection.x, y: -ghost.currentDirection.y }
          : null;

        const isReturning = ghost.previousPosition &&
          validMoves.some(dir => dir.x === previousDirection.x && dir.y === previousDirection.y);

        const adjustedProbability = isReturning ? totalProbability / 2 : totalProbability;

        if (!ghost.currentDirection || !isValidMove(ghost.position, ghost.currentDirection) || Math.random() < adjustedProbability) {
          changeDirection = true;
        }

        if (changeDirection) {
          const newValidMoves = isReturning
            ? validMoves.filter(dir => dir.x !== previousDirection.x || dir.y !== previousDirection.y)
            : validMoves;

          if (newValidMoves.length > 0) {
            ghost.currentDirection = newValidMoves[Math.floor(Math.random() * newValidMoves.length)];
          } else {
            ghost.currentDirection = validMoves[Math.floor(Math.random() * validMoves.length)];
          }
        }
      }

      if (ghost.currentDirection) {
        ghost.previousPosition = { ...ghost.position };
        ghost.position = { 
          x: ghost.position.x + ghost.currentDirection.x,
          y: ghost.position.y + ghost.currentDirection.y
        };
        
      }
    });
    ghosts = ghosts;

    checkCollision();
  }


  function checkWinCondition() {
    if (playerPosition.x === targetPosition.x && playerPosition.y === targetPosition.y) {

      showVirtualJoystick = false;
      levelTime = (new Date() - startTime) / 1000; // Calculate level time
      totalTime += levelTime; // Add level time to total time

      clearInterval(ghostInterval); // Stop ghosts when level is complete
      if (currentLevel < mazes.length) {
        showNextLevelMessage = true;
        currentMessage = getLocalizedText(pageTexts, "level_complete").replace('<LEVEL>', currentLevel).replace('<LEVELS>', mazes.length);
      } else {
        showCongratulations = true;
        showKeyboard = true; // Show the keyboard for entering initials
        currentMessage = getLocalizedText(pageTexts, "game_complete").replace('<TIME>', totalTime.toFixed(2)).replace('<TIME_TEXT>', totalTime >= 2 ? getLocalizedText(pageTexts, 'time_plural') : getLocalizedText(pageTexts, 'time_singular')).replace('.', getLocalizedText(pageTexts, 'decimal_separator'));
        maze = null;
      }
    }
  }

  function checkCollision() {
    ghosts.forEach(ghost => {
      if (playerPosition.x === ghost.position.x && playerPosition.y === ghost.position.y) {
        showGameOverMessage = true;
        showVirtualJoystick = false;
        currentMessage = getLocalizedText(pageTexts, "game_over");
      }
    });
  }


  async function storeScore(initials, time) {
    await fetch('/api/pacmaze/submit_score', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ initials, time })
    });
  } 

  async function fetchLeaderboard() {
    const response = await fetch('/api/pacmaze/get_leaderboard');
    return await response.json();
  }

  async function loadLeaderboard() {
    const data = await fetchLeaderboard();

    if (Array.isArray(data) && data.length > 0) {
      leaderboard = [...data];
    }
  }  

  onMount(() => {
    fetchTexts();
    startLevel(currentLevel);
    loadLeaderboard();
  });


  $: if (showNextLevelMessage) {
    onMount(() => {
      if (nextLevelButton) {
        nextLevelButton.focus();
      }
    });
  }

</script>
{#if !isLoadingTexts}
<div class="container">
<div class="left-column">
  {#if maze && !showNextLevelMessage && !showErrorMessage && !showGameOverMessage && !showCongratulations}
    <h2 class="level-denomination">{getLocalizedText(pageTexts, "level_title").replace('<LEVEL>', currentLevel).replace('<LEVELS>', mazes.length)}</h2>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="level" role="grid" tabindex="0" aria-label="{getLocalizedText(pageTexts, "aria_maze_title")}">
      {#each maze as row, y}
        {#each row as cell, x}
          <div class="cell {cell === 1 ? 'wall' : ''}" style="grid-row: {y + 1}; grid-column: {x + 1};" role="gridcell" aria-label={cell === 1 ? getLocalizedText(pageTexts, "aria_wall") : getLocalizedText(pageTexts, "aria_corridor")}></div>
        {/each}
      {/each}
      <Player {playerPosition} on:move={handleMove} />
      {#each ghosts as ghost}
        <Ghost position={ghost.position} />
      {/each}
      <div class="target" style="grid-row: {targetPosition.y + 1}; grid-column: {targetPosition.x + 1};">
        <Icon icon={houseWithGarden} width="90%" height="90%" />
      </div>
    </div>
  {/if}

  {#if showVirtualJoystick}
    <VirtualJoystick on:key={handleVirtualKey} />
  {/if}

  {#if showNextLevelMessage}
    <Message type="level" level_title={getLocalizedText(pageTexts, "level_complete_title")} message={currentMessage} />
    <button class="next-level-button" on:click={startNextLevel} bind:this={nextLevelButton}>{getLocalizedText(pageTexts, "next_level")}</button>
  {/if}

  {#if showCongratulations}
    <Message type="winner" congrats_title={getLocalizedText(pageTexts, "congrats_title")} message={currentMessage} />
  {/if}

  {#if showKeyboard}
    <VirtualKeyboard onSubmit={handleSubmitInitials} />
  {/if}

  {#if showErrorMessage}
    <Message type="error" message={currentMessage} />
  {/if}

  {#if showGameOverMessage}
    <Message type="gameover" message={currentMessage} />
  {/if}

  <button class="reset-button" on:click={resetGame}>{getLocalizedText(pageTexts, "start_over")}</button>

</div>
<div class="right-column">
  {#if leaderboard && leaderboard.length > 0}
  <div class="leaderboard">
    <h2>{getLocalizedText(pageTexts, "high_score")}</h2>
    <table>
      <thead>
        <tr>
          <th class="rank">{getLocalizedText(pageTexts, "rank")}</th>
          <th class="initials">{getLocalizedText(pageTexts, "initials")}</th>
          <th class="time">{getLocalizedText(pageTexts, "leaderboard_score")}</th>
        </tr>
      </thead>
      <tbody>
        {#each leaderboard as { initials, time }, i}
          <tr>
            <td class="rank">{i + 1}.</td>
            <td class="initials">{initials}</td>
            <td class="time">{time ? time.toFixed(2).replace('.', getLocalizedText(pageTexts, 'decimal_separator')) : ''} s</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {/if}

</div>
</div>
{/if}

<style>
h2.level-denomination {
  color: #f05972;
  font-family: 'Courier New', Courier, monospace;
}

.container {
    display: flex;
    justify-content: center;
    align-items: stretch;
    width: 90%;
    height: 100%;
    padding: 20px;
}


.left-column,
.right-column {
  flex: 0 1 auto;  /* Make both columns take equal space */
  display: flex;
  flex-direction: column; /* Stack content vertically */
  justify-content: center; /* Center content vertically */
  align-items: center; /* Center content horizontally */
  padding: 20px;
}

@media (max-width: 800px) {
  .container {
    flex-direction: column; /* Stack the columns on smaller screens */
    padding: 10px;
  }

  .left-column,
  .right-column {
    flex: 0 1 auto; 
    display: flex;
    flex-direction: column; /* Stack content vertically */
    /*justify-content: center;*/ /* Center content vertically */
    align-items: center; /* Center content horizontally */
    padding: 20px;
  }

}

.level {
  display: grid;
  grid-template-columns: repeat(20, 1fr);
  grid-template-rows: repeat(20, 1fr);
  min-width: 350px;
  max-width: 700px;
  min-height: 350px;
  max-height: 700px;
  aspect-ratio: 1 / 1;
  /*border: 2px solid black;*/
  position: relative;
}

.cell {
  width: 80%;
  height: 80%;
  box-sizing: border-box; /* Ensures padding and borders don't affect size */
}

.wall {
  background-color: #3b263b;

}

.target {
  width: 100%;
  height: 100%;
}

.next-level-button,
.reset-button {
  margin-top: 50px;
  margin-bottom: 0px;
  background-color: #ca3049;
  color: #e0e1dd;
  padding: 12px 24px;
  font-size: 1.2rem;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 6px 10px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 1px;
        user-select: none;  /* Prevent text selection */
        -webkit-user-select: none;
        -ms-user-select: none;
        -moz-user-select: none;
}

.next-level-button {
  background-color: #1e4f1e; 
  margin-top: 30px;
  margin-bottom: 0px;
}

.next-level-button:hover,
.reset-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 15px rgba(0, 0, 0, 0.3);
}

.next-level-button:active,
.reset-button:active {
  transform: translateY(2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  background-color: #f0b300;
}

.leaderboard {
  padding: 10px;
  background-color: #1b263b;
  color: #e0e1dd;
  border-radius: 5px;
  border-style: solid;
  border-color: #f05972;
  border-width: 2px;
  box-shadow: 0 0px 12px rgba(237, 74, 213, 0.6);
  width: 300px;
  margin: 20px auto;
}

.leaderboard h2 {
  color: #f05972;
  font-family: 'Courier New', Courier, monospace;
}

.leaderboard table {
  width: 100%;
  border-collapse: collapse;  
}

.leaderboard th, .leaderboard td {
  padding: 5px;
  text-align: left;
}

.leaderboard th {
  border-bottom: 2px solid #e0e1dd;
  }

.leaderboard tr:first-child td {
  color: #ffd700; /* Golden color */
  text-shadow: 
    0 0 5px #ffd700,  /* Inner glow */
    0 0 10px #ffd700, /* Slightly outer glow */
    0 0 20px #ffd700, /* Further outer glow */
    0 0 40px #ff8c00;
  font-weight: bold;
}


.leaderboard tr:nth-child(2) td {
  color: #c0c0c0; /* Silver color */
  text-shadow: 
    0 0 5px #c0c0c0,  /* Inner glow */
    0 0 10px #c0c0c0, /* Slightly outer glow */
    0 0 20px #ffffff, /* Further outer glow with a lighter shade */
    0 0 40px #ffffff;
  font-weight: bold;
}


.leaderboard tr:nth-child(3) td {
  color: #cd7f32; /* Bronze color */
  text-shadow: 
    0 0 5px #cd7f32,  /* Inner glow */
    0 0 10px #cd7f32, /* Slightly outer glow */
    0 0 20px #b87333, /* Further outer glow with a darker bronze shade */
    0 0 40px #b87333;
  font-weight: bold;
}

.leaderboard .rank {
  width: 30%;
  text-align: center;
}
.leaderboard .initials {
  width: 40%;
  text-align: center;
}

.leaderboard td.initials {
  text-transform: uppercase;
}

.leaderboard .time {
  width: 30%;
  text-align: center;
}


</style>
