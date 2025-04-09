<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import GameBoard from './GameBoard.svelte';
    import { battleshipConfig, type GameIdLetter } from '$lib/config/battleshipConfig';
    import { battleshipApi, type GameState, type Ship } from '$lib/services/battleshipServices';
    import { createEventDispatcher } from 'svelte';
    import { getLocalizedText, loadTexts, activeLanguage } from '$lib/stores/translatedTexts.js';
    import { soundManager } from '$lib/services/soundManager';

    const pageTexts = 'battleship';
    let isLoadingTexts = true;

    async function fetchTexts() {
        isLoadingTexts = true;
        await loadTexts(pageTexts);
        isLoadingTexts = false;
    }

    $: $activeLanguage, fetchTexts();

    const dispatch = createEventDispatcher();

    export let username: string = "Player";
    export let gameState: GameState | null = null;

    let gameId = gameState?.gameId;
   
    let opponentReady = false;
    let playerReady = false;
    let gameActive = false;
    let playerMessage = '';
    let opponentMessage = '';
    let gameOver = false;
    let lastGameResult: 'win' | 'loss' | 'retreated' | null = null;
    let countdownIntervalId: number | null = null;
    let timeRemaining: number = 0;
    let emojiSequence: string[] = [];
    let waitingForOpponent = false;
    let gameWentAway = false;

    let lastMoveSeen = 0;

    // Add modal state variables
    let gameModalActive = false;
    let gameModalType: 'setup' | 'start' | 'turn' | null = null;
    let gameModalTimeout: number | null = null;
    let setupModalDisplayed = false;

    // Add sound state
    let musicEnabled = true;
    let soundEffectsEnabled = true;
    let soundInitialized = false;

    // Generate emoji sequence from game ID
    $: {
        if (gameState?.gameId && gameState.status === 'waiting_for_opponent') {
            emojiSequence = gameState.gameId.split('').map(letter => 
                battleshipConfig.gameIdEmojis[letter as GameIdLetter]
            );
            waitingForOpponent = true;
        } else {
            waitingForOpponent = false;
            if (gameState?.status === 'setup' && !opponentReady && playerReady) {
                playerMessage = getLocalizedText(pageTexts, "waiting_opponent_ships");
            } else if (gameState?.status === 'setup' && !playerReady) {
                playerMessage = getLocalizedText(pageTexts, "start_game_message");
            }
        }
    }

    $: {
        if (gameState?.mode === 'multiplayer' && gameState.status === 'waiting_for_opponent' && !pollingInterval) {
            startPolling();
        }
    }

    $: {
        if (gameState?.mode === 'multiplayer' && gameState.status === 'setup' && pollingInterval && !playerReady) {
            stopPolling();
        }
    }

    $: {
        if (!setupModalDisplayed && gameState?.status === 'setup') {
            showGameModal('setup');
            setupModalDisplayed = true;
        }
    }

    let pollingInterval: number | null = null;
    // Add variables to track polling failures
    let pollingFailures = 0;
    let pollingFailureStartTime: number | null = null;
    let isSlowPolling = false;
    
    // Add board switching delay variables
    let boardSwitchDelayActive = false;
    let boardSwitchTimer: number | null = null;
    let lastTurn: string | null = null;
    
    // Add game over delay timer and victory message
    let gameOverDelayTimer: number | null = null;
    let victoryMessage: string | null = null;
    
    // Add board order tracking - with delay logic
    $: {
        if (gameState?.currentTurn && !boardSwitchDelayActive) {
            lastTurn = gameState.currentTurn;
        }
    }
    $: boardOrder = boardSwitchDelayActive && lastTurn !== gameState?.currentTurn 
        ? (lastTurn === username ? 'opponent-first' : 'player-first')
        : (gameState?.currentTurn === username ? 'opponent-first' : 'player-first');
    
    // Component references
    let playerBoardComponent: GameBoard;

    
    // Helper function to get ship name from prefix
    function getShipNameFromPrefix(prefix: string): string {
        for (const [type, details] of Object.entries(battleshipConfig.shipTypes)) {
            if (details.prefix === prefix) {
                const shipTypeTranslations = battleshipConfig.shipTypeTranslations[type as keyof typeof battleshipConfig.shipTypeTranslations];
                const activeLanguage = $activeLanguage;
                return shipTypeTranslations[activeLanguage as keyof typeof shipTypeTranslations] || shipTypeTranslations.en;
            }
        }
        return "Ship";
    }
    
    // Helper function to get ship name from ID
    function getShipNameFromId(shipId: string | undefined): string {
        if (!shipId) return "Ship";
        const prefix = shipId.charAt(0);
        return getShipNameFromPrefix(prefix);
    }

    function startPolling() {
        if (!gameId) return;
        
        // Determine polling interval based on failure state
        const pollingDelay = isSlowPolling ? 2000 : 500; // 2 seconds if in slow mode, 0.5 seconds normally
        
        // Poll at the determined interval
        pollingInterval = window.setInterval(async () => {
            try {
                const response = await battleshipApi.getGameState(gameId!, username);
                if (response.status === 'success') {
                    // Reset failure tracking on successful poll
                    pollingFailures = 0;
                    pollingFailureStartTime = null;
                    isSlowPolling = false;
                    handleGameStateUpdate(response.gameState);
                }
            } catch (error) {
                // Handle polling failure
                pollingFailures++;

                // Start tracking time on first failure
                if (pollingFailureStartTime === null) {
                    pollingFailureStartTime = Date.now();
                }
                
                // Check if we've been failing for more than 1 minute
                const failingForTooLong = pollingFailureStartTime && 
                                         (Date.now() - pollingFailureStartTime > 60000); // 1 minute
                
                if (failingForTooLong) {
                    // Stop polling and show game went away message
                    gameWentAway = true;
                    stopPolling();
                    console.error('Polling failed for over a minute, stopped polling:', error);
                } else if (!isSlowPolling) {
                    // Switch to slow polling after first failure
                    isSlowPolling = true;
                    stopPolling(); // Clear current interval
                    startPolling(); // Restart with new interval
                    console.warn('Polling failed, switching to slow polling mode:', error);
                } else {
                    // Continue in slow polling mode
                    console.error('Polling failed in slow mode:', error);
                }
            }
        }, pollingDelay);
    }


    function showGameModal(type: 'setup' | 'start' | 'turn') {
        // Set timer based on modal type - match turn modal with boardSwitchDelay timing
        const timer = type === 'setup' ? 2000 : 
                      type === 'turn' ? 1500 : // Changed from 1000 to 1500 to match boardSwitchDelay
                      2000;

        // Set the modal type
        gameModalType = type;
        gameModalActive = true;
        
        // Clear any existing timeout
        if (gameModalTimeout) {
            clearTimeout(gameModalTimeout);
        }
        
        // Set a new timeout to hide the modal after duration
        gameModalTimeout = window.setTimeout(() => {
            gameModalActive = false;
            gameModalTimeout = null;
        }, timer);
    }

    // Function to delay board switching
    function activateBoardSwitchDelay() {
        // Clear any existing timers first
        clearBoardSwitchDelay();
        
        // Set delay active
        boardSwitchDelayActive = true;
        
        // Set timeout to disable delay after 1.5 seconds
        boardSwitchTimer = window.setTimeout(() => {
            boardSwitchDelayActive = false;
            boardSwitchTimer = null;
        }, 1500); // 1.5 second delay
    }
    
    // Show turn modal with an optional delay
    function showDelayedTurnModal(type: 'setup' | 'start' | 'turn', delay: number = 0) {
        setTimeout(() => {
            showGameModal(type);
        }, delay);
    }

    function handleGameStateUpdate(newState: GameState) {
        // Track if turn changed
        const turnChanged = gameState?.currentTurn !== newState.currentTurn;
        
        // Update game state
        gameState = newState;
        
        // Get opponent's initials
        const opponent = newState.players.find(player => player !== username);

        // Update game status based on state
        switch (newState.status) {
            case 'waiting_for_opponent':
                playerMessage = getLocalizedText(pageTexts, "waiting_opponent_join");
                opponentMessage = "";
                gameActive = false;
                waitingForOpponent = true;
                break;
            case 'setup':
                // Start background music when entering setup mode
                if (soundInitialized) {
                    soundManager.startBackgroundMusic();
                }
                break;
            case 'active':
                opponentReady = true;
                
                // Used to determine if we may want to show a modal message
                const isNewMove = newState.moves.length > lastMoveSeen;
                lastMoveSeen = newState.moves.length;
                
                // Get the last move to determine the message
                const lastMove = newState.moves[newState.moves.length - 1];
                if (lastMove) {
                    let pMessage = '';
                    let oMessage = '';
                    
                    // Play sound effects for the last move if it's new
                    if (isNewMove && soundInitialized) {
                        // Play the appropriate sound effect based on the result
                        if (lastMove.result === 'miss') {
                            soundManager.playSound('missed');
                        } else if (lastMove.result === 'hit') {
                            soundManager.playSound('hit');
                        } else if (lastMove.result === 'sunk') {
                            soundManager.playSound('sinking');
                        }
                    }
                    
                    if (lastMove.playerId === username) {
                        // Player's move
                        if (lastMove.result === 'miss') {
                            oMessage = getLocalizedText(pageTexts, "you_missed");
                        } else if (lastMove.result === 'hit') {
                            oMessage = getLocalizedText(pageTexts, "you_hit");
                        } else if (lastMove.result === 'sunk') {
                            const shipName = getShipNameFromId(lastMove.shipId ?? undefined);
                            oMessage = getLocalizedText(pageTexts, "you_sunk").replace("{0}", opponent || "").replace("{1}", shipName);
                        }
                        
                        
                        if (!newState.bonusShotActive) {
                            pMessage = getLocalizedText(pageTexts, "opponent_turn").replace("{0}", opponent || "");
                        }

                        if (isNewMove) {
                            playerMessage = pMessage;
                            opponentMessage = oMessage;
                        }
                    } else {
                        // Opponent's move
                        if (lastMove.result === 'miss') {
                            pMessage = getLocalizedText(pageTexts, "opponent_missed").replace("{0}", opponent || "");
                        } else if (lastMove.result === 'hit') {
                            pMessage = getLocalizedText(pageTexts, "opponent_hit").replace("{0}", opponent || "");
                        } else if (lastMove.result === 'sunk') {
                            const shipName = getShipNameFromId(lastMove.shipId ?? undefined);
                            pMessage = getLocalizedText(pageTexts, "opponent_sunk").replace("{0}", opponent || "").replace("{1}", shipName);
                        }
                        
                        if (!newState.bonusShotActive) {
                            oMessage = getLocalizedText(pageTexts, "your_turn");
                        }

                        if (isNewMove) {
                            playerMessage = pMessage;
                            opponentMessage = oMessage;
                        }       
                    }                    
                } else {                    
                    playerMessage = "";
                    opponentMessage = "";
                    const opponent = gameState.players.find(player => player !== username) || '';
                    if (gameState.currentTurn === username) {
                        opponentMessage = getLocalizedText(pageTexts, "your_turn");
                        playerMessage = "";
                    } else {
                        playerMessage = getLocalizedText(pageTexts, "opponent_turn").replace("{0}", opponent);
                    }
                }
                gameActive = true;
                
                // If turn changed and we're in active game, activate board switch delay
                if (turnChanged && gameActive && !newState.bonusShotActive) {

                    // Check if this is the first turn (no moves made yet)
                    const isFirstTurn = !newState.moves || newState.moves.length === 0;
                    
                    if (isFirstTurn) {
                        showGameModal('start');
                    } else {    
                        // Add a small delay before showing turn modal to sync with board switch
                        activateBoardSwitchDelay();
                        // Use 200ms delay to allow the board switch animation to start first
                        showDelayedTurnModal('turn', 1500);
                    }
                }
                
                break;
            case 'player_won':
                playerMessage = "";
                opponentMessage = getLocalizedText(pageTexts, "you_won");
                lastGameResult = 'win';
                victoryMessage = getLocalizedText(pageTexts, "congratulations");
                
                // Clear existing timer if any
                if (gameOverDelayTimer) {
                    clearTimeout(gameOverDelayTimer);
                }

                soundManager.playSound('sinking');
                
                // Set 1-second delay before showing game over screen
                gameOverDelayTimer = window.setTimeout(() => {
                    gameOver = true;
                    gameOverDelayTimer = null;

                    // Stop background music when game is over
                    if (soundInitialized) {
                        soundManager.stopBackgroundMusic();
                    }                    

                }, 2000);                

                stopPolling();
                clearBoardSwitchDelay();
                
                break;
            case 'opponent_won':
                playerMessage = "";
                opponentMessage = getLocalizedText(pageTexts, "you_lost");
                lastGameResult = 'loss';
                
                // Clear existing timer if any
                if (gameOverDelayTimer) {
                    clearTimeout(gameOverDelayTimer);
                }
                
                // Set 1-second delay before showing game over screen
                gameOverDelayTimer = window.setTimeout(() => {
                    gameOver = true;
                    gameOverDelayTimer = null;
                }, 1000);
                
                stopPolling();
                clearBoardSwitchDelay();
                
                // Stop background music when game is over
                if (soundInitialized) {
                    soundManager.stopBackgroundMusic();
                }
                
                break;
            case 'retreated':
                gameOver = true;
                playerMessage = "";
                opponentMessage = "";
                lastGameResult = 'retreated';

                stopPolling();
                clearBoardSwitchDelay();
                
                // Stop background music when game is over
                if (soundInitialized) {
                    soundManager.stopBackgroundMusic();
                }
                
                break;
        }

        // Handle bonus shot timer
        if (newState.bonusShotActive && newState.status === 'active') {
            startBonusShotTimer(newState.lastMoveTime);
        } else {
            clearBonusShotTimer();
        }
    }
    
    // Function to clear board switch delay
    function clearBoardSwitchDelay() {
        if (boardSwitchTimer) {
            clearTimeout(boardSwitchTimer);
            boardSwitchTimer = null;
        }
        boardSwitchDelayActive = false;
    }

    function startBonusShotTimer(lastMoveTime: number) {
        clearBonusShotTimer();
        
        const timeElapsed = Date.now() - lastMoveTime;
        timeRemaining = Math.max(0, battleshipConfig.bonusShotTimeout - timeElapsed);
        
        countdownIntervalId = window.setInterval(() => {
            timeRemaining = Math.max(0, timeRemaining - 1000);
            if (timeRemaining === 0) {
                timeoutBonusShot();
            }
        }, 1000);
    }
    
    function clearBonusShotTimer() {
        if (countdownIntervalId) {
            clearInterval(countdownIntervalId);
            countdownIntervalId = null;
        }
        timeRemaining = 0;
    }

    async function timeoutBonusShot() {
        if (!gameId) return;
        try {
            await battleshipApi.timeoutBonusShot(gameId, username);
        } catch (error) {
            console.error('Failed to timeout bonus shot:', error);
        }
    }

    
    function stopPolling(connectionLost = false) {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
            
            // Set gameWentAway to true if connection was lost
            if (connectionLost) {
                gameWentAway = true;
            }
        }
    }
    
    async function handlePlayerReady(event: CustomEvent) {
        if (!gameId || !gameState) return;
        
        try {
            const { shipGrid, ships } = event.detail;
            const response = await battleshipApi.placeFleet(gameId, username, shipGrid, ships);
            
            if (response.status === 'success') {
                playerReady = true;
                opponentMessage = "";
                playerMessage = "";
                if (response.message === 'true') {
                    if (gameState.currentTurn === username) {
                        opponentMessage = getLocalizedText(pageTexts, "your_turn");
                    } else {
                        const opponent = gameState.players.find(player => player !== username) || '';
                        playerMessage = getLocalizedText(pageTexts, "opponent_turn").replace("{0}", opponent);
                    }
                } else {
                    playerMessage = getLocalizedText(pageTexts, "waiting_opponent_ships");
                }
                
                // Start polling only after fleet is placed
                startPolling();
            }
        } catch (error) {
            console.error('Failed to place fleet:', error);
            playerMessage = 'Failed to place fleet. Please try again.';
            opponentMessage = "";
        }
    }

    async function handleRetreat() {
        if (!gameId || !gameState) return;
        try {
            const response = await battleshipApi.retreat(gameId, username);
        } catch (error) {
            console.error('Failed to retreat:', error);
        }
    }

    async function handleAbortGame() {
        if (!gameId || !gameState) return;
            stopPolling();
            clearBonusShotTimer();
            clearBoardSwitchDelay();

            // Dispatch event to parent component
            dispatch('done', { winStreak: 0 });
    }
    

    async function handleFireShot(event: CustomEvent<any>) {
        if (!gameId || !gameState || gameState.currentTurn !== username) return;
        
        const { position } = event.detail;
        

        try {
            const response = await battleshipApi.fire(gameId, username, position);

            if (response.status === 'error' && response.message) {
                opponentMessage = response.message;
                playerMessage = "";
                return;
            }

            // Add sound effects for shots
            if (soundInitialized && soundEffectsEnabled) {
                // Play shot sound when player fires
                //soundManager.playSound('shot');
            }
        } catch (error) {
            console.error('Failed to fire shot:', error);
            opponentMessage = 'Failed to fire shot. Please try again.';
            playerMessage = "";
            return;
        }
    }
    
    async function handleRematch() {
        try {
            stopPolling(); // Stop polling first to avoid race conditions
            clearBoardSwitchDelay(); // Clear any active board switch delay
            
            // Reset game state variables
            gameOver = false;
            playerReady = false;
            opponentReady = false;
            gameActive = false;
            lastGameResult = null;
            victoryMessage = null;
            setupModalDisplayed = false;
            
            // Call re-match API
            try {
                const response = await battleshipApi.reMatch(gameId!, username);

                if (response.status === 'success' && response.gameState) {
                    // Update game state with the new state from server
                    gameState = response.gameState;
                    
                    // Update game message
                    //playerMessage = getLocalizedText(pageTexts, "start_game_message");
                    //opponentMessage = "";
                } else {
                    gameWentAway = true;
                }
            } catch (error) {
                gameWentAway = true;
                console.error('Failed to re-match:', error);
            }

        } catch (error) {
            console.error('Failed to restart game:', error);
            playerMessage = 'Failed to restart game. Please try again.';
            opponentMessage = "";
        }
    }
    
    async function handleDone() {
        clearBonusShotTimer();
        clearBoardSwitchDelay();
        stopPolling();
        const playerWinStreak = gameState?.winStreaks?.[username] || 0;
        dispatch('done', { winStreak: playerWinStreak });
    }

    function handleGameTerminated() {
        clearBonusShotTimer();
        clearBoardSwitchDelay();
        stopPolling();
        dispatch('done', { winStreak: 0 });
    }

    // Initialize sound manager when component mounts
    onMount(async () => {
        if (!soundInitialized) {
            await soundManager.initialize();
            soundInitialized = true;
            musicEnabled = soundManager.isMusicOn();
            soundEffectsEnabled = soundManager.isSoundEffectsOn();
        }
    });

    // Add reactive statement to start music only when game enters setup phase
    $: {
        if (soundInitialized && gameState?.status === 'setup') {
            soundManager.startBackgroundMusic();
        }
    }

    // Toggle sound functions
    function toggleMusic() {
        musicEnabled = soundManager.toggleMusic();
    }
    
    function toggleSoundEffects() {
        soundEffectsEnabled = soundManager.toggleSoundEffects();
    }

    onDestroy(() => {
        stopPolling();
        clearBonusShotTimer();
        clearBoardSwitchDelay();
        
        // Clear game over timer if exists
        if (gameOverDelayTimer) {
            clearTimeout(gameOverDelayTimer);
            gameOverDelayTimer = null;
        }

        // Clear modal timeout if exists
        if (gameModalTimeout) {
            clearTimeout(gameModalTimeout);
            gameModalTimeout = null;
        }
        
        // Stop background music when component is destroyed
        if (soundInitialized) {
            soundManager.stopBackgroundMusic();
        }
    });
