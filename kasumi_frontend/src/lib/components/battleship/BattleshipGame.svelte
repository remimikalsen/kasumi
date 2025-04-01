<script lang="ts">
    import { onMount } from 'svelte';
    import GameBoard from './GameBoard.svelte';
    import OpponentBoard from './OpponentBoard.svelte';
    import { battleshipConfig } from '$lib/config/battleshipConfig.js';
    import { cpuGameService, type GameState, type Position, type GameMove } from '$lib/services/battleshipGameService';
    import { goto } from '$app/navigation';

    export let username: string = "Player";
    
    let gameState: GameState | null = null;
    let opponentReady = false;
    let playerReady = false;
    let gameActive = false;
    let gameMessage = 'Place your ships on the board';
    let gameOver = false;
    let winningStreak = 0;
    let lastGameResult: 'win' | 'loss' | null = null;
    let bonusShotTimeoutId: number | null = null;
    let countdownIntervalId: number | null = null;
    let timeRemaining: number = 0;
    
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
    
    onMount(async () => {
        // Create a new game when the component is mounted
        gameState = await cpuGameService.createGame(username);
        
        // Set up a polling interval to check game state for timeout updates
        const intervalId = setInterval(async () => {
            if (gameState && gameActive && !gameOver) {
                const updatedGameState = await cpuGameService.getGameState(gameState.gameId);
                if (updatedGameState.currentTurn !== gameState.currentTurn) {
                    // Turn changed due to timeout
                    gameState = updatedGameState;
                    
                    // Clear any active timers
                    clearBonusShotTimers();
                    
                    // If it's now the opponent's turn, wait for their move
                    if (gameState.currentTurn === 'opponent') {
                        gameMessage = "Your bonus shot timed out! Waiting for opponent...";
                        
                        // Wait for CPU move to complete
                        setTimeout(async () => {
                            await handleCpuMoveCompletion();
                        }, 1500);
                    }
                }
            }
        }, 1000);
        
        // Clean up on component destruction
        return () => {
            clearInterval(intervalId);
            clearBonusShotTimers();
        };
    });
    
    // Helper function to clear both timer and interval
    function clearBonusShotTimers() {
        if (bonusShotTimeoutId) {
            clearTimeout(bonusShotTimeoutId);
            bonusShotTimeoutId = null;
        }
        
        if (countdownIntervalId) {
            clearInterval(countdownIntervalId);
            countdownIntervalId = null;
        }
    }
    
    function handlePlayerReady(event: CustomEvent) {
        if (!gameState) return;
        
        const playerBoard = event.detail;
        playerReady = true;
        
        // Save the player's ships and full board state to the game state
        cpuGameService.placeShips(
            gameState.gameId, 
            playerBoard.ships, 
            playerBoard.board, 
            playerBoard.shipGrid
        ).then(newState => {
            gameState = newState;
            gameActive = true;
            gameMessage = "Game started! Your turn - click on the opponent's board to fire.";
            
            // Sync opponent board with game state
            if (opponentBoardComponent) {
                opponentBoardComponent.syncWithGameState(gameState);
            }

        });
    }
    
    function handleOpponentReady(event: CustomEvent) {
        opponentReady = true;
    }
    
    async function handleFireShot(event: CustomEvent) {
        if (!gameState || !gameActive || gameState.currentTurn !== 'player') return;
        
        const { x, y } = event.detail;
        
        try {
            // Clear any existing timers
            clearBonusShotTimers();
            
            const position: Position = { x, y };
            const move = await cpuGameService.makeMove(gameState.gameId, position);
            
            // Update game state after move
            gameState = await cpuGameService.getGameState(gameState.gameId);
            
            // Sync opponent board with updated game state
            if (opponentBoardComponent) {
                opponentBoardComponent.syncWithGameState(gameState);
            }
            
            // Update game message based on move result
            if (gameState.status === 'player_won') {
                gameOver = true;
                gameActive = false;
                winningStreak++;
                lastGameResult = 'win';
                gameMessage = "Victory! You sunk all enemy ships!";
            } else if (move.result === 'hit' || move.result === 'sunk') {
                // If bonus shots are enabled and it's still player's turn
                if (battleshipConfig.bonusShotWhenHit && gameState.currentTurn === 'player') {
                    if (move.result === 'hit') {
                        gameMessage = "Hit! Fire again!";
                    } else {
                        const shipName = getShipNameFromId(move.shipId);
                        gameMessage = `You sunk their ${shipName}! Fire again!`;
                    }
                    
                    // Set up timeout for bonus shot
                    timeRemaining = battleshipConfig.bonusShotTimeout;
                    updateBonusShotMessage();
                    
                    // Setup countdown for UI
                    countdownIntervalId = setInterval(() => {
                        timeRemaining -= 1000;
                        if (timeRemaining <= 0) {
                            if (countdownIntervalId) {
                                clearInterval(countdownIntervalId);
                                countdownIntervalId = null;
                            }
                        } else {
                            updateBonusShotMessage();
                        }
                    }, 1000) as unknown as number;
                    
                    // Setup actual timeout that will trigger the turn change
                    bonusShotTimeoutId = setTimeout(async () => {
                        // Clear timers
                        clearBonusShotTimers();
                        
                        // Directly trigger timeout in backend
                        if (gameState) {
                            gameMessage = "Your bonus shot timed out! Waiting for opponent...";
                            
                            // Update game state with expired turn
                            gameState = await cpuGameService.timeoutBonusShot(gameState.gameId);
                            
                            // Wait for CPU move to complete after timeout
                            setTimeout(async () => {
                                await handleCpuMoveCompletion();
                            }, 1500);
                        }
                    }, battleshipConfig.bonusShotTimeout) as unknown as number;
                } else {
                    // If bonus shots are disabled or it's now CPU's turn
                    if (move.result === 'hit') {
                        gameMessage = "Hit! Waiting for opponent...";
                    } else {
                        const shipName = getShipNameFromId(move.shipId);
                        gameMessage = `You sunk their ${shipName}! Waiting for opponent...`;
                    }
                }
            } else if (move.result === 'miss') {
                gameMessage = "Miss! Waiting for opponent...";
            }
            
            // Wait for CPU move to complete if it's the opponent's turn
            if (gameState.currentTurn === 'opponent' && gameState.status === 'active') {
                setTimeout(async () => {
                    await handleCpuMoveCompletion();
                }, 1500); // Wait a bit for animation and CPU "thinking"
            }
        } catch (error) {
            console.error('Error making move:', error);
        }
    }
    
    function updateBonusShotMessage() {
        const seconds = Math.ceil(timeRemaining / 1000);
        if (gameMessage.includes('Fire again!')) {
            gameMessage = gameMessage.split('!')[0] + `! Fire again! (${seconds}s)`;
        }
    }
    
    async function handleCpuMoveCompletion() {
        // Get updated game state after CPU move
        if (!gameState) return;
        
        try {
            // Get the latest game state
            gameState = await cpuGameService.getGameState(gameState.gameId);
            
            // Find the latest CPU move
            if (gameState) {
                const cpuMoves = gameState.moves.filter(m => 
                    m.position.x >= 0 && 
                    m.position.x < 10 && 
                    m.position.y >= 0 && 
                    m.position.y < 10
                );
                
                if (cpuMoves.length > 0) {
                    const lastCpuMove = cpuMoves[cpuMoves.length - 1];
                    
                    // Only process if this is a CPU move (not the player's move)
                    if (lastCpuMove.result) {
                        const cpuTarget = lastCpuMove.position;
                        
                        // Update player's board with the CPU's shot
                        if (playerBoardComponent) {
                            try {
                                // Call receiveShot but use the server result as source of truth
                                playerBoardComponent.receiveShot(
                                    cpuTarget.x, 
                                    cpuTarget.y, 
                                    lastCpuMove.result, 
                                    lastCpuMove.shipId
                                );
                                
                                console.log('Applied CPU shot to player board: ', 
                                    `x=${cpuTarget.x}, y=${cpuTarget.y}, result=${lastCpuMove.result}`);
                            } catch (error) {
                                console.error('Error processing CPU shot:', error);
                            }
                        } else {
                            console.error('Player board component not available');
                        }
                        
                        // Update message with CPU's move result
                        if (gameState.status === 'opponent_won') {
                            gameOver = true;
                            gameActive = false;
                            lastGameResult = 'loss';
                            gameMessage = "Defeat! Your fleet has been destroyed.";
                        } else if (lastCpuMove.result === 'hit') {
                            gameMessage = "The enemy hit your ship!";
                            
                            // If bonus shots are enabled and CPU still has the turn, it gets another shot
                            if (battleshipConfig.bonusShotWhenHit && gameState.currentTurn === 'opponent') {
                                gameMessage += " Enemy is firing again!";
                                // Wait for the CPU to make another move
                                setTimeout(async () => {
                                    await handleCpuMoveCompletion();
                                }, 1500);
                            } else {
                                gameMessage += " Your turn.";
                            }
                        } else if (lastCpuMove.result === 'miss') {
                            gameMessage = "The enemy missed! Your turn.";
                        } else if (lastCpuMove.result === 'sunk') {
                            const shipName = getShipNameFromId(lastCpuMove.shipId);
                            gameMessage = `The enemy sunk your ${shipName}!`;
                            
                            // If bonus shots are enabled and CPU still has the turn, it gets another shot
                            if (battleshipConfig.bonusShotWhenHit && gameState.currentTurn === 'opponent') {
                                gameMessage += " Enemy is firing again!";
                                // Wait for the CPU to make another move
                                setTimeout(async () => {
                                    await handleCpuMoveCompletion();
                                }, 1500);
                            } else {
                                gameMessage += " Your turn.";
                            }
                        }
                    } 
                    // Check if CPU is still in its turn (got a bonus shot)
                    else if (gameState.currentTurn === 'opponent') {
                        // CPU has a bonus shot and is still deciding, wait more...
                        gameMessage = "Enemy is preparing to fire again...";
                        setTimeout(async () => {
                            await handleCpuMoveCompletion();
                        }, 1500);
                    }
                }
            }
        } catch (error) {
            console.error('Error in handleCpuMoveCompletion:', error);
        }
    }
    
    async function handleRematch() {
        // Update win streak based on last game result
        if (lastGameResult === 'loss') {
            winningStreak = Math.max(0, winningStreak - 1);
        }
        
        // Reset game state
        gameOver = false;
        gameActive = false;
        playerReady = false;
        opponentReady = false;
        lastGameResult = null;
        gameMessage = 'Place your ships on the board';
        
        // Clear any active timers
        clearBonusShotTimers();
        
        // Create new game
        gameState = await cpuGameService.createGame(username);
        
        // Reset the player board component to allow ship placement again
        if (playerBoardComponent) {
            playerBoardComponent.resetBoard();
        }
        
        // Reset the opponent board component
        if (opponentBoardComponent) {
            opponentBoardComponent.resetBoard();
        }
    }
    
    function handleDone() {
        // Reset all game state
        gameOver = false;
        gameActive = false;
        playerReady = false;
        opponentReady = false;
        winningStreak = 0;
        lastGameResult = null;
        
        // Clear any active timers
        clearBonusShotTimers();
        
        // Navigate back to battleship front page
        goto('/spill/battleship');
    }
</script>

<div class="battleship-game">
    <div class="game-status">
        <h2>{gameMessage}</h2>
    </div>
    
    <div class="game-boards">
        <div class="player-board">
            <GameBoard 
                username={username} 
                isCPU={false} 
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
                    isCPU={true}
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