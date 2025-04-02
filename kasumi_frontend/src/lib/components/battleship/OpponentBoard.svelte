<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { battleshipConfig } from '$lib/config/battleshipConfig.js';
    import type { Ship } from '@lib/services/battleshipServices';
    import type { GameState } from '@lib/services/battleshipServices';

    const dispatch = createEventDispatcher();
    
    export let gameState: GameState;
    export let showBoard: boolean;
    export let opponentInitials: string;

    const isCPU = gameState.mode === 'cpu';
    const inPlayMode = gameState.status === 'active';
    const debugMode = gameState.config.debugCpuBoard || false;
    
    // Board state
    let board = gameState.playerBoards[opponentInitials]?.board;
    let shipGrid = gameState.playerBoards[opponentInitials]?.shipGrid;
    let ships = gameState.playerBoards[opponentInitials]?.ships;
    
    function handleCellClick(x: number, y: number) {
        if (!inPlayMode) return;
        dispatch('fire', { position: { x, y } });
    }

    
    // Function to check if a cell is the start of a ship
    function isShipStart(ship: Ship, x: number, y: number): boolean {
        if (!ship.position) return false;
        return x === ship.position.x && y === ship.position.y;
    }

</script>

<div class="game-board {debugMode ? 'debug-mode' : ''} {!showBoard ? 'hidden' : ''}">
    <div class="game-info">
        <h2>{opponentInitials}'s Fleet</h2>
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
                                {@const ship = ships.find(ship => ship.id === shipGrid[y][x])}
                                {#if ship && isShipStart(ship, x, y)}
                                    <span class="ship-label">
                                        {ship.id}
                                    </span>
                                {/if}
                            {/if}
                            
                            {#if cell === 'hit'}
                                {@const ship = shipGrid[y][x]}
                                {#if ship && ships?.find(s => s.id === ship)?.sunk}
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

    .cell.sunk {
        background-color: #e74c3c;
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
        color: #000000;
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

    .game-board.hidden {
        display: none;
    }
</style> 