</script>

{#if !isLoadingTexts}
<div class="battleship-game">

    <div class="game-wrapper">

        <div class="game-header">

            <div class="game-info">

                {#if gameState?.winStreaks?.[username] && gameState?.winStreaks?.[username] > 0}
                    <span class="game-win-streak">
                        {getLocalizedText(pageTexts, "win_streak")}: {gameState?.winStreaks?.[username]}
                    </span>
                {/if}                

                <span class="game-mode">
                {#if gameState?.mode === 'multiplayer'}
                    {getLocalizedText(pageTexts, "multiplayer")}
                {:else}
                    {#if gameState?.config?.cpuDifficulty === 'easy'}
                        {getLocalizedText(pageTexts, "cpu_opponent")}    
                    {:else if gameState?.config?.cpuDifficulty === 'hard'}
                        {getLocalizedText(pageTexts, "advanced_ai_bot")}
                    {/if}
                {/if}
                </span>
            </div>            
        
            <div class="sound-controls">
                <button class="sound-button" on:click={toggleSoundEffects} title={getLocalizedText(pageTexts, "toggle_sound_effects")}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        {#if soundEffectsEnabled}
                            <!-- 7-point asymmetric cartoon "Capow!" explosion -->
                            <polygon points="12 2, 13.5 6.5, 19 5, 16 10, 21 12, 16 14.5, 18 20, 12 17.5, 6 20, 8 14, 3 12, 8 10, 5 5.5, 10.5 6.5"></polygon>
                        {:else}
                            <!-- 7-point asymmetric cartoon "Capow!" explosion with slash -->
                            <polygon points="12 2, 13.5 6.5, 19 5, 16 10, 21 12, 16 14.5, 18 20, 12 17.5, 6 20, 8 14, 3 12, 8 10, 5 5.5, 10.5 6.5"></polygon>
                            <line x1="2" y1="2" x2="22" y2="22"></line>
                        {/if}
                    </svg>
                    
                </button>
                <button class="sound-button" on:click={toggleMusic} title={getLocalizedText(pageTexts, "toggle_music")}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        {#if musicEnabled}
                            <!-- Music note -->
                            <path d="M9 18V5l12-2v13"></path>
                            <circle cx="6" cy="18" r="3"></circle>
                            <circle cx="18" cy="16" r="3"></circle>
                        {:else}
                            <!-- Music note with slash -->
                            <path d="M9 18V5l12-2v13"></path>
                            <circle cx="6" cy="18" r="3"></circle>
                            <circle cx="18" cy="16" r="3"></circle>
                            <line x1="2" y1="2" x2="22" y2="22"></line>
                        {/if}
                    </svg>
                </button>
            </div>
        </div>

        
        <div class="game-boards {boardOrder}">
            {#if gameId && gameState}

                
                <div class="board-container player-board">
                    <GameBoard
                        bind:this={playerBoardComponent}
                        {username}
                        {gameState}
                        isReady={playerReady}
                        on:ready={handlePlayerReady}
                        on:retreat={handleRetreat}
                        showTurnOverlay={boardOrder !== 'player-first'}
                        timeRemaining={gameState.currentTurn !== username ? timeRemaining : 0}
                        gameMessage={playerMessage}
                    />
                </div>
            
                {#if gameState.players && gameState.players.length > 1 && opponentReady}
                <div class="board-container opponent-board">
                    {#if gameState.players && gameState.players.length > 1}
                        {@const opponent = gameState.players.find(player => player !== username) || ''}
                        <GameBoard
                            username={opponent}
                            {gameState}
                            isOpponent={true}
                            isReady={opponentReady}
                            showBoard={playerReady && opponentReady}
                            on:fire={handleFireShot}
                            showTurnOverlay={boardOrder !== 'opponent-first'}
                            timeRemaining={gameState.currentTurn !== opponent ? timeRemaining : 0}
                            gameMessage={opponentMessage}
                        />
                    {/if}
                </div>
                {/if}
            {/if}
        </div>
    </div>
    
    {#if gameModalActive && gameState}
        {@const opponent = gameState.players.find(player => player !== username) || ''}
        {@const isPlayerTurn = gameState.currentTurn === username}
        {@const playerColor = isPlayerTurn ? '#3498db' : '#e94560'}
        <div class="game-modal-overlay"
                    on:mousedown|stopPropagation
                    on:touchstart|stopPropagation
                    on:click|stopPropagation
                    on:contextmenu|preventDefault>
            <div class="game-modal">
                {#if gameModalType === 'turn'}
                    <div class="turn-indicator" style="color: {playerColor}">
                        {isPlayerTurn ? 
                            getLocalizedText(pageTexts, "your_turn") : 
                            getLocalizedText(pageTexts, "opponent_turn").replace("{0}", opponent)}
                    </div>
                {:else if gameModalType === 'setup'}
                    <div class="modal-message" style="color: {playerColor}">
                        {getLocalizedText(pageTexts, "start_game_message")}
                    </div>
                {:else if gameModalType === 'start'}
                    <div class="modal-message" style="color: {playerColor}">
                        {getLocalizedText(pageTexts, "game_starting")} <br />
                        {gameState.currentTurn === username ? getLocalizedText(pageTexts, "your_turn") : getLocalizedText(pageTexts, "opponent_turn").replace("{0}", opponent)}
                    </div>
                {/if}
            </div>
        </div>
    {/if}
    
    {#if waitingForOpponent && emojiSequence.length > 0}
        <div class="waiting-modal"
                    on:mousedown|stopPropagation
                    on:touchstart|stopPropagation
                    on:click|stopPropagation
                    on:contextmenu|preventDefault>
            <div class="modal-content">
                <h2>{getLocalizedText(pageTexts, "waiting_opponent_join_message")}</h2>
                <p>{getLocalizedText(pageTexts, "share_emoji_sequence")}</p>
                
                <div class="emoji-sequence">
                    {#each emojiSequence as emoji}
                        <span class="emoji">{emoji}</span>
                    {/each}
                </div>
                
                <button class="abort-button" on:click={handleAbortGame}>
                    {getLocalizedText(pageTexts, "abort_game")}
                </button>
            </div>
        </div>
    {/if}
    
    {#if gameWentAway}
        <div class="game-terminated-modal"
                    on:mousedown|stopPropagation
                    on:touchstart|stopPropagation
                    on:click|stopPropagation
                    on:contextmenu|preventDefault>
            <div class="modal-content">
                <h2>{getLocalizedText(pageTexts, "game_terminated") || "Game Terminated"}</h2>
                <p>{getLocalizedText(pageTexts, "game_terminated_message") || "The connection to the game has been lost."}</p>
                
                <div class="error-icon">❌</div>
                
                <button class="restart-button" on:click={handleGameTerminated}>
                    {getLocalizedText(pageTexts, "return_to_menu") || "Return to Menu"}
                </button>
            </div>
        </div>
    {/if}
    
    {#if gameOver}
        <div class="game-over-actions">
            <div class="dialog-content">
                <h2>{getLocalizedText(pageTexts, "done_battling")}</h2>
                {#if victoryMessage}
                    <p class="victory-message">{victoryMessage}</p>
                {/if}
                <div class="dialog-actions">
                    <button class="rematch-button" on:click={handleRematch}>
                        {getLocalizedText(pageTexts, "rematch")}
                    </button>
                    <button class="done-button" on:click={handleDone}>
                        {getLocalizedText(pageTexts, "im_done")}
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>
{/if}

<style>
    .battleship-game {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
        margin-bottom: 2rem;
    }
        
    .board-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
    }
    
    .game-boards {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .game-boards:has(> .board-container:nth-child(2)) {
        gap: 3rem;
    }
    
    .waiting-modal, .game-terminated-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: rgba(0, 0, 0, 0.8);
        z-index: 1000;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        pointer-events: auto;
    }

    .game-terminated-modal .modal-content {
        border: 2px solid #e74c3c;
    }

    .error-icon {
        font-size: 4rem;
        color: #e74c3c;
        margin: 1rem 0;
        animation: pulse 1.5s infinite;
    }

    .modal-content {
        background-color: #1b263b;
        padding: 2rem;
        border-radius: 10px;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
        max-width: 400px;
        width: 90%;
        text-align: center;
    }

    .modal-content h2 {
        color: #e0e1dd;
        margin: 0 0 1rem 0;
        font-size: 1.5rem;
    }

    .modal-content p {
        color: #e0e1dd;
        margin-bottom: 1rem;
        font-size: 0.9rem;
    }

    .emoji-sequence {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        margin: 1.5rem 0;
        font-size: 2.5rem;
    }

    .emoji {
        display: inline-block;
        animation: bounce 2s infinite;
    }

    @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
    }

    .game-id {
        text-align: center;
        font-family: monospace;
        font-size: 1.2rem;
        color: #3498db;
        margin: 1rem 0;
    }

    .abort-button {
        background-color: #e74c3c;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 5px;
        font-size: 1rem;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-top: 1rem;
    }

    .abort-button:hover {
        filter: brightness(90%);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }
    
    .game-over-actions {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 2rem;
        background-color: rgba(0, 0, 0, 0.8);
        z-index: 1000;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        pointer-events: auto;
    }

    .dialog-content {
        background-color: #1b263b;
        padding: 2rem;
        border-radius: 10px;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
        max-width: 400px;
        width: 90%;
        text-align: center;
    }

    .dialog-content h2 {
        color: #e0e1dd;
        margin: 0 0 1.5rem 0;
        font-size: 1.5rem;
    }

    .victory-message {
        color: #f1c40f;
        font-size: 1.2rem;
        font-weight: bold;
        margin-bottom: 1.5rem;
        animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
        0% { opacity: 0.7; }
        50% { opacity: 1; }
        100% { opacity: 0.7; }
    }

    .dialog-actions {
        display: flex;
        justify-content: center;
        gap: 1rem;
    }
    
    .rematch-button, .done-button {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 5px;
        font-size: 1rem;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .rematch-button {
        background-color: #0b5d0b;
        color: white;
    }
    
    .rematch-button:hover {
        filter: brightness(90%);
        transform: translateY(-2px);
        box-shadow: 0 6px 8px rgba(0, 0, 0, 0.2);
    }
    
    .done-button {
        background-color: #e13e59;
        color: white;
    }
    
    .done-button:hover {
        filter: brightness(90%);
        transform: translateY(-2px);
        box-shadow: 0 6px 8px rgba(0, 0, 0, 0.2);
    }
    
    @media (min-width: 1200px) {
        .game-boards {
            flex-direction: row;
            justify-content: center;
            align-items: flex-start;
        }

        .game-boards:has(> .board-container:nth-child(2)) {
            gap: 2rem;
        }
    }

    @media (max-width: 1200px) {
        .game-boards.player-first .player-board {
            order: 1;
        }
        .game-boards.player-first .opponent-board {
            order: 2;
        }
        .game-boards.opponent-first .player-board {
            order: 2;
        }
        .game-boards.opponent-first .opponent-board {
            order: 1;
        }
    }

    @media (min-width: 1200px) {
        .game-boards {
            flex-direction: row;
            justify-content: center;
            align-items: flex-start;
        }

        .game-boards:has(> .board-container:nth-child(2)) {
            gap: 2rem;
        }
                
        /* Reset order for desktop */
        .game-boards .player-board,
        .game-boards .opponent-board {
            order: 0;
        }
    }

    .restart-button {
        background-color: #3498db;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 5px;
        font-size: 1rem;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-top: 1rem;
    }

    .restart-button:hover {
        filter: brightness(90%);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }

    /* Game Modal Styles */
    .game-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.95);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1500;
        animation: fadeIn 0.3s ease-out;
        animation-delay: 0.3s;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        pointer-events: auto;
    }

    .game-modal {
        background-color: transparent;
        border-radius: 10px;
        padding: 2rem;
        max-width: 90%;
        width: 85%;
        max-width: 800px;
        text-align: center;
        position: relative;
        text-shadow: 0 0 8px rgba(0, 0, 0, 0.8);
    }

    .modal-message,
    .turn-indicator {
        font-size: 2.8rem;
        font-weight: bold;
        margin-top: 1rem;
        text-shadow: 0 0 20px currentColor;
        letter-spacing: 2px;
        animation: actionZoom 1.5s ease-out;
    }

    .modal-message {
        animation: textPulseZoom 2s ease-out;
    }

    @keyframes fadeIn {
    }

    @keyframes modalZoom {
        0% { transform: scale(0.8); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
    }

    @keyframes textPulseZoom {
        0% { transform: scale(0.95); }
        50% { transform: scale(1.05); }
        100% { transform: scale(0.95); }
    }

    @keyframes actionZoom {
        0% { transform: scale(0.95); }
        50% { transform: scale(1.05); }
        100% { transform: scale(0.95); }
    }

    @media (max-width: 768px) {
        .game-modal {
            width: 85%;
            padding: 1.5rem;
        }
        
        .modal-message {
            font-size: 1.4rem;
        }
        
        .turn-indicator {
            font-size: 2rem;
        }
    }
    
    .game-wrapper {
        margin: 0 auto;
        pointer-events: auto;
    }

    .game-wrapper:has(> .game-modal-overlay),
    .game-wrapper:has(> .waiting-modal),
    .game-wrapper:has(> .game-terminated-modal),
    .game-wrapper:has(> .game-over-actions) {
        pointer-events: none;
    }

    .game-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        min-height: 30px;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .game-header .game-mode {
        display: block;
        font-size: 0.9rem;
        font-weight: bold;
        text-align: left;
    }

    .game-header .game-win-streak {
        display: block;
        font-size: 1rem;
        font-weight: bold;
        text-align: left;
    }

    .sound-controls {
        display: flex;
        justify-content: right;
        gap: 10px;
    }
    
    .sound-button {
        background-color: #1b263b;
        color:#e0e1dd;
        border: 2px solid #e0e1dd;;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        font-size: 1.2rem;
        transition: all 0.3s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    
    .sound-button:hover {
        transform: scale(1.1);
        background-color: #263b53;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    }

    .sound-button svg {
        color: currentColor;
        width: 22px;
        height: 22px;
    }
</style> 