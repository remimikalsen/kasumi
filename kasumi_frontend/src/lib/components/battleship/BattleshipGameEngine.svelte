<script lang="ts">
    import { onDestroy } from 'svelte';
    import GameBoard from './GameBoard.svelte';
    import { battleshipConfig } from '$lib/config/battleshipConfig.js';
    import { battleshipApi, type GameState, type Ship } from '$lib/services/battleshipServices';
    import { createEventDispatcher } from 'svelte';
    import { getLocalizedText, loadTexts, activeLanguage } from '$lib/stores/translatedTexts.js';

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

    const startGameMessage = getLocalizedText(pageTexts, "start_game_message");

    let gameId = gameState?.gameId;
   
    let opponentReady = false;
    let playerReady = false;
    let gameActive = false;
    $: gameMessage = startGameMessage;
    let gameOver = false;
    let lastGameResult: 'win' | 'loss' | 'retreated' | null = null;
    let countdownIntervalId: number | null = null;
    let timeRemaining: number = 0;
    let pollingInterval: number | null = null;
    
    // Add board switching delay variables
    let boardSwitchDelayActive = false;
    let boardSwitchTimer: number | null = null;
    let lastTurn: string | null = null;
    
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
                return type.charAt(0).toUpperCase() + type.slice(1);
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
        
        // Poll every 0,5 seconds
        pollingInterval = window.setInterval(async () => {
            try {
                const response = await battleshipApi.getGameState(gameId!, username);
                if (response.status === 'success') {
                    handleGameStateUpdate(response.gameState);
                }
            } catch (error) {
                console.error('Failed to poll game state:', error);
            }
        }, 500);
    }

    function handleGameStateUpdate(newState: GameState) {
        // Track if turn changed
        const turnChanged = gameState?.currentTurn !== newState.currentTurn;
        
        // Store old win streak values to detect changes
        const previousWinStreaks = gameState?.winStreaks || {};
        const previousStatus = gameState?.status;
        
        // Update game state
        gameState = newState;
        
        // Get opponent's initials
        const opponent = newState.players.find(player => player !== username);
        
        // Update game status based on state
        switch (newState.status) {
            case 'waiting_for_opponent':
                gameMessage = getLocalizedText(pageTexts, "waiting_opponent_join");
                gameActive = false;
                break;
            case 'setup':
                if (!playerReady) {
                    gameMessage = getLocalizedText(pageTexts, "start_game_message");
                } else if (!opponentReady) {
                    // For CPU games, the CPU is already ready
                    if (newState.mode === 'cpu') {
                        gameMessage = getLocalizedText(pageTexts, "game_starting");
                        opponentReady = true;
                    } else {
                        // Check if opponent has placed their ships
                        if (opponent && newState.playerBoards[opponent]?.ready) {
                            gameMessage = getLocalizedText(pageTexts, "both_ready");
                            opponentReady = true;
                        } else {
                            gameMessage = getLocalizedText(pageTexts, "waiting_opponent_ships");
                        }
                    }
                } else {
                    gameMessage = getLocalizedText(pageTexts, "both_ready");
                }
                gameActive = false;
                break;
            case 'active':
                // For CPU games, ensure opponent is marked as ready when game becomes active
                if (newState.mode === 'cpu') {
                    opponentReady = true;
                }
                
                // Get the last move to determine the message
                const lastMove = newState.moves[newState.moves.length - 1];
                if (lastMove) {
                    let message = '';
                    if (lastMove.playerId === username) {
                        // Player's move
                        if (lastMove.result === 'miss') {
                            message = getLocalizedText(pageTexts, "you_missed");
                        } else if (lastMove.result === 'hit') {
                            message = getLocalizedText(pageTexts, "you_hit");
                        } else if (lastMove.result === 'sunk') {
                            const shipName = getShipNameFromId(lastMove.shipId ?? undefined);
                            // Use template with parameters
                            message = getLocalizedText(pageTexts, "you_sunk").replace("{0}", opponent || "").replace("{1}", shipName);
                        }
                        
                        // Add bonus shot message if applicable
                        if (newState.bonusShotActive) {
                            message += ' ' + getLocalizedText(pageTexts, "bonus_shot");
                        } else {
                            message += ' ' + getLocalizedText(pageTexts, "opponent_turn").replace("{0}", opponent || "");
                        }
                    } else {
                        // Opponent's move
                        if (lastMove.result === 'miss') {
                            message = getLocalizedText(pageTexts, "opponent_missed").replace("{0}", opponent || "");
                        } else if (lastMove.result === 'hit') {
                            message = getLocalizedText(pageTexts, "opponent_hit").replace("{0}", opponent || "");
                        } else if (lastMove.result === 'sunk') {
                            const shipName = getShipNameFromId(lastMove.shipId ?? undefined);
                            message = getLocalizedText(pageTexts, "opponent_sunk").replace("{0}", opponent || "").replace("{1}", shipName);
                        }
                        
                        // Add bonus shot message if applicable
                        if (newState.bonusShotActive) {
                            message += ' ' + getLocalizedText(pageTexts, "opponent_bonus").replace("{0}", opponent || "");
                        } else {
                            message += ' ' + getLocalizedText(pageTexts, "your_turn");
                        }
                    }
                    gameMessage = message;
                } else {
                    gameMessage = newState.currentTurn === username ? 
                        getLocalizedText(pageTexts, "your_turn") : 
                        getLocalizedText(pageTexts, "opponent_turn").replace("{0}", opponent || "");
                }
                
                gameActive = true;
                
                // If turn changed and we're in active game, activate board switch delay
                if (turnChanged && gameActive && !newState.bonusShotActive) {
                    activateBoardSwitchDelay();
                }
                
                break;
            case 'player_won':
                gameOver = true;
                gameMessage = getLocalizedText(pageTexts, "you_won");
                lastGameResult = 'win';
                
                stopPolling();
                clearBoardSwitchDelay();
                break;
            case 'opponent_won':
                gameOver = true;
                gameMessage = getLocalizedText(pageTexts, "you_lost");
                lastGameResult = 'loss';
                
                stopPolling();
                clearBoardSwitchDelay();
                break;
            case 'retreated':
                gameOver = true;
                gameMessage = getLocalizedText(pageTexts, "you_retreated");
                lastGameResult = 'retreated';

                stopPolling();
                clearBoardSwitchDelay();
                break;
        }

        // Handle bonus shot timer
        if (newState.bonusShotActive && newState.status === 'active') {
            startBonusShotTimer(newState.lastMoveTime);
        } else {
            clearBonusShotTimer();
        }
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

    function stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }
    
    async function handlePlayerReady(event: CustomEvent) {
        if (!gameId || !gameState) return;
        
        try {
            const { shipGrid, ships } = event.detail;
            const response = await battleshipApi.placeFleet(gameId, username, shipGrid, ships);
            
            if (response.status === 'success') {
                playerReady = true;
                gameMessage = response.message;
                // Start polling only after fleet is placed
                startPolling();
            }
        } catch (error) {
            console.error('Failed to place fleet:', error);
            gameMessage = 'Failed to place fleet. Please try again.';
        }
    }

    async function handleRetreat() {
        if (!gameId || !gameState) return;
        try {
            const response = await battleshipApi.retreat(gameId, username);
        } catch (error) {
            console.error('Failed to retreat:', error);
            gameMessage = 'Failed to retreat. Please try again.';
        }
    }

    async function handleFireShot(event: CustomEvent) {
        if (!gameId || !gameState || gameState.currentTurn !== username) return;
        
        const { position } = event.detail;
        
        const response = await battleshipApi.fire(gameId, username, position);

        try {
            if (response.status === 'error' && response.message) {
                gameMessage = response.message;
                return;
            }
        } catch (error) {
            console.error('Failed to fire shot:', error);
            gameMessage = 'Failed to fire shot. Please try again.';
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
            
            // Call re-match API
            const response = await battleshipApi.reMatch(gameId!, username);
            
            if (response.status === 'success' && response.gameState) {
                // Update game state with the new state from server
                gameState = response.gameState;
                
                // Update game message
                gameMessage = getLocalizedText(pageTexts, "start_game_message");

            } else {
                throw new Error('Failed to get updated game state');
            }
        } catch (error) {
            console.error('Failed to restart game:', error);
            gameMessage = 'Failed to restart game. Please try again.';
        }
    }
    
    function handleDone() {
        clearBonusShotTimer();
        clearBoardSwitchDelay();
        stopPolling();
        dispatch('done');
    }

    onDestroy(() => {
        stopPolling();
        clearBonusShotTimer();
        clearBoardSwitchDelay();
    });
