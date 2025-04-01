<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { battleshipConfig } from '$lib/config/battleshipConfig.js';
    import { generateShipsFromConfig, type Ship, type CellState, type GameState } from '$lib/services/battleshipGameService';
    const dispatch = createEventDispatcher();
    
    export let isCPU: boolean = true;
    export let inPlayMode: boolean = false;
    export let debugMode: boolean = false;
    
    const BOARD_SIZE = battleshipConfig.boardSize;

    // Generate ships using the utility function from battleshipGameService
    let ships: Ship[] = generateShipsFromConfig();
    
    let board: CellState[][] = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill('empty'));
    
    // Add a shipGrid to track which ship is in each cell
    let shipGrid: (Ship | null)[][] = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    
    let isReady = false;
    let allShipsPlaced = false;
    
    function createEmptyBoard() {
        board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill('empty'));
        shipGrid = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    }
    
    // Function to reset the board state
    export function resetBoard() {
        // Reset ships to default state
        ships = ships.map(ship => ({
            ...ship,
            placed: false,
            position: undefined,
            orientation: undefined,
            hits: 0,
            sunk: false
        }));
        
        // Reset board and shipGrid
        board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill('empty'));
        shipGrid = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
        
        // Reset state flags
        isReady = false;
        allShipsPlaced = false;
    }
    
    // Function to sync the board with game state
    export function syncWithGameState(gameState: GameState) {
        // If we have a game state with opponent board, use that
        if (gameState && gameState.opponentBoard) {
            // Copy the ships
            ships = [...gameState.opponentBoard.ships];
            
            // Reset and rebuild the board based on ships
            board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill('empty'));
            shipGrid = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
            
            // Place ships on the board
            for (const ship of ships) {
                if (ship.placed && ship.position && ship.orientation) {
                    const { x, y } = ship.position;
                    const orientation = ship.orientation;
                    
                    for (let i = 0; i < ship.length; i++) {
                        const newX = orientation === 'horizontal' ? x + i : x;
                        const newY = orientation === 'vertical' ? y + i : y;
                        
                        if (newX < BOARD_SIZE && newY < BOARD_SIZE) {
                            board[newY][newX] = 'ship';
                            shipGrid[newY][newX] = ship;
                        }
                    }
                }
            }
            
            // Copy hit/miss markers
            for (let y = 0; y < BOARD_SIZE; y++) {
                for (let x = 0; x < BOARD_SIZE; x++) {
                    if (gameState.opponentBoard.board[y][x] === 'hit' || 
                        gameState.opponentBoard.board[y][x] === 'miss') {
                        board[y][x] = gameState.opponentBoard.board[y][x];
                    }
                }
            }
            
            allShipsPlaced = true;
            isReady = true;
            
            // Force UI update
            board = [...board];
            ships = [...ships];
        }
    }

    // Initialize empty board - ship placement will be handled by the game service
    createEmptyBoard();

    // Function to check if a cell is the first cell of a ship
    function isShipStart(ship: Ship, x: number, y: number): boolean {
        if (!ship.position) return false;
        return x === ship.position.x && y === ship.position.y;
    }
    
    // Function to handle player's shot
    function handleCellClick(x: number, y: number) {
        if (!inPlayMode || board[y][x] === 'hit' || board[y][x] === 'miss') return;
        
        // Dispatch event to parent component to handle the shot
        dispatch('fire', { x, y });
    }
    
</script>

<div class="game-board {debugMode ? 'debug-mode' : ''}">
    <div class="game-info">
        <h2>Opponent's Fleet</h2>
    </div>

    <div class="board-container">
        <div class="board">
            {#each board as row, y}
                <div class="row">
                    {#each row as cell, x}
                        <div 
                            class="cell {cell} {inPlayMode ? 'clickable' : ''}"
                            on:click={() => handleCellClick(x, y)}
                        >
                            {#if cell === 'ship' && debugMode && isCPU}
                                {@const ship = shipGrid[y][x]}
                                {#if ship && isShipStart(ship, x, y)}
                                    <span class="ship-label">
                                        {ship.id}
                                    </span>
                                {/if}
                            {/if}
                            
                            {#if cell === 'hit'}
                                {@const ship = shipGrid[y][x]}
                                {#if ship && ship.sunk}
                                    <div class="hit-marker sunk">S</div>
                                {:else}
                                    <div class="hit-marker">H</div>
                                {/if}
                            {:else if cell === 'miss'}
                                <div class="miss-marker">X</div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/each}
        </div>
    </div>
</div>

<style>

    h2 {
        margin: 0;
        color: #e94560;
        text-shadow: 
            0 0 7px #e94560,
            0 0 14px #e94560;
        font-weight: bold;
        font-size: 2rem;
    }

    .game-board {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
        position: relative;
    }

    .game-info {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        align-items: center;
    }

    .board-container {
        display: flex;
        justify-content: center;
    }

    .board {
        display: grid;
        grid-template-rows: repeat(10, 1fr);
        gap: 2px;
        background-color: #e74c3c;
        padding: 2px;
        border-radius: 5px;
    }

    .row {
        display: grid;
        grid-template-columns: repeat(10, 1fr);
        gap: 2px;
    }

    .cell {
        position: relative;
        width: 40px;
        height: 40px;
        background-color: #ecf0f1;
        border-radius: 2px;
        transition: background-color 0.2s;
    }
    
    /* Clickable states: prioritize these rules */
    /* Crosshair and green tint for cells that are clickable and haven't been bombed yet */
    .cell.clickable:not(.hit):not(.miss):hover {
        cursor: crosshair;
        background-color: rgba(46, 204, 112, 0.85);
    }
    
    /* Not-allowed cursor and red tint for cells that have been bombed already */
    .cell.clickable.hit:hover,
    .cell.clickable.miss:hover {
        cursor: not-allowed;
        background-color: rgba(231, 76, 60, 0.3);
    }
    
    /* Default not-allowed cursor when game hasn't started */
    .cell:not(.clickable):hover {
        cursor: not-allowed;
        background-color: rgba(231, 76, 60, 0.3);
    }

    /* Only show ship background when in debug mode */
    :global(.debug-mode) .cell.ship {
        background-color: #2c3e50;
    }

    .cell.hit {
        background-color: #e74c3c;
    }

    .cell.miss {
        background-color: #3498db;
    }

    .ship-label {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 0.7rem;
        color: white;
        pointer-events: none;
    }
    
    .hit-marker, .miss-marker {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 1.5rem;
        font-weight: bold;
        pointer-events: none;
    }
    
    .hit-marker {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 18px;
        color: #2ecc71;
    }

    .hit-marker.sunk {
        color: #ffffff;
        background-color: #e74c3c;
    }

    .miss-marker {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 18px;
        color: #e74c3c;
    }
</style> 