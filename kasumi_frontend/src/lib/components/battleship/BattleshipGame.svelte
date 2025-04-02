<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import GameBoard from './GameBoard.svelte';
    import OpponentBoard from './OpponentBoard.svelte';
    import { battleshipConfig } from '$lib/config/battleshipConfig.js';
    import { battleshipApi, type GameState, type Ship } from '$lib/services/battleshipServices';
    import { goto } from '$app/navigation';

    export let username: string = "Player";
    export let gameId: string | null = null;
    
    let gameState: GameState | null = null;
    let opponentReady = false;
    let playerReady = false;
    let gameActive = false;
    $: gameMessage = 'Place your ships on the board';
    let gameOver = false;
    let winningStreak = 0;
    let lastGameResult: 'win' | 'loss' | null = null;
    let countdownIntervalId: number | null = null;
    let timeRemaining: number = 0;
    let pollingInterval: number | null = null;
    
    // Component references
    let opponentBoardComponent: OpponentBoard;
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
        gameState = newState;
        
        // Update game status based on state
        switch (newState.status) {
            case 'waiting_for_opponent':
                gameMessage = 'Waiting for opponent to join...';
                gameActive = false;
                break;
            case 'setup':
                if (!playerReady) {
                    gameMessage = 'Place your ships on the board';
                } else if (!opponentReady) {
                    gameMessage = 'Waiting for opponent to place ships...';
                } else {
                    gameMessage = 'Both players ready! Game starting...';
                }
                gameActive = false;
                break;
            case 'active':
                if (newState.currentTurn === username) {
                    gameMessage = 'Your turn!';
                } else {
                    // Get the last move to determine the message
                    const lastMove = newState.moves[newState.moves.length - 1];
                    if (lastMove) {
                        let message = '';
                        if (lastMove.playerId === username) {
                            // Player's move
                            if (lastMove.result === 'miss') {
                                message = 'You missed!';
                            } else if (lastMove.result === 'hit') {
                                message = 'You hit a ship!';
                            } else if (lastMove.result === 'sunk') {
                                const shipName = getShipNameFromId(lastMove.shipId ?? undefined);
                                message = `You sunk the opponent's ${shipName}!`;
                            }
                            
                            // Add bonus shot message if applicable
                            if (newState.bonusShotActive) {
                                message += ' You have a bonus shot!';
                            } else {
                                message += ' CPU\'s turn!';
                            }
                        } else {
                            // CPU's move
                            if (lastMove.result === 'miss') {
                                message = 'CPU missed!';
                            } else if (lastMove.result === 'hit') {
                                message = 'CPU hit your ship!';
                            } else if (lastMove.result === 'sunk') {
                                const shipName = getShipNameFromId(lastMove.shipId ?? undefined);
                                message = `CPU sunk your ${shipName}!`;
                            }
                            
                            // Add bonus shot message if applicable
                            if (newState.bonusShotActive) {
                                message += ' CPU has a bonus shot!';
                            } else {
                                message += ' Your turn!';
                            }
                        }
                        gameMessage = message;
                    } else {
                        gameMessage = 'CPU\'s turn';
                    }
                }
                gameActive = true;
                // Only update player's board with CPU shots when game is active
                if (newState.playerBoards[username] && playerBoardComponent) {
                    const playerBoard = newState.playerBoards[username];
                    playerBoardComponent.updateBoard(playerBoard.board);
                }
                break;
            case 'player_won':
                gameOver = true;
                gameMessage = 'Congratulations! You won!';
                lastGameResult = 'win';
                winningStreak++;
                stopPolling();
                break;
            case 'opponent_won':
                gameOver = true;
                gameMessage = 'Game Over! You lost!';
                lastGameResult = 'loss';
                winningStreak = Math.max(0, winningStreak - 1);
                stopPolling();
                break;
        }

        // Handle bonus shot timer
        if (newState.bonusShotActive) {
            startBonusShotTimer(newState.lastMoveTime);
        } else {
            clearBonusShotTimer();
        }
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
            const { shipGrid } = event.detail;
            const response = await battleshipApi.placeFleet(gameId, username, shipGrid);
            
            if (response.status === 'success') {
                playerReady = true;
                gameMessage = response.message;
            }
        } catch (error) {
            console.error('Failed to place fleet:', error);
            gameMessage = 'Failed to place fleet. Please try again.';
        }
    }
    
    function handleOpponentReady(event: CustomEvent) {
        opponentReady = true;
    }
    
    async function handleFireShot(event: CustomEvent) {
        if (!gameId || !gameState || gameState.currentTurn !== username) return;
        
        const { position } = event.detail;
        try {
            const response = await battleshipApi.fire(gameId, username, position);
            
            if (response.status === 'success') {
                // Update opponent board with shot result
                if (opponentBoardComponent) {
                    opponentBoardComponent.updateCell(position, response.result, response.shipId);
                }
            }
        } catch (error) {
            console.error('Failed to fire shot:', error);
            gameMessage = 'Failed to fire shot. Please try again.';
        }
    }
    
    async function handleRematch() {
        // Reset game state
        gameState = null;
        opponentReady = false;
        playerReady = false;
        gameActive = false;
        gameOver = false;
        lastGameResult = null;
        
        // Re-match the game
        await battleshipApi.reMatch(gameId!);
        startPolling();

    }
    
    function handleDone() {
        // Submit final score
        if (lastGameResult) {
            battleshipApi.submitScore(username, winningStreak).catch(console.error);
        }
        
        // Reset all game state
        gameState = null;
        gameId = null;
        opponentReady = false;
        playerReady = false;
        gameActive = false;
        gameOver = false;
        lastGameResult = null;
        clearBonusShotTimer();
        stopPolling();
        
        // Navigate back to battleship front page
        goto('/spill/battleship');
    }

    onMount(() => {
        if (gameId) {
            startPolling();
        }
    });

    onDestroy(() => {
        stopPolling();
        clearBonusShotTimer();
    });
