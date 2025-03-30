<script lang="ts">
    import { onMount } from 'svelte';
    import GameBoard from './GameBoard.svelte';
    import OpponentBoard from './OpponentBoard.svelte';
    import { battleshipConfig } from '$lib/config/battleshipConfig.js';
    import { cpuGameService, type GameState, type GameMove, type Position } from '$lib/services/battleshipGameService';
    import { goto } from '$app/navigation';

    export let username: string = "Player";
    
    let gameState: GameState | null = null;
    let opponentReady = false;
    let playerReady = false;
    let gameActive = false;
    let gameMessage = 'Place your ships on the board';
    let gameOver = false;
    let winningStreak = 0;
    
    // Component references
    let opponentBoardComponent: OpponentBoard;
    let playerBoardComponent: GameBoard;
    
    onMount(async () => {
        // Create a new game when the component is mounted
        gameState = await cpuGameService.createGame(username);
    });
    
    function handlePlayerReady(event: CustomEvent) {
        if (!gameState) return;
        
        const playerBoard = event.detail;
        playerReady = true;
        
        // Save the player's ships to the game state
        cpuGameService.placeShips(gameState.gameId, playerBoard.ships)
            .then(newState => {
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
                winningStreak++;
                gameMessage = "Victory! You sunk all enemy ships!";
            } else if (move.result === 'hit') {
                gameMessage = "Hit! Fire again!";
            } else if (move.result === 'miss') {
                gameMessage = "Miss! Waiting for opponent...";
            } else if (move.result === 'sunk') {
                gameMessage = `You sunk their ${move.shipId?.charAt(0) === 'B' ? 'Battleship' : 
                                         move.shipId?.charAt(0) === 'F' ? 'Frigate' :
                                         move.shipId?.charAt(0) === 'C' ? 'Corvette' : 'U-boat'}!`;
            }
            
            // Wait for CPU move to complete
            if (gameState.currentTurn === 'opponent' && gameState.status === 'active') {
                setTimeout(async () => {
                    // Get updated game state after CPU move
                    gameState = await cpuGameService.getGameState(gameState.gameId);
                    
                    // Find the latest CPU move
                    const cpuMoves = gameState.moves.filter(m => 
                        m.position.x >= 0 && 
                        m.position.x < 10 && 
                        m.position.y >= 0 && 
                        m.position.y < 10
                    );
                    
                    if (cpuMoves.length > 0) {
                        const lastCpuMove = cpuMoves[cpuMoves.length - 1];
                        
                        // Only process if this is a CPU move (not the player's move)
                        if (gameState.currentTurn === 'player') {
                            const cpuTarget = lastCpuMove.position;
                            
                            // Update player's board with the CPU's shot
                            if (playerBoardComponent) {
                                playerBoardComponent.receiveShot(cpuTarget.x, cpuTarget.y);
                            }
                            
                            // Update message with CPU's move result
                            if (gameState.status === 'opponent_won') {
                                gameOver = true;
                                winningStreak = 0;
                                gameMessage = "Defeat! Your fleet has been destroyed.";
                            } else if (lastCpuMove.result === 'hit') {
                                gameMessage = "The enemy hit your ship! Your turn.";
                            } else if (lastCpuMove.result === 'miss') {
                                gameMessage = "The enemy missed! Your turn.";
                            } else if (lastCpuMove.result === 'sunk') {
                                gameMessage = `The enemy sunk your ${lastCpuMove.shipId}! Your turn.`;
                            }
                        }
                    }
                }, 1500); // Wait a bit for animation and CPU "thinking"
            }
        } catch (error) {
            console.error('Error making move:', error);
        }
    }
    
    async function handleRematch() {
        // Reset game state
        gameOver = false;
        gameActive = false;
        playerReady = false;
        opponentReady = false;
        gameMessage = 'Place your ships on the board';
        
        // Create new game
        gameState = await cpuGameService.createGame(username);
    }
    
    function handleDone() {
        // Navigate back to battleship front page
        goto('/spill/battleship');
    }
</script>

<div class="battleship-game">
    <div class="game-status">
        <h2>{gameMessage}</h2>
        {#if winningStreak > 1}
            <p class="winning-streak">You've won {winningStreak} games in a row!</p>
        {/if}
    </div>
    
    <div class="game-boards">
        <div class="player-board">
            <GameBoard 
                username={username} 
                isCPU={false} 
                on:ready={handlePlayerReady}
                bind:this={playerBoardComponent}
            />
        </div>
        
        {#if battleshipConfig.showCpuBoard || playerReady}
            <div class="opponent-board">
                <OpponentBoard 
                    isCPU={true}
                    inPlayMode={gameActive}
                    on:ready={handleOpponentReady}
                    on:fire={handleFireShot}
                    bind:this={opponentBoardComponent}
                    debugMode={battleshipConfig.showCpuBoard}
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
        gap: 2rem;
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
    }
    
    .game-status {
        text-align: center;
        margin-bottom: 1rem;
    }
    
    .winning-streak {
        font-weight: bold;
        color: #2ecc71;
        margin-top: 0.5rem;
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
            gap: 2rem;
        }
    }
</style> 