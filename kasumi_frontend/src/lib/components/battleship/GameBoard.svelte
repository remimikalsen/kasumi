<!-- GameBoard.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Ship } from '@lib/services/battleshipServices';
    import type { GameState } from '@lib/services/battleshipServices';
    const dispatch = createEventDispatcher();
    
    export let username: string;
    export let gameState: GameState;
    export let isOpponent: boolean = false;
    export let showBoard: boolean = true;
    export let isReady: boolean = false;
    export let onReady: ((event: CustomEvent) => void) | null = null;

    const isCPU = gameState.mode === 'cpu';
    const debugMode = gameState.config.debugOpponentBoard || false;
    
    // Board state
    let ships = gameState.playerBoards[username]?.ships;
    let board = gameState.playerBoards[username]?.board;
    let shipGrid = gameState.playerBoards[username]?.shipGrid;
    let inPlayMode = gameState.status === 'active';
    let shotInProgress = false;
    
    // Ship placement state (only for player board)
    let selectedShip: Ship | null = null;
    let isDragging = false;
    let currentOrientation: 'horizontal' | 'vertical' = 'horizontal';
    let allShipsPlaced = false;
    let mousePosition = { x: 0, y: 0 };
    let dragOffset = { x: 0, y: 0 };
    let previewCells: {x: number, y: number}[] = [];
    let previewState: string | null = null;
    let lastPreviewPosition = { x: -1, y: -1 }; // Track last preview position
    
    // React to gameState changes
    $: {
        if (gameState?.playerBoards[username]) {
            ships = gameState.playerBoards[username].ships;
            board = gameState.playerBoards[username].board;
            shipGrid = gameState.playerBoards[username].shipGrid;
            inPlayMode = gameState.status === 'active';
            // Reset shot in progress when game state updates
            shotInProgress = false;

            if (gameState.status === 'setup') {
                allShipsPlaced = false;
            }

        }
    }
    
    // Ship placement functions (only for player board)
    function handleShipDragStart(event: MouseEvent | TouchEvent, ship: Ship) {
        if (isReady || isOpponent) return;
        
        // Check if the event came from the rotation button
        const target = event.target as HTMLElement;
        if (target.classList.contains('rotate-button')) {
            return; // Don't initiate drag if clicking the rotation button
        }
        
        event.preventDefault();
        
        selectedShip = ship;
        isDragging = true;
        
        // Calculate the initial position of the ghost based on ship origin
        const element = event.currentTarget as HTMLElement;
        const rect = element.getBoundingClientRect();
        
        let initialX, initialY;
        // For mouse events
        if ('clientX' in event) {
            initialX = event.clientX;
            initialY = event.clientY;
        } 
        // For touch events
        else if (event.touches && event.touches.length) {
            initialX = event.touches[0].clientX;
            initialY = event.touches[0].clientY;
        } else {
            return;
        }
        
        // Set initial mouse position
        mousePosition = { x: initialX, y: initialY };
        
        // Set the current orientation based on the ship's current orientation
        currentOrientation = ship.orientation || 'horizontal';
        
        // Calculate drag offset based on where in the ship the user clicked
        if (ship.placed && ship.position) {
            // If dragging from the board, preserve the relative position where user clicked
            const boardElement = document.querySelector('.board') as HTMLElement;
            if (boardElement) {
                const boardRect = boardElement.getBoundingClientRect();
                const cellSize = 40;
                const gap = 2; // Gap between cells
                
                // Get the position of the click in the grid
                const clickGridX = Math.floor((initialX - boardRect.left) / (cellSize + gap));
                const clickGridY = Math.floor((initialY - boardRect.top) / (cellSize + gap));
                
                // Calculate which cell of the ship was clicked
                let cellIndexClicked;
                if (ship.orientation === 'horizontal') {
                    cellIndexClicked = clickGridX - ship.position.x;
                } else {
                    cellIndexClicked = clickGridY - ship.position.y;
                }
                
                // Clamp to valid range
                cellIndexClicked = Math.max(0, Math.min(cellIndexClicked, ship.length - 1));
                
                // Set drag offset based on orientation
                dragOffset = {
                    x: ship.orientation === 'horizontal' ? cellIndexClicked : 0.5,
                    y: ship.orientation === 'vertical' ? cellIndexClicked : 0.5
                };
                
                // Now remove the ship from the board
                removeShip(ship);
            }
        } else {
            // If dragging from the ship selection area
            dragOffset = { 
                x: Math.min(Math.max(0, Math.floor((initialX - rect.left) / 40)), ship.length - 1),
                y: 0.5
            };
        }
        
        // Add event listeners for drag movement and end
        window.addEventListener('mousemove', handleShipDragMove);
        window.addEventListener('touchmove', handleShipDragMove, { passive: false });
        window.addEventListener('mouseup', handleShipDragEnd);
        window.addEventListener('touchend', handleShipDragEnd);
    }
    
    function handleShipDragMove(event: MouseEvent | TouchEvent) {
        if (!isDragging || !selectedShip || isReady || isOpponent) return;
        
        // Prevent default behaviors like scrolling
        if ('preventDefault' in event) {
            event.preventDefault();
        }
        
        // Update mouse position
        if ('clientX' in event) {
            mousePosition = { x: event.clientX, y: event.clientY };
        } else if (event.touches && event.touches.length) {
            mousePosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }
        
        // Get the board element
        const boardElement = document.querySelector('.board') as HTMLElement;
        if (!boardElement) return;
        
        const boardRect = boardElement.getBoundingClientRect();
        
        // Check if mouse is extremely far from the board (more than 3 cells away)
        const farDistance = 120; // 3 cells
        const isVeryFarFromBoard = 
            mousePosition.x < boardRect.left - farDistance || 
            mousePosition.x > boardRect.right + farDistance || 
            mousePosition.y < boardRect.top - farDistance || 
            mousePosition.y > boardRect.bottom + farDistance;
            
        if (isVeryFarFromBoard) {
            // Only clear preview when very far from the board
            previewCells = [];
            lastPreviewPosition = { x: -1, y: -1 };
            return;
        }
        
        // Calculate grid position on the board
        const cellSize = 40; // Cell size in pixels
        const gap = 2; // Gap between cells
        const gridX = Math.floor((mousePosition.x - boardRect.left) / (cellSize + gap));
        const gridY = Math.floor((mousePosition.y - boardRect.top) / (cellSize + gap));
        
        // Apply drag offset based on orientation
        let adjustedX, adjustedY;
        
        if (currentOrientation === 'horizontal') {
            adjustedX = gridX - Math.floor(dragOffset.x);
            adjustedY = gridY;
        } else {
            adjustedX = gridX;
            adjustedY = gridY - Math.floor(dragOffset.y);
        }
        
        // Always update preview when position changes
        if (lastPreviewPosition.x !== adjustedX || lastPreviewPosition.y !== adjustedY) {
            updatePreview(adjustedX, adjustedY);
            lastPreviewPosition = { x: adjustedX, y: adjustedY };
        }
    }
    
    function handleShipDragEnd(event: MouseEvent | TouchEvent) {
        if (!isDragging || !selectedShip || isReady || isOpponent) return;
        
        event.preventDefault();
        
        // Remove event listeners
        window.removeEventListener('mousemove', handleShipDragMove);
        window.removeEventListener('touchmove', handleShipDragMove);
        window.removeEventListener('mouseup', handleShipDragEnd);
        window.removeEventListener('touchend', handleShipDragEnd);
        
        // Get the board element
        const boardElement = document.querySelector('.board') as HTMLElement;
        if (!boardElement) {
            isDragging = false;
            previewCells = [];
            return;
        }
        
        const boardRect = boardElement.getBoundingClientRect();
        
        // Calculate grid position on the board
        const cellSize = 40; // Cell size in pixels
        const gap = 2; // Gap between cells
        const gridX = Math.floor((mousePosition.x - boardRect.left) / (cellSize + gap));
        const gridY = Math.floor((mousePosition.y - boardRect.top) / (cellSize + gap));
        
        // Apply drag offset based on orientation - same logic as in handleShipDragMove
        let adjustedX, adjustedY;
        
        if (currentOrientation === 'horizontal') {
            adjustedX = gridX - Math.floor(dragOffset.x);
            adjustedY = gridY;
        } else {
            adjustedX = gridX;
            adjustedY = gridY - Math.floor(dragOffset.y);
        }
        
        // Check if the position is valid for placement
        const isValidPlacement = adjustedX >= 0 && adjustedX < 10 && 
                                adjustedY >= 0 && adjustedY < 10 && 
                                canPlaceShip(adjustedX, adjustedY);
        
        if (isValidPlacement) {
            placeShip(adjustedX, adjustedY);
        } else {
            // If invalid placement, ensure ship is marked as unplaced 
            // (it's already removed from the board during drag start)
            if (selectedShip) {
                selectedShip.placed = false;
                selectedShip.position = undefined;
                selectedShip.orientation = 'horizontal';
            }
            // Update ships array to ensure reactivity
            ships = [...ships];
        }
        
        // Reset state
        isDragging = false;
        selectedShip = null;
        previewCells = [];
        lastPreviewPosition = { x: -1, y: -1 };
        
        checkAllShipsPlaced();
    }
    
    function handleBoardCellMouseDown(event: MouseEvent | TouchEvent, x: number, y: number) {
        if (isReady || isOpponent || inPlayMode) return;
        
        if (board[y][x] === 'ship') {
            const shipId = shipGrid[y][x];
            const ship = ships.find(ship => ship.id === shipId);
            if (ship) {
                handleShipDragStart(event, ship);
            }
        }
    }
    
    function handleAutoPlaceClick() {
        if (isReady || isOpponent) return;
        
        ships.forEach(ship => {
            if (ship.placed) {
                removeShip(ship);
            }
        });
        
        ships.forEach(ship => {
            let placed = false;
            let attempts = 0;
            
            while (!placed && attempts < 100) {
                const x = Math.floor(Math.random() * 10);
                const y = Math.floor(Math.random() * 10);
                currentOrientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
                
                selectedShip = ship;
                
                if (canPlaceShip(x, y)) {
                    placeShip(x, y);
                    placed = true;
                }
                
                attempts++;
            }
        });
        
        selectedShip = null;
        board = [...board];
        shipGrid = [...shipGrid];
        ships = [...ships];
        
        checkAllShipsPlaced();
    }
    
    function handleRotateClick(event: MouseEvent, ship: Ship) {
        if (isReady || isOpponent || ship.length <= 1) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        // Store current orientation and position to revert if needed
        const originalOrientation = ship.orientation || 'horizontal';
        const originalPosition = ship.position;
        
        if (!originalPosition) return;
        
        // Remove the ship from its current position
        removeShip(ship);
        
        // Toggle orientation
        const newOrientation = originalOrientation === 'horizontal' ? 'vertical' : 'horizontal';
        currentOrientation = newOrientation;
        selectedShip = ship;
        
        // Calculate preview cells for the new orientation
        const previewX = originalPosition.x;
        const previewY = originalPosition.y;
        
        // Check if the new orientation is valid
        if (canPlaceShip(previewX, previewY)) {
            // If valid, place the ship with the new orientation
            placeShip(previewX, previewY);
            selectedShip = null;
        } else {
            // Show invalid placement preview briefly
            previewCells = [];
            previewState = 'invalid';
            
            for (let i = 0; i < ship.length; i++) {
                const posX = newOrientation === 'horizontal' ? previewX + i : previewX;
                const posY = newOrientation === 'vertical' ? previewY + i : previewY;
                
                if (posX >= 0 && posX < 10 && posY >= 0 && posY < 10) {
                    previewCells.push({ x: posX, y: posY });
                }
            }
            
            // Revert after a short delay
            setTimeout(() => {
                previewCells = [];
                // Revert to original orientation and place back
                currentOrientation = originalOrientation;
                placeShip(originalPosition.x, originalPosition.y);
                
                selectedShip = null;
            }, 500);
        }
    }
    
    function updatePreview(x: number, y: number) {
        if (!selectedShip) return;
        
        // Clear previous preview
        previewCells = [];
        
        // Track if any part of the ship would be on the board
        let hasVisibleCells = false;
        let isCompletelyValid = true;
        
        // Calculate preview cells based on the grid position
        for (let i = 0; i < selectedShip.length; i++) {
            let posX, posY;
            
            if (currentOrientation === 'horizontal') {
                posX = x + i;
                posY = y;
            } else {
                posX = x;
                posY = y + i;
            }
            
            // Add all cells that are within the board
            if (posX >= 0 && posX < 10 && posY >= 0 && posY < 10) {
                previewCells.push({ x: posX, y: posY });
                hasVisibleCells = true;
                
                // Check if this position would overlap with another ship
                if (board[posY][posX] === 'ship' && shipGrid[posY][posX] !== selectedShip.id) {
                    isCompletelyValid = false;
                }
            } else {
                // Cell is outside the board
                isCompletelyValid = false;
            }
        }
        
        // Only set preview state if we have cells to show
        if (hasVisibleCells) {
            previewState = isCompletelyValid ? 'valid' : 'invalid';
        } else {
            // No visible cells, clear preview
            previewCells = [];
            previewState = null;
        }
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
            
            // Check if any part of the ship would be outside the board
            if (posX < 0 || posX >= 10 || posY < 0 || posY >= 10) {
                return false;
            }
            
            // Check if the cell is occupied by another ship
            if (board[posY][posX] === 'ship' && shipGrid[posY][posX] !== selectedShip.id) {
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
            
            board[posY][posX] = 'ship';
            shipGrid[posY][posX] = selectedShip.id;
        }
        
        // Update the selected ship first
        selectedShip.placed = true;
        selectedShip.position = { x, y };
        selectedShip.orientation = currentOrientation;
        
        // Then update the ships array
        const shipIndex = ships.findIndex(s => s.id === selectedShip?.id);
        if (shipIndex !== -1 && selectedShip) {
            ships[shipIndex] = {
                ...ships[shipIndex],
                placed: true,
                position: { x, y },
                orientation: currentOrientation
            };
            ships = [...ships]; // Force reactivity
        }
        
        // Force board and shipGrid reactivity
        board = [...board];
        shipGrid = [...shipGrid];
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
            
            board[posY][posX] = 'empty';
            shipGrid[posY][posX] = null;
        }
        
        ship.placed = false;
        ship.position = undefined;
        
        // Force reactivity
        board = [...board];
        shipGrid = [...shipGrid];
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
    
    function handleCellClick(x: number, y: number) {
        if (!inPlayMode || shotInProgress) return;
        
        // Don't allow firing on cells that have already been hit or missed
        if (board[y][x] === 'hit' || board[y][x] === 'miss') return;
        
        if (isOpponent) {
            shotInProgress = true;
            dispatch('fire', { position: { x, y } });
        }
    }
        
    
    function handleGhostRotateClick(event: MouseEvent) {
        if (!isDragging || !selectedShip || isReady || isOpponent || selectedShip.length <= 1) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        // Toggle orientation
        currentOrientation = currentOrientation === 'horizontal' ? 'vertical' : 'horizontal';
        
        // Swap drag offsets for the new orientation
        if (dragOffset.x !== 0.5 || dragOffset.y !== 0.5) {
            // Only swap non-center offsets
            const tempX = dragOffset.x;
            dragOffset.x = dragOffset.y;
            dragOffset.y = tempX;
        }
    }