</script>

<div class="battleship-game">
    <div class="game-status">
        <h2>{gameMessage}</h2>
        {#if timeRemaining > 0}
            <p class="bonus-shot-timer">Bonus shot: {Math.ceil(timeRemaining / 1000)}s</p>
        {/if}
    </div>
    
    <div class="game-boards">
        <div class="player-board">
            <GameBoard 
                username={username} 
                gameId={gameId || ''}
                on:ready={handlePlayerReady}
                bind:this={playerBoardComponent}
            />
            {#if winningStreak > 0}
                <p class="winning-streak">Win streak: {winningStreak}</p>
            {/if}
        </div>
        
        {#if playerReady}
            <div class="opponent-board">
                <OpponentBoard 
                    isCPU={gameState?.mode === 'cpu'}
                    inPlayMode={gameActive}
                    on:ready={handleOpponentReady}
                    on:fire={handleFireShot}
                    bind:this={opponentBoardComponent}
                    debugMode={battleshipConfig.debugCpuBoard}
                />
            </div>
        {/if}
    </div>
    
    {#if gameOver}
        <div class="game-over-actions">
            <button class="rematch-button" on:click={handleRematch}>
                Re-match
            </button>
            <button class="done-button" on:click={handleDone}>
                I'm done
            </button>
        </div>
    {/if}
</div>

<style>
    .battleship-game {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
    }
    
    .game-status {
        text-align: center;
        margin-bottom: 0rem;
        font-size: 0.8rem;
        color: #e94560;
    }    
    
    .bonus-shot-timer {
        color: #2ecc71;
        font-weight: bold;
        margin-top: 0.5rem;
    }
    
    .winning-streak {
        font-weight: bold;
        color: #2ecc71;
        margin-top: 0.5rem;
        text-align: center;
    }
    
    .game-boards {
        display: flex;
        flex-direction: column;
        gap: 3rem;
        align-items: center;
    }
    
    .game-over-actions {
        display: flex;
        justify-content: center;
        gap: 2rem;
        margin-top: 2rem;
    }
    
    .rematch-button, .done-button {
        padding: 1rem 2rem;
        border: none;
        border-radius: 5px;
        font-size: 1.2rem;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    
    .rematch-button {
        background-color: #2ecc71;
        color: white;
    }
    
    .rematch-button:hover {
        background-color: #27ae60;
    }
    
    .done-button {
        background-color: #e74c3c;
        color: white;
    }
    
    .done-button:hover {
        background-color: #c0392b;
    }
    
    @media (min-width: 1200px) {
        .game-boards {
            flex-direction: row;
            justify-content: center;
            align-items: flex-start;
            gap: 2rem;
        }
    }
</style> 