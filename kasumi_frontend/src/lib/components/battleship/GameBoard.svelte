<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { battleshipConfig } from '$lib/config/battleshipConfig.js';
    import { generateShipsFromConfig, type Ship, type CellState, type Orientation, type Position } from '$lib/services/battleshipGameService';
    const dispatch = createEventDispatcher();

    export let username: string;
    export let isCPU: boolean;

    const BOARD_SIZE = battleshipConfig.boardSize;
    
    // Generate ships using the utility function from battleshipGameService
    let ships: Ship[] = generateShipsFromConfig();

    let board: CellState[][] = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill('empty'));
    let selectedShip: Ship | null = null;
    let isDragging = false;
    let currentOrientation: Orientation = 'horizontal';
    let isReady = false;
    let allShipsPlaced = false;
    let dragOffset = { x: 0, y: 0 };
    let mousePosition = { x: 0, y: 0 };
    let dragOffsetRelativeToShipStart = { x: 0, y: 0 };

    // For ship placement preview
    let previewCells: Position[] = [];
    let previewState: 'valid' | 'invalid' | null = null;

    // Add a shipGrid to track which ship is in each cell
    let shipGrid: (Ship | null)[][] = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

    // Force UI to update reactively when ships array changes
    //$: placedShips = ships.filter(ship => ship.placed);
    //$: unplacedShips = ships.filter(ship => !ship.placed);

    // Add these variables to track original position
    let dragStartPosition: Position | undefined = undefined;
    let dragStartOrientation: Orientation | undefined = undefined;
    let dragStartWasPlaced = false;

    // Add a resetBoard method to reset the game state
    export function resetBoard() {
        // Reset all ships to unplaced state
        ships = ships.map(ship => ({
            ...ship,
            placed: false,
            position: undefined,
            orientation: undefined,
            hits: 0,
            sunk: false
        }));
        
        // Reset the board cells
        board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill('empty'));
        
        // Reset the ship grid
        shipGrid = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
        
        // Reset other state variables
        isReady = false;
        allShipsPlaced = false;
        
        // Force UI update
        ships = [...ships];
    }

    function handleShipDragStart(event: MouseEvent | TouchEvent, ship: Ship) {
        if (isReady) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        isDragging = true;
        selectedShip = ship;
        currentOrientation = ship.orientation || 'horizontal';
        
        // Record the starting position and state
        dragStartPosition = ship.position ? {...ship.position} : undefined;
        dragStartOrientation = ship.orientation;
        dragStartWasPlaced = ship.placed;
        
        // Calculate drag offset for ghost image positioning AND set the relative offset
        if (event instanceof MouseEvent) {
            const target = event.currentTarget as HTMLElement;
            const rect = target.getBoundingClientRect();
            
            // Calculate which part of the ship was clicked relative to its start
            // For ships in container, we need to calculate based on button width
            const offsetWithinButton = event.clientX - rect.left;
            const cellWidth = 40; // Each cell is 40px wide
            const clickedCellOffset = Math.floor(offsetWithinButton / cellWidth);
            
            // Store the relative offset for dragging calculations
            dragOffsetRelativeToShipStart = { 
                x: clickedCellOffset,
                y: 0 // Only horizontal offset for ships in container
            };
            
            // Store absolute cursor offset for ghost display
            dragOffset.x = event.clientX - rect.left;
            dragOffset.y = event.clientY - rect.top;
            mousePosition.x = event.clientX;
            mousePosition.y = event.clientY;
        } else {
            const target = event.currentTarget as HTMLElement;
            const rect = target.getBoundingClientRect();
            
            // Calculate touch offset within the button
            const offsetWithinButton = event.touches[0].clientX - rect.left;
            const cellWidth = 40;
            const clickedCellOffset = Math.floor(offsetWithinButton / cellWidth);
            
            // Store the relative offset
            dragOffsetRelativeToShipStart = { 
                x: clickedCellOffset,
                y: 0 
            };
            
            // Store absolute offset for ghost
            dragOffset.x = event.touches[0].clientX - rect.left;
            dragOffset.y = event.touches[0].clientY - rect.top;
            mousePosition.x = event.touches[0].clientX;
            mousePosition.y = event.touches[0].clientY;
        }
        
        // If picking up from board, remove it first
        if (ship.placed) {
            removeShip(ship);
        }
        
        // Force UI update
        ships = [...ships];
    }

    function handleBoardCellMouseDown(event: MouseEvent | TouchEvent, x: number, y: number) {
        if (isReady) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        // Check if there's a ship at this position
        const ship = shipGrid[y][x];
        if (ship && ship.position) {
            // Record the starting position and state
            dragStartPosition = {...ship.position};
            dragStartOrientation = ship.orientation;
            dragStartWasPlaced = ship.placed;
            
            // Calculate the clicked cell's offset from the ship's start position
            const cellX = x - ship.position.x;
            const cellY = y - ship.position.y;
            
            // Store this offset for both ghost positioning and placement calculations
            dragOffsetRelativeToShipStart = {
                x: cellX,
                y: cellY
            };
            
            // Calculate drag offset for ghost image positioning
            if (event instanceof MouseEvent) {
                const target = event.currentTarget as HTMLElement;
                const rect = target.getBoundingClientRect();
                dragOffset.x = event.clientX - rect.left;
                dragOffset.y = event.clientY - rect.top;
                mousePosition.x = event.clientX;
                mousePosition.y = event.clientY;
            } else {
                const target = event.currentTarget as HTMLElement;
                const rect = target.getBoundingClientRect();
                dragOffset.x = event.touches[0].clientX - rect.left;
                dragOffset.y = event.touches[0].clientY - rect.top;
                mousePosition.x = event.touches[0].clientX;
                mousePosition.y = event.touches[0].clientY;
            }
            
            // Start the drag operation
            isDragging = true;
            selectedShip = ship;
            currentOrientation = ship.orientation || 'horizontal';
            removeShip(ship);
            ships = [...ships]; // Force UI update
        }
    }

    function handleShipDragMove(event: MouseEvent | TouchEvent) {
        if (!isDragging || !selectedShip) return;
        if (isReady) return;
        
        event.preventDefault();
        
        // Update mouse position for ghost image
        if (event instanceof MouseEvent) {
            mousePosition.x = event.clientX;
            mousePosition.y = event.clientY;
        } else {
            mousePosition.x = event.touches[0].clientX;
            mousePosition.y = event.touches[0].clientY;
        }
        
        const boardElement = document.querySelector('.board');
        if (!boardElement) return;

        const rect = boardElement.getBoundingClientRect();
        
        // Calculate the position where the ship's START should be placed
        // by subtracting the offset of the clicked cell
        let clientX, clientY;
        if (event instanceof MouseEvent) {
            clientX = event.clientX;
            clientY = event.clientY;
        } else {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        }
        
        // Check if the cursor is near the board (even if not directly over it)
        const extendedBorderSize = 200; // Allow preview when cursor is within this many pixels of the board
        const isNearBoard = 
            clientX >= rect.left - extendedBorderSize && 
            clientX <= rect.right + extendedBorderSize && 
            clientY >= rect.top - extendedBorderSize && 
            clientY <= rect.bottom + extendedBorderSize;
            
        if (!isNearBoard) {
            // Clear preview if far from the board
            previewCells = [];
            previewState = null;
            return;
        }
        
        // Convert mouse position to cell coordinates (can be negative or beyond board size)
        const cellX = Math.floor((clientX - rect.left) / 40);
        const cellY = Math.floor((clientY - rect.top) / 40);
        
        // Adjust coordinates to get the ship's starting position based on which cell was clicked
        const shipStartX = cellX - dragOffsetRelativeToShipStart.x;
        const shipStartY = cellY - dragOffsetRelativeToShipStart.y;
        
        // Always update preview even if starting position is off board
        updatePreview(shipStartX, shipStartY);
    }

    function handleShipDragEnd(event: MouseEvent | TouchEvent) {
        if (!isDragging || !selectedShip) return;
        if (isReady) return;
        
        event.preventDefault();

        const boardElement = document.querySelector('.board');
        if (!boardElement) return;

        const rect = boardElement.getBoundingClientRect();
        
        // Calculate the position where the ship's START should be placed
        let clientX, clientY;
        if (event instanceof MouseEvent) {
            clientX = event.clientX;
            clientY = event.clientY;
        } else {
            clientX = event.changedTouches?.[0]?.clientX || 0;
            clientY = event.changedTouches?.[0]?.clientY || 0;
        }
        
        // Convert mouse position to grid coordinates
        const mouseGridX = Math.floor((clientX - rect.left) / 40);
        const mouseGridY = Math.floor((clientY - rect.top) / 40);
        
        // Calculate ship's start position based on drag offset
        const shipStartX = mouseGridX - dragOffsetRelativeToShipStart.x;
        const shipStartY = mouseGridY - dragOffsetRelativeToShipStart.y;
        
        // Check if ANY cell of the ship would be on the board
        let anyPartOnBoard = false;
        for (let i = 0; i < selectedShip.length; i++) {
            const cellX = currentOrientation === 'horizontal' ? shipStartX + i : shipStartX;
            const cellY = currentOrientation === 'vertical' ? shipStartY + i : shipStartY;
            
            if (cellX >= 0 && cellX < BOARD_SIZE && cellY >= 0 && cellY < BOARD_SIZE) {
                anyPartOnBoard = true;
                break;
            }
        }
        
        // Check if mouse/touch is over the board
        const isOverBoard = 
            clientX >= rect.left && 
            clientX <= rect.right && 
            clientY >= rect.top && 
            clientY <= rect.bottom;
        
        if (isOverBoard) {
            // Check if the ship can be placed at the target position
            if (shipStartX >= 0 && shipStartX < BOARD_SIZE && 
                shipStartY >= 0 && shipStartY < BOARD_SIZE &&
                canPlaceShip(shipStartX, shipStartY)) {
                
                // Valid placement - place the ship
                placeShip(shipStartX, shipStartY);
            } else if (dragStartWasPlaced && dragStartPosition && dragStartOrientation) {
                // Invalid placement on board - return to original position
                currentOrientation = dragStartOrientation;
                placeShip(dragStartPosition.x, dragStartPosition.y);
            }
            // If not previously placed and invalid placement, just keep it unplaced
        } else if (!anyPartOnBoard) {
            // Only unplace the ship if NO part of it is over the board
            if (selectedShip) {
                // Ensure the ship is marked as unplaced
                selectedShip.placed = false;
                selectedShip.position = undefined;
                selectedShip.orientation = undefined;
            }
        } else if (dragStartWasPlaced && dragStartPosition && dragStartOrientation) {
            // Ship is partially on board and was previously placed - return to original position
            currentOrientation = dragStartOrientation;
            placeShip(dragStartPosition.x, dragStartPosition.y);
        }

        // Clear dragging state
        isDragging = false;
        selectedShip = null;
        previewCells = [];
        previewState = null;
        
        // Force update of all relevant arrays
        board = [...board];
        shipGrid = [...shipGrid];
        ships = [...ships];
    }

    function handleRotateClick(event: MouseEvent | TouchEvent, ship: Ship) {
        if (isReady) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        if (!ship || !ship.position || !ship.orientation) return;

        // Save original position and orientation
        const originalPosition = {...ship.position};
        const originalOrientation = ship.orientation;
        
        // Set as selected ship and try the other orientation
        selectedShip = ship;
        const newOrientation = originalOrientation === 'horizontal' ? 'vertical' : 'horizontal';
        currentOrientation = newOrientation;
        
        // Temporarily hide the ship
        removeShip(ship);
        
        // Check if can place with new orientation
        const canRotate = canPlaceShip(originalPosition.x, originalPosition.y);
        
        if (canRotate) {
            // If rotation is possible, place with new orientation
            placeShip(originalPosition.x, originalPosition.y);
            ships = [...ships]; // Force UI update
        } else {
            // Show invalid preview cells
            updatePreview(originalPosition.x, originalPosition.y);
            
            // Wait a moment to show the invalid preview before restoring
            setTimeout(() => {
                // Clear preview
                previewCells = [];
                previewState = null;
                
                // Revert to original orientation
                currentOrientation = originalOrientation;
                
                // Restore ship to original position and orientation
                placeShip(originalPosition.x, originalPosition.y);
                
                // Force UI update
                ships = [...ships];
                board = [...board];
                shipGrid = [...shipGrid];
            }, 500);
        }
        
        // Important: reset the selection to prevent conflicts - wait until after animation
        setTimeout(() => {
            selectedShip = null;
        }, 600);
    }

    function updatePreview(x: number, y: number) {
        if (!selectedShip) return;
        
        previewCells = [];
        const length = selectedShip.length;
        let isValid = true;
        
        // First check if any part of the ship would be off the board
        for (let i = 0; i < length; i++) {
            const newX = currentOrientation === 'horizontal' ? x + i : x;
            const newY = currentOrientation === 'vertical' ? y + i : y;
            
            if (newX < 0 || newX >= BOARD_SIZE || newY < 0 || newY >= BOARD_SIZE) {
                isValid = false;
                // Don't break - we still want to collect valid cells for the preview
            }
        }
        
        // Then add all cells that are within the board to the preview
        for (let i = 0; i < length; i++) {
            const newX = currentOrientation === 'horizontal' ? x + i : x;
            const newY = currentOrientation === 'vertical' ? y + i : y;
            
            // Only add cells that are actually on the board
            if (newX >= 0 && newX < BOARD_SIZE && newY >= 0 && newY < BOARD_SIZE) {
                previewCells.push({ x: newX, y: newY });
                
                // Also check for overlapping ships
                if (board[newY][newX] === 'ship' && shipGrid[newY][newX] !== selectedShip) {
                    isValid = false;
                }
            }
        }
        
        previewState = isValid ? 'valid' : 'invalid';
    }

    function canPlaceShip(x: number, y: number): boolean {
        if (!selectedShip) return false;
        
        const length = selectedShip.length;
        for (let i = 0; i < length; i++) {
            const newX = currentOrientation === 'horizontal' ? x + i : x;
            const newY = currentOrientation === 'vertical' ? y + i : y;
            
            if (newX >= BOARD_SIZE || newY >= BOARD_SIZE) return false;
            
            // Allow overlapping with the same ship being moved
            if (board[newY][newX] === 'ship' && shipGrid[newY][newX] !== selectedShip) {
                return false;
            }
        }
        return true;
    }

    function placeShip(x: number, y: number) {
        if (!selectedShip) return;
        
        const length = selectedShip.length;
        for (let i = 0; i < length; i++) {
            const newX = currentOrientation === 'horizontal' ? x + i : x;
            const newY = currentOrientation === 'vertical' ? y + i : y;
            board[newY][newX] = 'ship';
            shipGrid[newY][newX] = selectedShip;
        }
        
        selectedShip.placed = true;
        selectedShip.position = { x, y };
        selectedShip.orientation = currentOrientation;
        checkAllShipsPlaced();
    }

    function removeShip(ship: Ship) {
        if (!ship.position) return;
        
        const length = ship.length;
        for (let i = 0; i < length; i++) {
            const x = ship.orientation === 'horizontal' ? ship.position.x + i : ship.position.x;
            const y = ship.orientation === 'vertical' ? ship.position.y + i : ship.position.y;
            board[y][x] = 'empty';
            shipGrid[y][x] = null;
        }
        
        // Need to set placed to false when removing from board
        ship.placed = false;
        checkAllShipsPlaced();
    }

    function checkAllShipsPlaced() {
        allShipsPlaced = ships.every(ship => ship.placed);
    }

    function handleReady() {
        if (!allShipsPlaced) return;
        isReady = true;
        dispatch('ready', { ships, board, shipGrid });
    }

    // Function to check if a cell is the center of a ship
    function isShipCenter(ship: Ship, x: number, y: number): boolean {
        if (!ship.position || !ship.orientation) return false;
        
        if (ship.orientation === 'horizontal') {
            return x === Math.floor(ship.position.x + ship.length / 2) && y === ship.position.y;
        } else {
            return y === Math.floor(ship.position.y + ship.length / 2) && x === ship.position.x;
        }
    }

    // Function to check if a cell is the first cell of a ship
    function isShipStart(ship: Ship, x: number, y: number): boolean {
        if (!ship.position) return false;
        return x === ship.position.x && y === ship.position.y;
    }

    // Function to receive a shot from the opponent
    export function receiveShot(x: number, y: number): 'hit' | 'miss' | 'sunk' {

        let result: 'hit' | 'miss' | 'sunk' = 'miss';

        if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) {
            return result;
        }
        
        
        if (board[y][x] === 'ship') {
            board[y][x] = 'hit';
            
            // Find the ship that was hit
            const ship = shipGrid[y][x];
            if (ship) {
                console.log('Player ship hit:', ship);
                ship.hits = (ship.hits || 0) + 1;
                
                // Check if the ship is sunk
                if (ship.hits === ship.length) {
                    ship.sunk = true;
                    result = 'sunk';
                } else {
                    result = 'hit';
                }
            }
        } else if (board[y][x] === 'empty') {
            console.log('Player ship missed');
            board[y][x] = 'miss';
        }
        
        // Force UI update
        board = [...board];
        ships = [...ships];
        
        return result;
    }