</script>

{#if !isLoadingTexts}
<div class="battleship-game">

    <div class="game-status {playerReady && opponentReady ? 'game-status-wide' : ''}">

        <h2 class="hq-title">
            {getLocalizedText(pageTexts, "message_hq")}
        </h2>
       
        <div class="game-status-message">
            {gameMessage}
            {#if timeRemaining > 0}
                <span class="bonus-shot-timer">({Math.ceil(timeRemaining / 1000)}s)</span>
            {/if}
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
                />
            </div>
        
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
                    />
                {/if}
            </div>
        {/if}
    </div>
    
    {#if gameOver}
        <div class="game-over-actions">
            <div class="dialog-content">
                <h2>{getLocalizedText(pageTexts, "done_battling")}</h2>
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
    
    .game-status {
        text-align: center;
        margin-top: 1rem;
        margin-bottom: 1rem;
        width: 100%;
        max-width: 420px; /* Match single game board width */
        margin-left: auto;
        margin-right: auto;
    }    
    
    .hq-title {
        font-size: 1rem;
        color: #ecf0f1;
        letter-spacing: 0.5px;
        text-align: left;
        margin: 0;
        margin-bottom: 0rem;
    }

    .game-status-message {
        font-size: 1.2rem;
        color: #ecf0f1;
        font-weight: bold;
        padding: 0.5rem;
        text-align: left;
    }
    

    .bonus-shot-timer {
        color: #2ecc71;
        font-weight: bold;
        margin-left: 0.5rem;
        text-shadow: 0 0 10px rgba(46, 204, 113, 0.3);
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
        gap: 3rem;
        align-items: center;
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
            gap: 2rem;
        }
        .game-status-wide {
            /* When in desktop view and game is active (two boards visible) */
            max-width: 840px; /* 420px * 2 + gap between boards */
        }
    }

    @media (max-width: 1200px) {
        .game-status-wide {
            max-width: 420px; /* 420px * 2 + gap between boards */
        }
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
            gap: 2rem;
        }
        /* Reset order for desktop */
        .game-boards .player-board,
        .game-boards .opponent-board {
            order: 0;
        }
    }
</style> 