</script>

<div class="game-board {debugMode ? 'debug-mode' : ''} {!showBoard ? 'hidden' : ''}" 
    style="
        --title-color: {isOpponent ? '#e94560' : '#3498db'};
    ">
    <div class="game-info">
        <h2>
            {username}'s Fleet
        </h2>
        
        {#if !isReady && !isOpponent}
            <div class="ship-placement-controls">
                <button class="auto-place-button" on:click={handleAutoPlaceClick}>
                    Auto-place Fleet
                </button>
                
                <button 
                    class="ready-button" 
                    on:click={handleReadyClick}
                    disabled={!allShipsPlaced}
                >
                    I'm ready
                </button>
            </div>
            
            <div class="ship-selection">
                {#if allShipsPlaced}
                    <p class="fleet-deployed">Your fleet is deployed.</p>
                {:else}
                    {#each ships as ship}
                        <button 
                            class="ship-button {ship.placed ? 'placed' : ''}"
                            style="width: {ship.length * 40}px;"
                            on:mousedown={(e) => handleShipDragStart(e, ship)}
                            on:touchstart={(e) => handleShipDragStart(e, ship)}
                        >
                            <span class="ship-name">{ship.type.charAt(0).toUpperCase() + ship.type.slice(1)}</span>
                            <span class="ship-id">{ship.id}</span>
                        </button>
                    {/each}
                {/if}
            </div>
        {/if}


        <div class="user-status">
            <!-- Show player win streak - prioritize server data but fall back to local -->
            {#if isCPU && !isOpponent}
                <div class="difficulty-display">
                    <span class="emoji">{gameState.config.cpuDifficulty === 'easy' ? '🌱' : '🔥'}</span>
                    Playing it {gameState.config.cpuDifficulty}
                </div>
            {/if}   
    
            {#if isCPU && isOpponent}
                <div class="opponent-info">
                    {#if gameState.config.cpuDifficulty === 'easy'}
                        CPU Opponent
                    {:else}
                        Advanced AI Bot
                    {/if}
                </div>
            {/if}   

            {#if !isCPU && isOpponent}
                <div class="opponent-info">
                        Human Opponent
                </div>
            {/if}               
    
            {#if (gameState.winStreaks && gameState.winStreaks[username] > 0) }
                <div class="winning-streak">
                    Win Streak: {(gameState.winStreaks && gameState.winStreaks[username]) || gameState.winStreaks[username]}
                </div>
            {/if}        
        </div>        

    </div>

    <div class="board-container">

        <div class="board">
            {#each board as row, y}
                <div class="row">
                    {#each row as cell, x}
                        <div 
                            class="cell {cell === 'empty' && debugMode && isCPU && shipGrid?.[y]?.[x] ? 'ship' : cell} {inPlayMode && isOpponent && !shotInProgress && cell !== 'hit' && cell !== 'miss' ? 'clickable' : ''} {previewCells.some(p => p.x === x && p.y === y) ? `preview ${previewState}` : ''} {cell === 'ship' && isReady ? 'locked' : ''}"
                            on:mousedown={(e) => handleBoardCellMouseDown(e, x, y)}
                            on:touchstart={(e) => handleBoardCellMouseDown(e, x, y)}
                            on:click={() => handleCellClick(x, y)}
                        >
                            {#if shipGrid[y][x] && (!isOpponent || debugMode)}
                                <span class="ship-label">
                                    {shipGrid[y][x]}
                                </span>
                            {/if}
                            
                            {#if cell === 'hit'}
                                {@const ship = ships.find(ship => ship.id === shipGrid[y][x])}
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
            
            <!-- Rotation buttons for ships -->
            {#if !isReady && !isOpponent}
                {#each ships as ship}
                    {#if ship.placed && ship.position && ship.length > 1 && (!isDragging || selectedShip?.id !== ship.id)}
                        <!-- Calculate the exact center point of the ship -->
                        {@const cellSize = 40}
                        {@const gap = 2}
                        {@const isEvenLength = ship.length % 2 === 0}
                        {@const offset = isEvenLength ? 0.5 : 0}
                        
                        <!-- Position is different for even vs odd length ships -->
                        {@const centerX = ship.orientation === 'horizontal' 
                            ? (ship.position.x + (ship.length - 1) / 2) * (cellSize + gap) + (cellSize / 2)
                            : ship.position.x * (cellSize + gap) + (cellSize / 2)}
                            
                        {@const centerY = ship.orientation === 'vertical'
                            ? (ship.position.y + (ship.length - 1) / 2) * (cellSize + gap) + (cellSize / 2)
                            : ship.position.y * (cellSize + gap) + (cellSize / 2)}
                        
                        <button 
                            class="rotate-button"
                            style="left: {centerX}px; top: {centerY}px;"
                            on:click|stopPropagation={(e) => handleRotateClick(e, ship)}
                        >
                            ⟳
                        </button>
                    {/if}
                {/each}
            {/if}
        </div>
    </div>

    {#if isReady}
    <div class="ship-list">
        <h3>Fleet status</h3>
        <div class="ship-items-container">
            {#each [...ships].sort((a, b) => b.length - a.length) as ship, i}
                <span class="ship-item">
                    <span class="ship-name {ship.sunk ? 'sunk' : ''}">
                        {ship.type[0].toUpperCase() + ship.type.slice(1)}
                    </span>
                    {#if !isOpponent}
                        {#if ship.sunk}
                            <span class="sunk-marker">✘</span>
                        {:else if ship.hits > 0}
                            <span class="damaged-marker">⚠</span>
                        {:else}
                            <span class="intact-marker">✓</span>
                        {/if}
                    {:else if ship.sunk}
                        <span class="sunk-marker">✘</span>
                    {/if}
                </span>
                {#if i < ships.length - 1}
                    <span class="separator">•</span>
                {/if}
            {/each}
        </div>
    </div>
    {/if}
    
    {#if isDragging && selectedShip}
        <!-- Ghost ship -->
        <div class="drag-ghost" 
            style="
                left: {currentOrientation === 'horizontal' 
                    ? mousePosition.x - dragOffset.x * 40 
                    : mousePosition.x - 20}px; 
                top: {currentOrientation === 'vertical' 
                    ? mousePosition.y - dragOffset.y * 40 
                    : mousePosition.y - 20}px; 
                width: {currentOrientation === 'horizontal' ? selectedShip.length * 40 : 40}px;
                height: {currentOrientation === 'vertical' ? selectedShip.length * 40 : 40}px;
            ">
            {selectedShip.id}
            
            <!-- Rotation button on ghost ship -->
            {#if selectedShip.length > 1}
                <button 
                    class="rotate-button ghost-rotate"
                    on:click|stopPropagation={handleGhostRotateClick}
                >
                    ⟳
                </button>
            {/if}
        </div>
    {/if}
</div>

<style>
    .game-board {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
        position: relative;
    }

    h2 {
        margin: 0;
        color: var(--title-color);
        font-weight: bold;
        font-size: 2rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .game-info {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        align-items: center;
        width: 100%;
        max-width: 420px; /* 10 cells * 40px + 2px gap * 9 + 4px padding */
        margin: 0 auto;
    }

    .ship-placement-controls {
        display: flex;
        gap: 1rem;
        width: 100%;
        justify-content: center;
    }

    .ship-selection {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        justify-content: center;
        width: 100%;
        border-radius: 8px;
        padding: 1rem;
        background-color: #ecf0f1;
        box-sizing: border-box;
        margin-bottom: 1rem;
    }

    .ship-button {
        padding: 0.25rem 2px;
        border: none;
        border-radius: 5px;
        background-color: #34495e;
        color: white;
        cursor: pointer;
        transition: all 0.2s;
        height: 40px;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 0.9rem;
        position: relative;
        box-shadow: 0 0 5px 0 rgba(0, 0, 0, 0.5);
    }

    .ship-button:hover:not(.placed) {
        background-color: #3498db;
        color: white;
    }

    .ship-button.placed {
        background-color: #6f828c;
        color: white;
        cursor: not-allowed;
        pointer-events: none;
    }

    /* Remove the general hover effect for placed ships */
    .ship-button.placed:hover {
        background-color: #77797a;
        color: white;
    }

    .fleet-deployed {
        color: #0d1b2a;
        font-weight: bold;
        font-size: 1.1rem;
        margin: 0;
        text-align: center;
    }

    .auto-place-button, .ready-button {
        padding: 0.75rem 1.25rem;
        border: none;
        border-radius: 5px;
        font-weight: bold;
        cursor: pointer;
        transition: background-color 0.2s;
        font-size: 0.9rem;
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
        background-color: #77797a;
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
        background-color: var(--board-color);
        padding: 2px;
        border-radius: 5px;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        position: relative;
    }

    .user-status {
        display: flex;
        flex-direction: row;
        width: 100%;
        min-height: 30px;
        align-items: center;
        justify-content: var(--justify, flex-start);
        gap: 1rem;
        margin: 0;
        padding: 0px;
        margin-top: -1rem;
        margin-bottom: -0.5rem;
    }

    /* Set justify-content based on number of children using :has() */
    .user-status:has(> :nth-child(2)) {
        --justify: space-around;
    }

    .opponent-info {
        font-size: 1rem;
        display: inline-block;
    }

    .difficulty-display {
        font-size: 1rem;
        display: inline-block;
    }

    .winning-streak {
        font-size: 1rem;
        display: inline-block;
    }

    .row {
        display: grid;
        grid-template-columns: repeat(10, 1fr);
        gap: 2px;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
    }

    .cell {
        position: relative;
        width: 40px;
        height: 40px;
        background-color: #ecf0f1;
        border-radius: 2px;
        transition: background-color 0.2s;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
    }

    /* Remove the general hover effect */
    .cell:hover:not(.locked):not(.clickable):not(.ship):not(.preview) {
        background-color: #ecf0f1;
    }

    .cell.ship {
        background-color: #34495e;
    }

    .cell.ship.locked {
        cursor: default;
    }

    .cell.hit {
        background-color: #f39c12;
    }

    .cell.miss {
        background-color: #95a5a6;
    }

    .cell.preview.valid {
        background-color: rgba(46, 204, 113, 0.5) !important;
    }

    .cell.preview.invalid {
        background-color: rgba(231, 77, 60, 0.85) !important;
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
        opacity: 0.8;
        transition: opacity 0.2s;
        pointer-events: all; /* Ensure clicks are captured */
    }

    .rotate-button:hover {
        opacity: 1;
        background-color: #2980b9;
    }

    .ship-label {
        position: absolute;
        top: 1px;
        left: 2px;
        font-size: 0.6rem;
        color: white;
        pointer-events: none;
        z-index: 1;
    }

    .hit-marker, .miss-marker {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 1.5rem;
        font-weight: bold;
        pointer-events: none;
        color: #000000;
    }
    
    .hit-marker {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 18px;
    }

    .hit-marker.sunk {
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

    .ghost-rotate {
        position: absolute;
        top: 50%;
        left: 50%;
        pointer-events: all; /* Enable clicking */
        z-index: 1001;
    }

    .game-board.hidden {
        display: none;
    }
    
    /* Clickable states - only for opponent board */
    .cell.clickable:not(.hit):not(.miss):hover {
        cursor: crosshair;
        background-color: rgba(46, 204, 112, 0.85);
    }
    
    .cell.clickable.hit:hover,
    .cell.clickable.miss:hover {
        cursor: not-allowed;
        background-color: rgba(231, 76, 60, 0.7); /* Red background for better visual indication */
    }
    
    .cell.hit:hover,
    .cell.miss:hover {
        cursor: not-allowed;
        background-color: rgba(231, 76, 60, 0.7); /* Red background for better visual indication */
    }
    
    /* Remove the not-clickable hover effect */
    .cell:not(.clickable):not(.ship):hover {
        cursor: default;
        background-color: #ecf0f1;
    }

    .ship-name {
        font-size: 0.8rem;
        display: block;
        width: 100%;
        text-align: center;
    }

    .ship-id {
        position: absolute;
        top: 1px;
        left: 2px;
        font-size: 0.6rem;
        opacity: 0.7;
    }

    .difficulty-display {
        font-size: 1rem;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        opacity: 0.8;
        color: white;
        text-shadow: none;
    }

    .difficulty-display .emoji {
        font-size: 1em;
    }


    .ship-list {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.5rem;
        max-width: 420px;
        text-align: left;
        border-radius: 8px;
    }

    .ship-list h3 {
        margin: 0;
        padding: 0;
        font-size: 1.3rem;
    }

    .ship-items-container {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
        line-height: 1.2;
    }

    .ship-item {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
    }

    .separator {
        color: #ecf0f1;
        opacity: 0.7;
    }

    .ship-list .ship-name {
        display: inline;
        font-size: 0.9rem;
        text-align: left;
        color: #ecf0f1;
    }

    .ship-list .ship-name.sunk {
        text-decoration: line-through;
        opacity: 0.7;
    }

    .sunk-marker {
        display: inline;
        color: #e74c3c;
        font-weight: bold;
    }
    
    .damaged-marker {
        display: inline;
        color: #f39c12;
        font-weight: bold;
    }
    
    .intact-marker {
        display: inline;
        color: #2ecc71;
        font-weight: bold;
    }
</style> 