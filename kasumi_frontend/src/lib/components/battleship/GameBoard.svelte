<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();

    export let username: string;
    export let isCPU: boolean;

    type ShipType = 'battleship' | 'frigate' | 'corvette' | 'uboat';
    type Ship = {
        type: ShipType;
        length: number;
        placed: boolean;
        position?: { x: number; y: number };
        orientation?: 'horizontal' | 'vertical';
        id: string;
    };

    type CellState = 'empty' | 'ship' | 'hit' | 'miss';
    type PreviewState = 'valid' | 'invalid' | null;

    const BOARD_SIZE = 10;
    let ships: Ship[] = [
        { type: 'battleship', length: 5, placed: false, id: 'B1' },
        { type: 'frigate', length: 3, placed: false, id: 'F1' },
        { type: 'corvette', length: 2, placed: false, id: 'C1' },
        { type: 'corvette', length: 2, placed: false, id: 'C2' },
        { type: 'uboat', length: 1, placed: false, id: 'U1' },
        { type: 'uboat', length: 1, placed: false, id: 'U2' },
        { type: 'uboat', length: 1, placed: false, id: 'U3' },
        { type: 'uboat', length: 1, placed: false, id: 'U4' }
    ];

    let board: CellState[][] = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill('empty'));
    let selectedShip: Ship | null = null;
    let isDragging = false;
    let currentOrientation: 'horizontal' | 'vertical' = 'horizontal';
    let isReady = false;
    let allShipsPlaced = false;
    let dragOffset = { x: 0, y: 0 };
    let mousePosition = { x: 0, y: 0 };
    let dragOffsetRelativeToShipStart = { x: 0, y: 0 };

    // For ship placement preview
    let previewCells: { x: number; y: number }[] = [];
    let previewState: PreviewState = null;

    // Add a shipGrid to track which ship is in each cell
    let shipGrid: (Ship | null)[][] = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

    // Force UI to update reactively when ships array changes
    $: placedShips = ships.filter(ship => ship.placed);
    $: unplacedShips = ships.filter(ship => !ship.placed);

    function handleShipDragStart(event: MouseEvent | TouchEvent, ship: Ship) {
        event.preventDefault();
        event.stopPropagation();
        
        isDragging = true;
        selectedShip = ship;
        currentOrientation = ship.orientation || 'horizontal';
        
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
        event.preventDefault();
        event.stopPropagation();
        
        // Check if there's a ship at this position
        const ship = shipGrid[y][x];
        if (ship && ship.position) {
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
        
        // Convert mouse position to cell coordinates
        const cellX = Math.floor((clientX - rect.left) / 40);
        const cellY = Math.floor((clientY - rect.top) / 40);
        
        // Adjust coordinates to get the ship's starting position based on which cell was clicked
        const shipStartX = cellX - dragOffsetRelativeToShipStart.x;
        const shipStartY = cellY - dragOffsetRelativeToShipStart.y;
        
        if (shipStartX >= 0 && shipStartX < BOARD_SIZE && shipStartY >= 0 && shipStartY < BOARD_SIZE) {
            updatePreview(shipStartX, shipStartY);
        } else {
            // Clear preview if outside the board
            previewCells = [];
            previewState = null;
        }
    }

    function handleShipDragEnd(event: MouseEvent | TouchEvent) {
        if (!isDragging || !selectedShip) return;
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
        
        // Convert mouse position to cell coordinates
        const cellX = Math.floor((clientX - rect.left) / 40);
        const cellY = Math.floor((clientY - rect.top) / 40);
        
        // Adjust coordinates to get the ship's starting position based on which cell was clicked
        const shipStartX = cellX - dragOffsetRelativeToShipStart.x;
        const shipStartY = cellY - dragOffsetRelativeToShipStart.y;

        // Save original position if it exists (for returning ship if placement fails)
        const originalPosition = selectedShip.position ? {...selectedShip.position} : null;
        const originalOrientation = selectedShip.orientation;
        const wasPlaced = selectedShip.placed;

        if (shipStartX >= 0 && shipStartX < BOARD_SIZE && shipStartY >= 0 && shipStartY < BOARD_SIZE) {
            const canPlace = canPlaceShip(shipStartX, shipStartY);
            if (canPlace) {
                placeShip(shipStartX, shipStartY);
            } else if (wasPlaced && originalPosition) {
                // If the ship was previously placed and new placement failed, 
                // put it back where it was
                currentOrientation = originalOrientation || 'horizontal';
                placeShip(originalPosition.x, originalPosition.y);
            }
            // If invalid placement and ship wasn't placed before, just keep it unplaced
        } else if (wasPlaced && originalPosition) {
            // If dragged out of board but was previously placed, 
            // put it back where it was
            currentOrientation = originalOrientation || 'horizontal';
            placeShip(originalPosition.x, originalPosition.y);
        }

        isDragging = false;
        previewCells = [];
        previewState = null;
        dragOffsetRelativeToShipStart = { x: 0, y: 0 };
        
        // Force UI update
        ships = [...ships];
    }

    function handleRotateClick(event: MouseEvent | TouchEvent, ship: Ship) {
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
        
        removeShip(ship);

        // Check if can place with new orientation
        const canRotate = canPlaceShip(originalPosition.x, originalPosition.y);
        
        if (canRotate) {
            // Place with new orientation
            placeShip(originalPosition.x, originalPosition.y);
        } else {
            // Revert to original orientation
            currentOrientation = originalOrientation;
            placeShip(originalPosition.x, originalPosition.y);
        }
        
        // Force UI update
        ships = [...ships];
        
        // Important: reset the selection to prevent conflicts
        setTimeout(() => {
            selectedShip = null;
        }, 0);
    }

    function updatePreview(x: number, y: number) {
        if (!selectedShip) return;
        
        previewCells = [];
        const length = selectedShip.length;
        let isValid = true;
        
        for (let i = 0; i < length; i++) {
            const newX = currentOrientation === 'horizontal' ? x + i : x;
            const newY = currentOrientation === 'vertical' ? y + i : y;
            
            if (newX < BOARD_SIZE && newY < BOARD_SIZE) {
                previewCells.push({ x: newX, y: newY });
                
                // Allow overlapping with the same ship being moved
                if (board[newY][newX] === 'ship' && shipGrid[newY][newX] !== selectedShip) {
                    isValid = false;
                }
            } else {
                isValid = false;
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
        dispatch('ready', { ships, board });
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
</script>

<div class="game-board">
    <div class="game-info">
        <h2>{username}'s Fleet</h2>
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
    </div>

    <div class="board-container">
        <div class="board">
            {#each board as row, y}
                <div class="row">
                    {#each row as cell, x}
                        <div 
                            class="cell {cell} {previewCells.some(p => p.x === x && p.y === y) ? `preview ${previewState}` : ''}"
                            on:mousedown={(e) => handleBoardCellMouseDown(e, x, y)}
                            on:touchstart={(e) => handleBoardCellMouseDown(e, x, y)}
                        >
                            {#if cell === 'ship'}
                                {@const ship = shipGrid[y][x]}
                                {#if ship && isShipCenter(ship, x, y) && ship.length > 1}
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
                        </div>
                    {/each}
                </div>
            {/each}
        </div>
    </div>

    {#if isDragging && selectedShip}
        <div class="drag-ghost" 
            style="
                left: {mousePosition.x - dragOffset.x}px; 
                top: {mousePosition.y - dragOffset.y}px; 
                width: {currentOrientation === 'horizontal' ? selectedShip.length * 40 : 40}px;
                height: {currentOrientation === 'vertical' ? selectedShip.length * 40 : 40}px;
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
        background-color: #f7f9fc;
        border-radius: 5px;
        width: 400px;
        min-height: 60px;
    }

    .fleet-deployed {
        color: #000000;
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

    .cell.ship:active {
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
        width: 400px;
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
</style> 