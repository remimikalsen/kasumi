<!-- GameBoard.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { battleshipConfig } from '$lib/config/battleshipConfig.js';
    import type { Ship } from '@lib/services/battleshipServices';
    
    const dispatch = createEventDispatcher();
    
    export let username: string;
    export let gameId: string;
    
    // Board state
    let ships: Ship[] = [];
    let board: string[][] = Array(battleshipConfig.boardSize).fill(null).map(() => Array(battleshipConfig.boardSize).fill('empty'));
    let shipGrid: (Ship | null)[][] = Array(battleshipConfig.boardSize).fill(null).map(() => Array(battleshipConfig.boardSize).fill(null));
    
    const BOARD_SIZE = battleshipConfig.boardSize;
    
    let selectedShip: Ship | null = null;
    let isDragging = false;
    let currentOrientation: 'horizontal' | 'vertical' = 'horizontal';
    let isReady = false;
    let allShipsPlaced = false;
    
    let mousePosition = { x: 0, y: 0 };
    let dragOffsetRelativeToShipStart = { x: 0, y: 0 };
    let previewCells: {x: number, y: number}[] = [];
    let previewState: string | null = null;

    // Initialize ships from config
    $: {
        if (ships.length === 0) {
            ships = Object.entries(battleshipConfig.shipTypes).reduce((acc, [type, details]) => {
                const { length, count, prefix } = details;
                const newShips = Array(count).fill(null).map((_, i) => ({
                    id: `${prefix}${i + 1}`,
                    type,
                    prefix, 
                    length,
                    placed: false,
                    hits: 0,
                    sunk: false
                }));
                return [...acc, ...newShips];
            }, [] as Ship[]);
        }
    }

    // Ship placement functions must be done locally, and when the user is ready, the ships and their placement is sent to the server
    function handleShipDragStart(event: MouseEvent | TouchEvent, ship: Ship) {
        if (isReady) return;
        
        event.preventDefault();
        
        // Prevent immediate mouse up on mobile
        if (event.type === 'touchstart') {
            const touch = (event as TouchEvent).touches[0];
            mousePosition = { x: touch.clientX, y: touch.clientY };
        } else {
            mousePosition = { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
        }
        
        // If ship is already placed, remove it from board first
        if (ship.placed) {
            removeShip(ship);
        }
        
        selectedShip = ship;
        isDragging = true;
        currentOrientation = ship.orientation || 'horizontal';
        
        // Set up drag event listeners
        window.addEventListener('mousemove', handleShipDragMove);
        window.addEventListener('mouseup', handleShipDragEnd);
        window.addEventListener('touchmove', handleShipDragMove);
        window.addEventListener('touchend', handleShipDragEnd);
        
        // Force update UI
        ships = [...ships];
    }
    
    function handleShipDragMove(event: MouseEvent | TouchEvent) {
        if (!isDragging || !selectedShip) return;
        if (isReady) return;
        
        event.preventDefault();
        
        if (event.type === 'touchmove') {
            const touch = (event as TouchEvent).touches[0];
            mousePosition = { x: touch.clientX, y: touch.clientY };
        } else {
            mousePosition = { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
        }
        
        // Find the cell under the mouse
        const boardElement = document.querySelector('.board');
        if (!boardElement) return;
        
        const boardRect = boardElement.getBoundingClientRect();
        
        // Get cell position from mouse position relative to board
        const cellSize = boardRect.width / BOARD_SIZE;
        const offsetX = mousePosition.x - boardRect.left;
        const offsetY = mousePosition.y - boardRect.top;
        
        // Calculate grid position
        const x = Math.floor(offsetX / cellSize);
        const y = Math.floor(offsetY / cellSize);
        
        // Ensure position is within bounds
        if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
            updatePreview(x, y);
        }
    }
    
    function handleShipDragEnd(event: MouseEvent | TouchEvent) {
        if (!isDragging || !selectedShip) return;
        if (isReady) return;
        
        event.preventDefault();
        
        // Remove event listeners
        window.removeEventListener('mousemove', handleShipDragMove);
        window.removeEventListener('mouseup', handleShipDragEnd);
        window.removeEventListener('touchmove', handleShipDragMove);
        window.removeEventListener('touchend', handleShipDragEnd);
        
        // Place ship if preview is valid
        if (previewState === 'valid' && previewCells.length > 0) {
            const { x, y } = previewCells[0];
            placeShip(x, y);
        }
        
        // Reset drag state
        isDragging = false;
        selectedShip = null;
        previewCells = [];
        previewState = null;
        
        // Check if all ships are placed
        checkAllShipsPlaced();
    }
    
    function handleBoardCellMouseDown(event: MouseEvent | TouchEvent, x: number, y: number) {
        if (isReady) return;
        
        // Check if cell has a ship
        if (board[y][x] === 'ship') {
            // Find the ship
            const ship = shipGrid[y][x];
            if (ship) {
                // Start dragging the ship
                handleShipDragStart(event, ship);
            }
        }
    }
    
    function handleAutoPlaceClick() {
        if (isReady) return;
        
        // Reset all ships
        ships.forEach(ship => {
            if (ship.placed) {
                removeShip(ship);
            }
        });
        
        // Place each ship randomly
        ships.forEach(ship => {
            let placed = false;
            let attempts = 0;
            
            while (!placed && attempts < 100) {
                const x = Math.floor(Math.random() * BOARD_SIZE);
                const y = Math.floor(Math.random() * BOARD_SIZE);
                currentOrientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
                
                selectedShip = ship;
                
                if (canPlaceShip(x, y)) {
                    placeShip(x, y);
                    placed = true;
                }
                
                attempts++;
            }
        });
        
        // Reset selection
        selectedShip = null;
        
        // Force update board and ships
        board = [...board];
        shipGrid = [...shipGrid];
        ships = [...ships];
        
        // Check if all ships are placed
        checkAllShipsPlaced();
    }
    
    function handleRotateClick(event: MouseEvent, ship: Ship) {
        if (isReady) return;
        
        event.preventDefault();
        
        // Toggle orientation
        const newOrientation = ship.orientation === 'horizontal' ? 'vertical' : 'horizontal';
        
        // Remember original position
        const originalPosition = ship.position;
        
        if (!originalPosition) return;
        
        // Remove ship from board
        removeShip(ship);
        
        // Set new orientation
        currentOrientation = newOrientation;
        selectedShip = ship;
        
        // Try to place ship at the same position with new orientation
        updatePreview(originalPosition.x, originalPosition.y);
        
        const canRotate = previewState === 'valid';
        
        if (canRotate) {
            placeShip(originalPosition.x, originalPosition.y);
            ships = [...ships];
        } else {
            updatePreview(originalPosition.x, originalPosition.y);
            
            // Show visual feedback that rotation is not possible
            previewState = 'invalid';
            
            // Force update
            previewCells = [...previewCells];
            
            // Reset after a short delay
            setTimeout(() => {
                // Revert to original orientation and place ship back
                currentOrientation = ship.orientation || 'horizontal';
                updatePreview(originalPosition.x, originalPosition.y);
                placeShip(originalPosition.x, originalPosition.y);
                
                ships = [...ships];
                board = [...board];
                shipGrid = [...shipGrid];
            }, 500);
        }
        
        // Reset selection
        selectedShip = null;
        previewCells = [];
        previewState = null;
    }
    
    function updatePreview(x: number, y: number) {
        if (!selectedShip) return;
        
        previewCells = [];
        const length = selectedShip.length;
        
        for (let i = 0; i < length; i++) {
            let posX, posY;
            
            if (currentOrientation === 'horizontal') {
                posX = x + i;
                posY = y;
            } else {
                posX = x;
                posY = y + i;
            }
            
            // Check if position is within bounds
            if (posX >= 0 && posX < BOARD_SIZE && posY >= 0 && posY < BOARD_SIZE) {
                previewCells.push({ x: posX, y: posY });
            }
        }
        
        // Check if all preview cells are valid
        previewState = canPlaceShip(x, y) ? 'valid' : 'invalid';
    }
    
    function canPlaceShip(x: number, y: number) {
        if (!selectedShip) return false;
        
        const length = selectedShip.length;
        for (let i = 0; i < length; i++) {
            let posX, posY;
            
            if (currentOrientation === 'horizontal') {
                posX = x + i;
                posY = y;
            } else {
                posX = x;
                posY = y + i;
            }
            
            // Check if position is within bounds
            if (posX < 0 || posX >= BOARD_SIZE || posY < 0 || posY >= BOARD_SIZE) {
                return false;
            }
            
            // Check if position is already occupied by another ship
            if (board[posY][posX] === 'ship' && shipGrid[posY][posX] !== selectedShip) {
                return false;
            }
        }
        
        return true;
    }
    
    function placeShip(x: number, y: number) {
        if (!selectedShip) return;
        
        const length = selectedShip.length;
        for (let i = 0; i < length; i++) {
            let posX, posY;
            
            if (currentOrientation === 'horizontal') {
                posX = x + i;
                posY = y;
            } else {
                posX = x;
                posY = y + i;
            }
            
            // Place ship on board
            board[posY][posX] = 'ship';
            shipGrid[posY][posX] = selectedShip;
        }
        
        // Update ship state
        selectedShip.placed = true;
        selectedShip.position = { x, y };
        selectedShip.orientation = currentOrientation;
    }
    
    function removeShip(ship: Ship) {
        if (!ship.position) return;
        
        const length = ship.length;
        const { x, y } = ship.position;
        const orientation = ship.orientation || 'horizontal';
        
        for (let i = 0; i < length; i++) {
            let posX, posY;
            
            if (orientation === 'horizontal') {
                posX = x + i;
                posY = y;
            } else {
                posX = x;
                posY = y + i;
            }
            
            // Remove ship from board
            board[posY][posX] = 'empty';
            shipGrid[posY][posX] = null;
        }
        
        // Update ship state
        ship.placed = false;
        ship.position = undefined;
    }
    
    function checkAllShipsPlaced() {
        allShipsPlaced = ships.every(ship => ship.placed);
    }
    
    function handleReadyClick() {
        if (allShipsPlaced) {
            isReady = true;
            dispatch('ready', {
                ships,
                board,
                shipGrid
            });
        }
    }
    
    // Function to check if a cell is the center of a ship
    function isShipCenter(ship: Ship, x: number, y: number): boolean {
        if (!ship.position || !ship.orientation) return false;
        
        const halfLength = Math.floor(ship.length / 2);
        
        if (ship.orientation === 'horizontal') {
            return x === ship.position.x + halfLength && y === ship.position.y;
        } else {
            return x === ship.position.x && y === ship.position.y + halfLength;
        }
    }
    
    // Function to check if a cell is the first cell of a ship
    function isShipStart(ship: Ship, x: number, y: number): boolean {
        if (!ship.position) return false;
        return x === ship.position.x && y === ship.position.y;
    }

    export function updateBoard(newBoard: string[][]) {
        // Update the board state
        board = newBoard;
        
        // Update ship states based on the new board
        ships.forEach(ship => {
            if (ship.position && ship.orientation) {
                const { x, y } = ship.position;
                const orientation = ship.orientation;
                let allCellsHit = true;
                
                // Check all cells of the ship
                for (let i = 0; i < ship.length; i++) {
                    const posX = orientation === 'horizontal' ? x + i : x;
                    const posY = orientation === 'vertical' ? y + i : y;
                    
                    if (posX < board[0].length && posY < board.length) {
                        if (board[posY][posX] !== 'hit') {
                            allCellsHit = false;
                            break;
                        }
                    }
                }
                
                // Update ship sunk state
                ship.sunk = allCellsHit;
            }
        });
    }
</script>

<div class="game-board">
    <div class="game-info">
        <h2>{username}'s Fleet</h2>
        
        {#if !isReady}
            <div class="ship-placement-controls">
                <button class="auto-place-button" on:click={handleAutoPlaceClick}>
                    Auto-place Fleet
                </button>
                
                <button 
                    class="ready-button" 
                    on:click={handleReadyClick}
                    disabled={!allShipsPlaced}
                >
                    Ready for Battle!
                </button>
            </div>
            
            <div class="ship-selection">
                {#if allShipsPlaced}
                    <p class="fleet-deployed">Your entire fleet has been deployed!</p>
                {:else}
                    {#each ships as ship}
                        <button 
                            class="ship-button {ship.placed ? 'placed' : ''}"
                            on:mousedown={(e) => handleShipDragStart(e, ship)}
                            on:touchstart={(e) => handleShipDragStart(e, ship)}
                        >
                            {ship.type.charAt(0).toUpperCase() + ship.type.slice(1)}
                        </button>
                    {/each}
                {/if}
            </div>
        {/if}
    </div>

    <div class="board-container">
        <div class="board">
            {#each board as row, y}
                <div class="row">
                    {#each row as cell, x}
                        <div 
                            class="cell {cell} {previewCells.some(p => p.x === x && p.y === y) ? `preview ${previewState}` : ''} {cell === 'ship' && isReady ? 'locked' : ''}"
                            on:mousedown={(e) => handleBoardCellMouseDown(e, x, y)}
                            on:touchstart={(e) => handleBoardCellMouseDown(e, x, y)}
                        >
                            {#if cell === 'ship'}
                                {@const ship = shipGrid[y][x]}
                                {#if ship && isShipCenter(ship, x, y) && ship.length > 1 && !isReady}
                                    <button 
                                        class="rotate-button"
                                        on:click={(e) => handleRotateClick(e, ship)}
                                    >
                                        ⟳
                                    </button>
                                {/if}
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
    
    {#if isDragging && selectedShip}
        <div class="drag-ghost" 
            style="
                left: {mousePosition.x - 20}px; 
                top: {mousePosition.y - 20}px; 
                width: {currentOrientation === 'horizontal' ? selectedShip.length * 40 : 40}px;
                height: {currentOrientation === 'vertical' ? selectedShip.length * 40 : 40}px;
            ">
            {selectedShip.id}
        </div>
    {/if}
</div>

<style>
    .game-board {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
        position: relative;
    }

    h2 {
        margin: 0;
        color: #2c3e50;
        font-weight: bold;
        font-size: 2rem;
    }

    .game-info {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        align-items: center;
    }

    .ship-placement-controls {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .ship-selection {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: center;
    }

    .ship-button {
        padding: 0.5rem 1rem;
        border: 2px solid #3498db;
        border-radius: 5px;
        background-color: white;
        cursor: pointer;
        transition: all 0.2s;
    }

    .ship-button:hover:not(.placed) {
        background-color: #3498db;
        color: white;
    }

    .ship-button.placed {
        background-color: #bdc3c7;
        color: #7f8c8d;
        cursor: not-allowed;
    }

    .fleet-deployed {
        color: #27ae60;
        font-weight: bold;
    }

    .auto-place-button, .ready-button {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 5px;
        font-weight: bold;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .auto-place-button {
        background-color: #3498db;
        color: white;
    }

    .auto-place-button:hover {
        background-color: #2980b9;
    }

    .ready-button {
        background-color: #2ecc71;
        color: white;
    }

    .ready-button:hover:not(:disabled) {
        background-color: #27ae60;
    }

    .ready-button:disabled {
        background-color: #bdc3c7;
        cursor: not-allowed;
    }

    .board-container {
        display: flex;
        justify-content: center;
    }

    .board {
        display: grid;
        grid-template-rows: repeat(10, 1fr);
        gap: 2px;
        background-color: #3498db;
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
        cursor: pointer;
    }

    .cell:hover:not(.locked) {
        background-color: #d6eaf8;
    }

    .cell.ship {
        background-color: #34495e;
    }

    .cell.ship.locked {
        cursor: default;
    }

    .cell.hit {
        background-color: #e74c3c;
    }

    .cell.miss {
        background-color: #3498db;
    }

    .cell.preview.valid {
        background-color: rgba(46, 204, 113, 0.5);
    }

    .cell.preview.invalid {
        background-color: rgba(231, 76, 60, 0.5);
    }

    .rotate-button {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 24px;
        height: 24px;
        background-color: #3498db;
        color: white;
        border: none;
        border-radius: 50%;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
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

    .drag-ghost {
        position: fixed;
        background-color: rgba(52, 152, 219, 0.5);
        border: 2px dashed #3498db;
        color: #2c3e50;
        border-radius: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 1000;
        font-weight: bold;
    }
</style> 