<script>
  import { onMount, onDestroy } from 'svelte';
  import Icon from '@iconify/svelte';
  import houseWithGarden from '@iconify-icons/twemoji/house-with-garden';
  import Player from '$lib/components/pacmaze/Player.svelte';
  import Ghost from '$lib/components/pacmaze/Ghost.svelte';
  import VirtualKeyboard from '$lib/components/common/VirtualKeyboard.svelte';
  import VirtualJoystick from '$lib/components/common/VirtualJoystickFourWay.svelte';
  import { getLocalizedText, loadTexts, activeLanguage } from '$lib/stores/translatedTexts.js';  
  import { env } from '$env/dynamic/public';
    import { page } from '$app/stores';

  let width;
  let height;
  let showNextLevelMessage = false;
  let nextLevelButton;
  let showCongratulations = false;
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
  let paused = false;
  let winCondition = false;
  let hasStarted = false;
  let levelPauseTime = 0;
  let pauseStartTime;
  let pausedOverlay;
  let startOverlay;
  let gameOverOverlay;
  let nextLevelOverlay;
  let gameWrapper;
  let gameContainer;
  let lastTap = 0;
  let lastClick = 0;
  let elapsedTimeInterval;

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
    levelTime = 0;
    levelPauseTime = 0;
    hasStarted = true;
    paused = false;
    winCondition = false;
    showNextLevelMessage = false;
    showCongratulations = false;
    showGameOverMessage = false;    
    clearInterval(ghostInterval);
    scrollAndFreeze(); 
    startLevel(1);
  }

  function startGame() {
    paused = false;
    startTime = new Date();
    totalTime = 0;
    levelTime = 0;
    levelPauseTime = 0;
    hasStarted = true;
    winCondition = false;
    gameContainer.addEventListener('touchend', handleDoubleTap);
    gameContainer.addEventListener('mousedown', handleDoubleClick);
    scrollAndFreeze();
  }

  async function handleSubmitInitials(initials) {
    playerInitials = initials;
    await storeScore(playerInitials, totalTime);  // Wait for the score to be stored
    await loadLeaderboard();  // Load the updated leaderboard after the score is stored
    showKeyboard = false;
  }

  function startLevel(level) {

    if (level < 1 || level > mazes.length) {      
      console.log('Invalid level number' + level);
      return;
    }

    maze = mazes[level - 1];
    let gridSize = maze.length;

    // Check if all elements of maze are of equal length as gridSize
    for (let i = 0; i < maze.length; i++) {
      if (maze[i].length !== gridSize) {
        console.log(`Invalid maze dimensions in maze ${currentLevel}, line ${i + 1}`);
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
    startTime = new Date();
    winCondition = false;
    // Clear any existing interval before starting a new one
    if (ghostInterval) clearInterval(ghostInterval);
    ghostInterval = setInterval(moveGhosts, 1000 / currentLevel); // Move ghosts every second
    return () => clearInterval(ghostInterval);
  }

  // Dispatched from Player.svelte
  function handleMove(event) {
    if (paused || !hasStarted || winCondition) return;
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
    
    if (paused || !hasStarted) return;

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

  function updateElapsedTime() {
    if (hasStarted && !paused && !winCondition && !showGameOverMessage) {
      levelTime = (new Date() - startTime - levelPauseTime) / 1000;
    }
  }  

  function checkWinCondition() {
    if (playerPosition.x === targetPosition.x && playerPosition.y === targetPosition.y) {

      showVirtualJoystick = false;
      winCondition = true;

      levelTime = (new Date() - startTime - levelPauseTime) / 1000; // Calculate level time
      console.log('yey');
      totalTime += levelTime; // Add level time to total time
      levelPauseTime = 0;
      levelTime = 0;


      clearInterval(ghostInterval); // Stop ghosts when level is complete
      if (currentLevel < mazes.length) {
        showNextLevelMessage = true;
        currentMessage = getLocalizedText(pageTexts, "level_complete").replace('<LEVEL>', currentLevel).replace('<LEVELS>', mazes.length);

      } else {
        showCongratulations = true;
        showKeyboard = true; // Show the keyboard for entering initials
        currentMessage = getLocalizedText(pageTexts, "game_complete").replace('<TIME>', totalTime.toFixed(2)).replace('<TIME_TEXT>', totalTime >= 2 ? getLocalizedText(pageTexts, 'time_plural') : getLocalizedText(pageTexts, 'time_singular')).replace('.', getLocalizedText(pageTexts, 'decimal_separator'));
      }
    }
  }

  function checkCollision() {
    ghosts.forEach(ghost => {
      if (playerPosition.x === ghost.position.x && playerPosition.y === ghost.position.y) {
        showGameOverMessage = true;
        currentMessage = getLocalizedText(pageTexts, "game_over");
        //gameWrapper.style.paddingTop = "unset";
        //gameWrapper.style.paddingBottom = "unset";
        //gameWrapper.height = "unset";
        document.body.classList.remove('no-scroll');
        window.removeEventListener('touchmove', preventScroll, { passive: false });
        updateOverlayPositions();
      }
    });
  }


  async function storeScore(initials, time) {
    await fetch('/api/pacmaze/submit_score', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.PUBLIC_API_KEY}`
      },
      body: JSON.stringify({ initials, time })
    });
  } 

  async function fetchLeaderboard() {
    const response = await fetch('/api/pacmaze/get_leaderboard', {
        headers: {
            'Authorization': `Bearer ${env.PUBLIC_API_KEY}`
        }
    });
    return await response.json();
  }

  async function loadLeaderboard() {
    const data = await fetchLeaderboard();

    if (Array.isArray(data) && data.length > 0) {
      leaderboard = [...data];
    }
  }  

  onMount(() => {

    
    if (typeof window !== 'undefined') {
      //updateDimensions();
      window.addEventListener('resize', updateOverlayPositions);
      window.addEventListener('keydown', handleKeyDown);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      updateOverlayPositions();
    }
    elapsedTimeInterval = setInterval(updateElapsedTime, 100); // Update every 100ms
    document.addEventListener('visibilitychange', handleVisibilityChange);
    fetchTexts();
    startLevel(currentLevel);
    loadLeaderboard();
  });

  onDestroy(() => {
    clearInterval(ghostInterval);
    clearInterval(elapsedTimeInterval);
    gameContainer.removeEventListener('touchend', handleDoubleTap);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('resize', updateOverlayPositions);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('touchmove', preventScroll, { passive: false });
    gameContainer.removeEventListener('mousedown', handleDoubleClick);
    document.body.classList.remove('no-scroll');
  });

  function togglePause() {
    if (!hasStarted) return;

    paused = !paused;
    if (!paused) {
      levelPauseTime += new Date() - pauseStartTime;
      ghostInterval = setInterval(moveGhosts, 1000 / currentLevel);
      scrollAndFreeze();
    } else {
      pauseStartTime = new Date();
      clearInterval(ghostInterval);
      //gameWrapper.style.paddingTop = "unset";
      //gameWrapper.style.paddingBottom = "unset";
      //gameWrapper.height = "unset";
      document.body.classList.remove('no-scroll');
      window.removeEventListener('touchmove', preventScroll, { passive: false });
      updateOverlayPositions();
    }
  }


  function updateDimensions() {

    width = Math.min(800, window.innerWidth);
    height = Math.min(600, window.innerHeight);

    if (gameWrapper) {

      gameWrapper.width = width;

      gameWrapper.height = Array.from(gameWrapper.children).reduce((totalHeight, child) => {
        const style = window.getComputedStyle(child);
        const marginTop = parseFloat(style.marginTop);
        const marginBottom = parseFloat(style.marginBottom);
        return totalHeight + child.offsetHeight + marginTop + marginBottom;
      }, 0);
      
      let pad = (window.innerHeight - gameWrapper.height)/2;

      if (width < 800) {
        gameWrapper.style.paddingTop = pad+'px';
        gameWrapper.style.paddingBottom = pad+'px';
      } else {
        gameWrapper.style.paddingTop = "unset";
        gameWrapper.style.paddingBottom = "unset";
        gameWrapper.height = "unset";
      }       
    }

   
  }  

  function updateOverlayPositions() {
          //updateDimensions();
          if (window.innerWidth > 800 && gameWrapper) {
            gameWrapper.style.paddingTop = "unset";
            gameWrapper.style.paddingBottom = "unset";
            gameWrapper.height = "unset";
          }

          let addedBorders = 10;
          
          if (gameWrapper && pausedOverlay) {
              
              const rect = gameWrapper.getBoundingClientRect();
              pausedOverlay.style.top = `${rect.top + window.scrollY - addedBorders}px`;
              pausedOverlay.style.left = `${rect.left + window.scrollX - addedBorders}px`;
              pausedOverlay.style.width = `${rect.width + addedBorders*2}px`;
              pausedOverlay.style.height = `${rect.height + addedBorders*2}px`;
          }

          if (gameWrapper && gameOverOverlay) {
              const rect = gameWrapper.getBoundingClientRect();
              gameOverOverlay.style.top = `${rect.top + window.scrollY - addedBorders}px`;
              gameOverOverlay.style.left = `${rect.left + window.scrollX - addedBorders}px`;
              gameOverOverlay.style.width = `${rect.width + addedBorders*2}px`;
              gameOverOverlay.style.height = `${rect.height + addedBorders*2}px`;
          }

          if (gameWrapper && startOverlay) {
              const rect = gameWrapper.getBoundingClientRect();
              startOverlay.style.top = `${rect.top + window.scrollY - addedBorders}px`;
              startOverlay.style.left = `${rect.left + window.scrollX - addedBorders}px`;
              startOverlay.style.width = `${rect.width + addedBorders*2}px`;
              startOverlay.style.height = `${rect.height + addedBorders*2}px`;
          }

          if (gameWrapper && nextLevelOverlay) {
              const rect = gameWrapper.getBoundingClientRect();
              nextLevelOverlay.style.top = `${rect.top + window.scrollY - addedBorders}px`;
              nextLevelOverlay.style.left = `${rect.left + window.scrollX - addedBorders}px`;
              nextLevelOverlay.style.width = `${rect.width + addedBorders*2}px`;
              nextLevelOverlay.style.height = `${rect.height + addedBorders*2}px`;
          }          

  }  


  async function scrollAndFreeze() {
    //updateDimensions();

    if (window.innerWidth <= 800) { // Adjust the width threshold as needed

        gameWrapper.height = Array.from(gameWrapper.children).reduce((totalHeight, child) => {
          const style = window.getComputedStyle(child);
          const marginTop = parseFloat(style.marginTop);
          const marginBottom = parseFloat(style.marginBottom);
          return totalHeight + child.offsetHeight + marginTop + marginBottom;
        }, 0);
        let pad = (window.innerHeight - gameWrapper.height)/2;
        gameWrapper.style.paddingTop = pad+'px';
        gameWrapper.style.paddingBottom = pad+'px';

        gameWrapper.scrollIntoView({ behavior: 'smooth' });
        await waitForScrollToEnd();
        document.body.classList.add('no-scroll');
        window.addEventListener('touchmove', preventScroll, { passive: false });
    } else {
      gameWrapper.style.paddingTop = "unset";
      gameWrapper.style.paddingBottom = "unset";
      gameWrapper.height = "unset";      
      document.body.classList.remove('no-scroll');
      updateOverlayPositions();
      window.removeEventListener('touchmove', preventScroll, { passive: false });
    }
  }


  function waitForScrollToEnd() {
    return new Promise((resolve) => {
      let isScrolling;
      const onScroll = () => {
        window.clearTimeout(isScrolling);
        isScrolling = setTimeout(() => {
          window.removeEventListener('scroll', onScroll);
          resolve();
        }, 100); // Adjust the timeout as needed
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    });
  }


  const preventScroll = (e) => {
    e.preventDefault();
  };  
    
  function handleDoubleTap(event) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;

    if (tapLength < 300 && tapLength > 0) {
      togglePause();
    }
    lastTap = currentTime;
  } 

  function handleDoubleClick(event) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastClick;

    if (tapLength < 300 && tapLength > 0) {
      togglePause();
    }
    lastClick = currentTime;
  } 


  function handleVisibilityChange() {
      if (document.hidden) {
          if (!paused) {
          togglePause();
          }
      }
  }  


  function handleKeyDown(e) {
      if (e.code === 'KeyP') {
          togglePause();
      } else if (e.code === 'KeyR') {
          resetGame();
      } else if (e.code === 'KeyM') {
          //toggleMusicMute();
      } else if (e.code === 'KeyS') {
          //toggleSoundEffectsMute();
      } 
      e.preventDefault();
  }

  $: if (gameWrapper) {
    updateOverlayPositions();
  }

  $: if (showNextLevelMessage) {
    nextLevelButton.focus();
  }

</script>
{#if !isLoadingTexts}
<div class="container">
<div class="left-column">
  <div class="game-wrapper" bind:this={gameWrapper}>
  {#if maze }
    <h2 class="level-denomination">{getLocalizedText(pageTexts, "level_title").replace('<LEVEL>', currentLevel).replace('<LEVELS>', mazes.length)}</h2>
    <p class="total-time">{getLocalizedText(pageTexts, 'total_time')}: {(totalTime + levelTime).toFixed(2)} s</p>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div bind:this={gameContainer} class="level" role="grid" tabindex="0" aria-label="{getLocalizedText(pageTexts, "aria_maze_title")}">
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
  </div>

  {#if hasStarted && !showGameOverMessage && !showCongratulations}
  <button class="reset-button" on:click={resetGame}>{getLocalizedText(pageTexts, "start_over")}</button>
  {/if}

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




<div bind:this={gameOverOverlay} class="game-over-overlay { !showGameOverMessage && !showCongratulations ? 'hide' : ''}">
  {#if showGameOverMessage}
  <p class="game_over_message">{getLocalizedText(pageTexts, "game_over")}</p>
  <button class="reset" on:click={resetGame}>{getLocalizedText(pageTexts, "start_over")}</button>
  {:else if showCongratulations && showKeyboard}
  <p class="game_over_score">{currentMessage}</p>
  <VirtualKeyboard onSubmit={handleSubmitInitials} />
  {:else}
  <p class="start_over">{getLocalizedText(pageTexts, "start_game")}</p>
  <button class="reset" on:click={resetGame}>{getLocalizedText(pageTexts, "start_over")}</button>
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

  {/if}
</div>

<div bind:this={nextLevelOverlay} class="pause-overlay { !showNextLevelMessage ? 'hide' : ''}">
  <p class="pause_title">{getLocalizedText(pageTexts, "level_complete_title")}</p>
  <button class="next-level-button" on:click={startNextLevel} bind:this={nextLevelButton}>{getLocalizedText(pageTexts, "next_level")}</button>
</div>

<div bind:this={pausedOverlay} class="pause-overlay { !paused || !hasStarted ? 'hide' : ''}">
  <p class="pause_title">{@html getLocalizedText(pageTexts, "p_to_resume")}</p>
  <button class="pause" on:click={togglePause} disabled={showGameOverMessage || !hasStarted}>{paused ? getLocalizedText(pageTexts, "resume") : getLocalizedText(pageTexts, "pause")}</button>
</div>

<div bind:this={startOverlay} class="start-game-overlay { hasStarted ? 'hide' : ''}">
  <p>{getLocalizedText(pageTexts, "start_game")}</p>
  {#if !hasStarted}
  <button class="reset" on:click={startGame}>{getLocalizedText(pageTexts, "start")}</button>
  {:else}
  <button class="reset" on:click={resetGame}>{getLocalizedText(pageTexts, "start_over")}</button>
  {/if}
  </div>

{/if}
<style>


h2.level-denomination {
  color: #f05972;
  font-family: 'Courier New', Courier, monospace;
  margin-bottom: 0px;
  font-size: 1.8rem;
  font-weight: bold;
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
  flex: 0 1 auto; 
      display: flex;
      flex-direction: column; /* Stack content vertically */
      /*justify-content: center;*/ /* Center content vertically */
      align-items: center; /* Center content horizontally */
      padding: 20px;
      min-width: 320px;
}

.game-wrapper {
      display: flex;
      flex-direction: column;
      padding-left: 0;
      align-items: center;
      justify-content: center;
}

.game-wrapper p.total-time {
  margin-top: 0px;
  margin-bottom: 20px;
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
    0 0 10px #ffd700, /* Slightly outer glow */
    0 0 20px #ffd700;
  font-weight: bold;
}


.leaderboard tr:nth-child(2) td {
  color: #c0c0c0; /* Silver color */
  text-shadow: 
    0 0 10px #c0c0c0, /* Slightly outer glow */
    0 0 20px #ffffff;
  font-weight: bold;
}


.leaderboard tr:nth-child(3) td {
  color: #cd7f32; /* Bronze color */
  text-shadow: 
    0 0 10px #cd7f32, /* Slightly outer glow */
    0 0 20px #b87333;
  font-weight: bold;
}

.leaderboard .rank {
  width: 30%;
  text-align: center;
}
.leaderboard .initials {
  width: 35%;
  text-align: center;
}

.leaderboard td.initials {
  text-transform: uppercase;
}

.leaderboard .time {
  width: 35%;
  text-align: center;
}

.pause-overlay,
  .game-over-overlay,
  .start-game-overlay {
      position: absolute;
      top: 0px;
      left: 0px;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      color: white;
      font-size: 1.2rem;
      z-index: 10;
      user-se1lect: none;  /* Prevent text selection */
      -webkit-user-select: none;
      -ms-user-select: none;
      -moz-user-select: none;
      -webkit-tap-highlight-color: transparent; /* Remove tap highlight on touch devices */
}

  .start-game-overlay p,
  .start-game-overlay p,
  .game-over-overlay p.start_over {
    margin-bottom: 40px;
  }

  div.game-over-overlay button,
  div.start-game-overlay button,
  div.start-game-overlay button,
  div.pause-overlay button,
  div.buttons button {
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
    margin-left: 15px;
    margin-right: 15px;
    letter-spacing: 1px;
    user-select: none;  /* Prevent text selection */
    -webkit-user-select: none;
    -ms-user-select: none;
    -moz-user-select: none;
  }

  .pause-overlay p.pause_title,
  .game-over-overlay p.game_over_message {
    margin-bottom: 50px;
  }

  .game-over-overlay .leaderboard {
      margin-top: 50px;
    }

  .hide {
  display: none;
  }


  @media (max-width: 800px) {
  .container {
    width: 100%;
    flex-direction: column; /* Stack the columns on smaller screens */
    padding: 0;
    margin: 0;
  }

  .left-column,
  .right-column {
    flex: 0 1 auto; 
    display: flex;
    flex-direction: column; /* Stack content vertically */
    /*justify-content: center;*/ /* Center content vertically */
    align-items: center; /* Center content horizontally */
    padding: 0;
  }

  .level {
    margin: 0;
    margin-left: 3px;
  }

  .game-wrapper {
    width: 100%;
  }


}


</style>