</script>

<div class="game-board">
    <div class="game-info">
        <h2>{username}'s Fleet</h2>
        {#if !isReady}
        <div class="ships-container">
            {#if allShipsPlaced}
                <p class="fleet-deployed">Your entire fleet has been deployed!</p>
            {:else}
                {#each ships as ship}
                    <button 
                        class="ship-button {ship.placed ? 'placed' : ''}"
                        on:mousedown={(e) => handleShipDragStart(e, ship)}
                        on:touchstart={(e) => handleShipDragStart(e, ship)}
                        style="width: {ship.length * 40}px;"
                        disabled={ship.placed}
                    >
                        {ship.type} {ship.id}
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
                                        on:mousedown={(e) => e.stopPropagation()}
                                        on:touchstart={(e) => e.stopPropagation()}
                                    >
                                        ↻
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
                transform: translate(
                    {currentOrientation === 'horizontal' ? -dragOffsetRelativeToShipStart.x * 40 : 0}px,
                    {currentOrientation === 'vertical' ? -dragOffsetRelativeToShipStart.y * 40 : 0}px
                );
            "
        >
            <span>{selectedShip.id}</span>
        </div>
    {/if}

    {#if allShipsPlaced && !isReady}
        <button class="ready-button" on:click={handleReady}>
            I'm ready!
        </button>
    {/if}
</div>

<svelte:window 
    on:mousemove={handleShipDragMove} 
    on:mouseup={handleShipDragEnd}
    on:touchmove={handleShipDragMove}
    on:touchend={handleShipDragEnd}
/>

<style>

    h2 {
        margin: 0;
        color: #ffd700;
        text-shadow: 
            0 0 7px #ffd700,
            0 0 14px #ffd700;
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

    .ships-container {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: center;
        align-items: center;
        padding: 1rem;
        width: 400px;
        min-height: 90px;
        background-color: #1b263b;
        color: #e0e1dd;
        border-radius: 5px;
        border-style: solid;
        border-color: #f05972;
        border-width: 2px;
        box-shadow: 0 0px 12px rgba(237, 74, 213, 0.6);

    }


    .fleet-deployed {
        color: #e0e1dd;
        font-weight: normal;
        margin: 0;
        font-size: 1.1rem;
    }

    .ship-button {
        padding: 0.5rem;
        border: 2px solid #3498db;
        border-radius: 5px;
        background-color: white;
        color: #3498db;
        cursor: grab;
        transition: all 0.2s;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.81rem;
        text-transform: capitalize;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
    }

    .ship-button.placed {
        opacity: 0.5;
        background-color: #ecf0f1;
        color: #7f8c8d;
        border-color: #95a5a6;
        cursor: not-allowed;
    }

    .ship-button:active {
        cursor: grabbing;
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
        touch-action: none;
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
        cursor: default;
    }

    .cell.ship {
        background-color: #2c3e50;
        cursor: grab;
    }

    .cell.ship.locked {
        cursor: default;
    }

    .cell.ship:active:not(.locked) {
        cursor: grabbing;
    }

    .cell.preview {
        background-color: rgba(52, 152, 219, 0.3);
    }

    .cell.preview.valid {
        background-color: rgba(46, 204, 113, 0.5);
    }

    .cell.preview.invalid {
        background-color: rgba(231, 76, 60, 0.5);
    }

    .ship-label {
        position: absolute;
        top: 0;
        left: 0;
        font-size: 0.7rem;
        color: white;
        background-color: rgba(0, 0, 0, 0.5);
        padding: 1px 3px;
        border-radius: 2px;
        pointer-events: none;
    }

    .drag-ghost {
        position: fixed;
        background-color: rgba(52, 152, 219, 0.7);
        border-radius: 5px;
        color: white;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 1000;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }

    .ready-button {
        padding: 1rem 2rem;
        background-color: #2ecc71;
        color: white;
        border: none;
        border-radius: 5px;
        font-size: 1.2rem;
        cursor: pointer;
        transition: background-color 0.2s;
        width: 422px;
        margin: 0 auto;
        display: block;
    }

    .ready-button:hover {
        background-color: #27ae60;
    }

    .rotate-button {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: rgba(46, 204, 113, 0.9);
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        padding: 0;
        transition: background-color 0.2s;
        z-index: 10;
    }

    .rotate-button:hover {
        background-color: rgba(46, 204, 113, 1);
    }

    .hit-marker, .miss-marker {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 18px;
        pointer-events: none;
    }
    
    .hit-marker {
        color: #2ecc71;
    }

    .hit-marker.sunk {
        color: #ffffff;
        background-color: #e74c3c;
    }

    .miss-marker {
        color: #e74c3c;
    }
</style> 