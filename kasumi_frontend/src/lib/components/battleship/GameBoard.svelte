<!-- GameBoard.svelte -->
<script lang="ts">
    import { createEventDispatcher, onDestroy } from 'svelte';
    import type { Ship } from '@lib/services/battleshipServices';
    import type { GameState } from '@lib/services/battleshipServices';
    import { getLocalizedText, loadTexts, activeLanguage } from '$lib/stores/translatedTexts.js';
    import { battleshipConfig } from '@lib/config/battleshipConfig';

    const pageTexts = 'battleship';

    type ShipType = 'battleship' | 'frigate' | 'corvette' | 'uboat';
    type Language = 'en' | 'no' | 'pt';

    let isLoadingTexts = true;

    async function fetchTexts() {
        isLoadingTexts = true;
        await loadTexts(pageTexts);
        isLoadingTexts = false;
    }

    $: $activeLanguage, fetchTexts();
    
    const dispatch = createEventDispatcher();
    
    export let username: string;
    export let gameState: GameState;
    export let isOpponent: boolean = false;
    export let showBoard: boolean = true;
    export let isReady: boolean = false;
    export let showTurnOverlay: boolean = false;

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
    let winStreak = 0;
    
    let showRetreatConfirm = false;
    
    // Add a reactive variable for cell size calculation
    let boardElement: HTMLElement;
    let cellSize = 40; // Default size that will be updated
    let cellGap = 2;
    let resizeObserver: ResizeObserver;
    
    // Function to get ship image URL based on ship ID, orientation and length
    function getShipImageUrl(shipId: string | null, orientation?: 'horizontal' | 'vertical') {
        if (!shipId) return null;
        
        const ship = ships.find(s => s.id === shipId);
        if (!ship) return null;
        
        const shipOrientation = orientation || ship.orientation || 'horizontal';
        const orientationSuffix = shipOrientation === 'horizontal' ? 'h' : 'v';
        
        return `/images/battleship/ship-${ship.length}-tile-${orientationSuffix}.png`;
    }
    
    // Update cellSize when the board is visible and resized
    function updateCellSize() {
        if (boardElement) {
            const boardWidth = boardElement.clientWidth;
            cellSize = (boardWidth - (9 * cellGap)) / 10; // 10 cells with 9 gaps
        }
    }
    
    $: if (showBoard && boardElement) {
        // Use ResizeObserver to monitor size changes
        resizeObserver = new ResizeObserver(() => {
            updateCellSize();
        });
        resizeObserver.observe(boardElement);
        updateCellSize(); // Initial calculation
    }

    // Clean up the ResizeObserver when component is destroyed
    onDestroy(() => {
        if (resizeObserver) {
            resizeObserver.disconnect();
        }
    });
    
    // React to gameState changes
    $: {
        if (gameState?.playerBoards[username]) {
            ships = gameState.playerBoards[username].ships;
            board = gameState.playerBoards[username].board;
            shipGrid = gameState.playerBoards[username].shipGrid;
            inPlayMode = gameState.status === 'active';
            // Reset shot in progress when game state updates
            shotInProgress = false;

            winStreak = gameState.winStreaks?.[username] || 0;

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
            const boardRect = boardElement.getBoundingClientRect();
            const totalCellSize = cellSize + cellGap;
            
            // Get the position of the click in the grid
            const clickGridX = Math.floor((initialX - boardRect.left) / totalCellSize);
            const clickGridY = Math.floor((initialY - boardRect.top) / totalCellSize);
            
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
        } else {
            // If dragging from the ship selection area
            dragOffset = { 
                x: Math.min(Math.max(0, Math.floor((initialX - rect.left) / cellSize)), ship.length - 1),
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
        
        if (!boardElement) return;
        
        const boardRect = boardElement.getBoundingClientRect();
        const totalCellSize = cellSize + cellGap;
        
        // Check if mouse is extremely far from the board (more than 3 cells away)
        const farDistance = totalCellSize * 3;
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
        const gridX = Math.floor((mousePosition.x - boardRect.left) / totalCellSize);
        const gridY = Math.floor((mousePosition.y - boardRect.top) / totalCellSize);
        
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
        
        if (!boardElement) {
            isDragging = false;
            previewCells = [];
            return;
        }
        
        const boardRect = boardElement.getBoundingClientRect();
        const totalCellSize = cellSize + cellGap;
        
        // Calculate grid position on the board
        const gridX = Math.floor((mousePosition.x - boardRect.left) / totalCellSize);
        const gridY = Math.floor((mousePosition.y - boardRect.top) / totalCellSize);
        
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

    function handleRetreatClick() {
        showRetreatConfirm = true;
    }

    function confirmRetreat() {
        showRetreatConfirm = false;
        dispatch('retreat');
    }

    function cancelRetreat() {
        showRetreatConfirm = false;
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

    function getShipName(shipType: string): string {
        const translations = battleshipConfig.shipTypeTranslations;
        if (shipType in translations) {
            const typedShipType = shipType as ShipType;
            const typedLanguage = $activeLanguage as Language;
            // Try current language first, fall back to English if not found
            return translations[typedShipType][typedLanguage] || translations[typedShipType]['en'];
        }
        return shipType.charAt(0).toUpperCase() + shipType.slice(1);
    }

    // Add a flag to track if we've calculated the ship selection width
    let shipSelectionWidth = 0;
    
    // Function to save the ship selection width when it's rendered
    function saveShipSelectionWidth(node: HTMLElement) {
        // Only calculate once when ships are visible
        if (!allShipsPlaced && shipSelectionWidth === 0) {
            setTimeout(() => {
                shipSelectionWidth = node.offsetWidth;
            }, 100);
        }
        
        return {
            destroy() {}
        };
    }
</script>

{#if showRetreatConfirm}
    <div class="dialog-overlay">
        <div class="dialog-content">
            <h2>{getLocalizedText(pageTexts, "confirm_retreat")}</h2>
            <p>{getLocalizedText(pageTexts, "retreat_confirmation")}</p>
            <div class="dialog-actions">
                <button class="cancel-button" on:click={cancelRetreat}>
                    {getLocalizedText(pageTexts, "cancel")}
                </button>
                <button class="confirm-button" on:click={confirmRetreat}>
                    {getLocalizedText(pageTexts, "retreat")}
                </button>
            </div>
        </div>
    </div>
{/if}

{#if showBoard}
<div class="game-board {debugMode ? 'debug-mode' : ''} {!showBoard ? 'hidden' : ''}" 
    style="
        --title-color: {isOpponent ? '#e94560' : '#3498db'};
    ">
    <div class="game-info">
        <h2>
            {getLocalizedText(pageTexts, "fleet").replace("{0}", username)}
        </h2>
        
        {#if !isReady && !isOpponent}
            <div class="ship-placement-controls">
                <button class="auto-place-button" on:click={handleAutoPlaceClick}>
                    {getLocalizedText(pageTexts, "auto_place_fleet")}
                </button>
                
                <button 
                    class="ready-button" 
                    on:click={handleReadyClick}
                    disabled={!allShipsPlaced}
                >
                    {getLocalizedText(pageTexts, "im_ready")}
                </button>
            </div>
            
            <div class="ship-selection" 
                 use:saveShipSelectionWidth
                 style={shipSelectionWidth ? `width: ${shipSelectionWidth}px;` : ''}>
                {#if allShipsPlaced}
                    <p class="fleet-deployed">{getLocalizedText(pageTexts, "fleet_deployed")}</p>
                {:else}
                    {#each ships as ship}
                        <button 
                            class="ship-button {ship.placed ? 'placed' : ''}"
                            style="
                                width: {ship.length * 40}px;
                                background-image: url('{getShipImageUrl(ship.id, 'horizontal')}');
                                background-size: contain;
                                background-position: center;
                                background-repeat: no-repeat;
                            "
                            on:mousedown={(e) => handleShipDragStart(e, ship)}
                            on:touchstart={(e) => handleShipDragStart(e, ship)}
                        >
                            <span class="ship-name">{getShipName(ship.type)}</span>
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
                    {getLocalizedText(pageTexts, "playing_it")} {getLocalizedText(pageTexts, gameState.config.cpuDifficulty === 'easy' ? 'difficulty_easy' : 'difficulty_hard')}
                </div>
            {/if}   
    
            {#if isCPU && isOpponent }
                <div class="opponent-info">
                    {#if gameState.config.cpuDifficulty === 'easy'}
                        {getLocalizedText(pageTexts, "cpu_opponent")}
                    {:else}
                        {getLocalizedText(pageTexts, "advanced_ai_bot")}
                    {/if}
                </div>
            {/if}   

            {#if  !isCPU && isOpponent}
                <div class="opponent-info">
                        {getLocalizedText(pageTexts, "human_opponent")}
                </div>
            {/if}               
    
            {#if (winStreak > 0) }
                <div class="winning-streak">
                    {getLocalizedText(pageTexts, "win_streak")}: {winStreak}
                </div>
            {/if}        
        </div>        

    </div>

    <div class="board-container">
        <div class="board" bind:this={boardElement}>
            {#if showTurnOverlay && inPlayMode }
                <div class="turn-overlay"></div>
            {/if}
            
            <!-- Ship images layer - placed above the cells but below markers -->
            <div class="ship-images-layer">
                {#each ships as ship}
                    {@const shouldShow = (!isOpponent && ship.placed) || (isOpponent && ship.sunk)}
                    {#if shouldShow && ship.position}
                        {@const posX = ship.position.x}
                        {@const posY = ship.position.y}
                        {@const isHorizontal = ship.orientation === 'horizontal'}
                        {@const imgSrc = getShipImageUrl(ship.id)}
                        
                        <div 
                            class="ship-overlay {ship.orientation || 'horizontal'}"
                            style="
                                top: calc(({posY} * (100% / 10)) + 2px);
                                left: calc(({posX} * (100% / 10)) + 2px);
                                width: calc({isHorizontal ? ship.length : 1} * (100% / 10) - 2px);
                                height: calc({!isHorizontal ? ship.length : 1} * (100% / 10) - 2px);
                                background-image: url('{imgSrc}');
                            "
                        ></div>
                    {/if}
                {/each}
            </div>
            
            {#each board as row, y}
                <div class="row">
                    {#each row as cell, x}
                        {@const shipId = shipGrid[y][x]}
                        {@const ship = shipId ? ships.find(s => s.id === shipId) : null}
                        
                        <div 
                            class="cell {!isOpponent ? 'player' : 'opponent'} {cell === 'empty' && debugMode && isOpponent && shipGrid?.[y]?.[x] ? 'ship' : cell} {inPlayMode && isOpponent && !shotInProgress && cell !== 'hit' && cell !== 'miss' ? 'clickable' : ''} {previewCells.some(p => p.x === x && p.y === y) ? `preview ${previewState}` : ''} {cell === 'ship' && isReady ? 'locked' : ''}"
                            on:mousedown={(e) => handleBoardCellMouseDown(e, x, y)}
                            on:touchstart={(e) => handleBoardCellMouseDown(e, x, y)}
                            on:click={() => handleCellClick(x, y)}
                            data-ship-id={shipId}
                            data-position-x={x}
                            data-position-y={y}
                        >
                            <!-- Ocean background layer -->
                            <div class="ocean-layer"></div>
                            
                            {#if shipGrid[y][x] && (!isOpponent || debugMode)}
                                <span class="ship-label">
                                    {shipGrid[y][x]}
                                </span>
                            {/if}
                            
                            {#if cell === 'hit'}
                                <div class="hit-marker {ship?.sunk ? 'sunk' : ''}"></div>
                            {:else if cell === 'miss'}
                                <div class="miss-marker"></div>
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
                        {@const totalCellSize = cellSize + cellGap}
                        {@const isEvenLength = ship.length % 2 === 0}
                        {@const offset = isEvenLength ? 0.5 : 0}
                        
                        <!-- Position is different for even vs odd length ships -->
                        {@const centerX = ship.orientation === 'horizontal' 
                            ? (ship.position.x + (ship.length - 1) / 2) * totalCellSize + (cellSize / 2)
                            : ship.position.x * totalCellSize + (cellSize / 2)}
                            
                        {@const centerY = ship.orientation === 'vertical'
                            ? (ship.position.y + (ship.length - 1) / 2) * totalCellSize + (cellSize / 2)
                            : ship.position.y * totalCellSize + (cellSize / 2)}
                        
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
        <h3>{getLocalizedText(pageTexts, "fleet_status")}</h3>
        <div class="ship-items-container">
            {#each [...ships].sort((a, b) => b.length - a.length) as ship, i}
                <span class="ship-item">
                    <span class="ship-name {ship.sunk ? 'sunk' : ''}">
                        {getShipName(ship.type)} {#if !isOpponent} <span class="shiplist-shipid">({ship.id})</span>{/if} 
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
        {#if !isOpponent}
        <div class="retreat-button">
            <button on:click={handleRetreatClick}>{getLocalizedText(pageTexts, "retreat")}</button>
        </div>
        {/if}
    </div>
    {/if}
    
    {#if isDragging && selectedShip}
        <!-- Ghost ship -->
        <div class="drag-ghost {previewState || ''}" 
            style="
                left: {currentOrientation === 'horizontal' 
                    ? mousePosition.x - dragOffset.x * cellSize 
                    : mousePosition.x - cellSize/2}px; 
                top: {currentOrientation === 'vertical' 
                    ? mousePosition.y - dragOffset.y * cellSize 
                    : mousePosition.y - cellSize/2}px; 
                width: {currentOrientation === 'horizontal' ? selectedShip.length * cellSize : cellSize}px;
                height: {currentOrientation === 'vertical' ? selectedShip.length * cellSize : cellSize}px;
            ">
            <div 
                class="ghost-ship-image"
                style="
                    background-image: url('${getShipImageUrl(selectedShip.id, currentOrientation)}');
                    width: 100%;
                    height: 100%;
                    background-size: contain;
                    background-position: center;
                    background-repeat: no-repeat;
                "
            ></div>
            
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
{/if}

<style>
    .game-board {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
        position: relative;
        padding: 0.5rem;
        box-sizing: border-box;
    }

    h2 {
        margin: 0;
        color: var(--title-color);
        font-weight: bold;
        font-size: clamp(1.5rem, 5vw, 2rem);
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
        margin: 0 auto;
    }

    .ship-placement-controls {
        display: flex;
        gap: 1rem;
        width: 100%;
        justify-content: center;
    }

    .ship-selection, .board, .ship-list {
        width: 100%;
        max-width: 420px;
    }

    .ship-selection {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        justify-content: center;
        border-radius: 8px;
        padding: 1rem;
        background-color: #ecf0f1;
        box-sizing: border-box;
        margin-bottom: 1rem;
        max-width: 420px;
        width: 100%;
    }

    @media (max-width: 450px) {
        .ship-selection {
            min-width: unset;
        }
    }

    .fleet-deployed {
        color: #0d1b2a;
        font-weight: bold;
        font-size: 1.1rem;
        margin: 0;
        text-align: center;
        width: 100%;
    }

    .board-container {
        display: flex;
        justify-content: center;
        position: relative;
        width: 100%;
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
        width: 100%;
        max-width: 420px;
        aspect-ratio: 1;
        --cursor-offset: 20;
    }

    @media (max-width: 600px) {
        .board {
            --cursor-offset: 16;
        }
    }

    @media (max-width: 400px) {
        .board {
            --cursor-offset: 12;
        }
    }

    .ship-list {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.5rem;
        width: 100%;
        max-width: 420px;
        margin: 0 auto;
        text-align: left;
        border-radius: 8px;
    }

    .ship-button {
        padding: 0.25rem 2px;
        border: none;
        border-radius: 5px;
        color: white;
        cursor: pointer;
        transition: all 0.2s;
        height: clamp(30px, 8vw, 40px);
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: clamp(0.7rem, 2vw, 0.9rem);
        position: relative;
        box-shadow: 0 0 5px 0 rgba(0, 0, 0, 0.5);
        background-color: transparent;
    }

    .ship-button:hover:not(.placed) {
        filter: brightness(110%);
        transform: translateY(-2px);
    }

    .ship-button.placed {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
        filter: grayscale(70%);
    }

    /* Remove the general hover effect for placed ships */
    .ship-button.placed:hover {
        background-color: transparent;
        color: white;
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
        background-color: #314875;
        color: white;
    }

    .auto-place-button:hover {
        filter: brightness(90%);
        transform: translateY(-2px);
    }

    .ready-button {
        background-color: #0b5d0b;
        color: white;
    }

    .ready-button:hover:not(:disabled) {
        filter: brightness(90%);
        transform: translateY(-2px);
    }

    .ready-button:disabled {
        background-color: #77797a;
        cursor: not-allowed;
    }

    .turn-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.6);
        z-index: 100;
        pointer-events: none;
        border-radius: 5px;
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
        width: 100%;
        aspect-ratio: 1;
        border-radius: 2px;
        transition: all 0.2s;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
    }

    /* Ocean background layer */
    .ocean-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-image: url('/images/battleship/tile-ocean.png');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        z-index: 1;
    }

    /* Ship images layer positioned above the board */
    .ship-images-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 3;
        pointer-events: none;
    }
    
    /* Ship overlay styling */
    .ship-overlay {
        position: absolute;
        background-size: 100% 100%;
        background-repeat: no-repeat;
        background-position: center;
        z-index: 3;
        pointer-events: none;
    }

    /* Remove redundant ship image styles */
    .ship-image,
    .ship-image.horizontal,
    .ship-image.vertical,
    .cell.with-ship-image,
    .cell.with-ship-image.first-tile.horizontal,
    .cell.with-ship-image.first-tile.vertical,
    .cell.ship-part {
        /* Removed styles as we're using overlay approach now */
    }

    /* Remove the pseudo-elements as we're using explicit ocean layer */
    .cell.ship {
        background-image: none;
    }
    
    .cell.ship.locked {
        cursor: default;
    }

    .cell.preview.valid {
        background-color: rgba(46, 204, 113, 0.5) !important;
        background-blend-mode: overlay;
    }

    .cell.preview.invalid {
        background-color: rgba(231, 77, 60, 0.85) !important;
        background-blend-mode: overlay;
    }
    
    .ship-label {
        position: absolute;
        top: 1px;
        left: 2px;
        font-size: clamp(0.5rem, 1.5vw, 0.6rem);
        color: white;
        pointer-events: none;
        z-index: 5;
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
        pointer-events: none;
        background-size: 80%;
        background-position: center;
        background-repeat: no-repeat;
        font-size: 0;
        z-index: 4;
    }
    
    .hit-marker {
        background-image: url('/images/battleship/tile-hit.png');
    }

    .hit-marker.sunk {
        /* Removed special background */
    }

    .miss-marker {
        background-image: url('/images/battleship/tile-miss2.png');
    }

    .drag-ghost {
        position: fixed;
        border: 2px dashed #3498db;
        color: transparent; /* Hide any text */
        border-radius: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 1000;
        font-weight: bold;
        background-color: rgba(52, 152, 219, 0.2); /* Light blue background */
        overflow: visible;
    }

    .drag-ghost.valid {
        border: 2px dashed #2ecc71; /* Green */
        background-color: rgba(46, 204, 113, 0.2); /* Light green background */
        filter: drop-shadow(0 0 5px rgba(46, 204, 113, 0.5));
    }

    .drag-ghost.invalid {
        border: 2px dashed #e74c3c; /* Red */
        background-color: rgba(231, 77, 60, 0.2); /* Light red background */
        filter: drop-shadow(0 0 5px rgba(231, 77, 60, 0.5));
    }

    .ghost-ship-image {
        position: relative;
        z-index: 1001;
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
    
    /* Base clickable states */
    .board .cell.opponent.clickable:not(.hit):not(.miss):hover {
        cursor: url('/images/battleship/tile-crosshair.ico') 32 32, crosshair;
        background-image: url('/images/battleship/tile-ocean.png');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
    }
    
    /* Disable hover effects when turn overlay is active */
    .board .turn-overlay ~ .row .cell.opponent.clickable:not(.hit):not(.miss):hover {
        cursor: not-allowed;
        background-image: url('/images/battleship/tile-ocean.png');
    }
    
    .cell.opponent.clickable.hit:hover,
    .cell.opponent.clickable.miss:hover,
    .cell.opponent.hit:hover,
    .cell.opponent.miss:hover {
        cursor: not-allowed;
    }
    
    .ship-name {
        font-size: 0.8rem;
        display: block;
        width: 100%;
        text-align: center;
        margin-top: 5px;
        margin-left: -1px;
        text-shadow: 
            1px 1px 1px rgba(0,0,0,0.8),
            -1px -1px 1px rgba(0,0,0,0.8),
            1px -1px 1px rgba(0,0,0,0.8),
            -1px 1px 1px rgba(0,0,0,0.8);
    }

    .ship-id {
        position: absolute;
        top: 1px;
        left: 2px;
        font-size: 0.7rem;
        opacity: 0.7;
        text-shadow: 
            2px 2px 2px rgba(0,0,0,0.8),
            -2px -2px 2px rgba(0,0,0,0.8),
            2px -2px 2px rgba(0,0,0,0.8),
            -2px 2px 2px rgba(0,0,0,0.8);
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

    .ship-items-container {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
        line-height: 1.2;
        font-size: clamp(0.8rem, 2.5vw, 0.9rem);
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
        font-size: clamp(0.7rem, 2vw, 0.9rem);
        text-align: left;
        color: #ecf0f1;
    }

    .ship-list .shiplist-shipid {
        display: inline;
        font-size: clamp(0.6rem, 1.8vw, 0.7rem);
        font-style: italic;
        text-align: left;
        color: #ecf0f1;
        margin-left: -0.5rem;
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

    div.retreat-button {
        width: 100%;
        margin-top: 1rem;
        text-align: center;
    }

    div.retreat-button button {
        background-color: #e13e59;
        color: #e0e1dd;
        padding: 8px 14px;
        font-size: 1rem;
        font-weight: bold;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 0 6px 10px rgba(0, 0, 0, 0.2);
        transition: all 0.3s ease;
        user-select: none;  /* Prevent text selection */
        -webkit-user-select: none;
        -ms-user-select: none;
        -moz-user-select: none;
    }

    div.retreat-button button:hover {
        filter: brightness(90%);
        transform: translateY(-2px);
    }

    .dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .dialog-content {
        background-color: #1b263b;
        padding: clamp(1rem, 3vw, 2rem);
        border-radius: 10px;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
        max-width: 400px;
        width: 90%;
        text-align: center;
    }

    .dialog-content h2 {
        color: #e0e1dd;
        margin: 0 0 1rem 0;
        font-size: clamp(1.2rem, 4vw, 1.5rem);
    }

    .dialog-content p {
        color: #e0e1dd;
        margin: 0 0 1.5rem 0;
        font-size: clamp(0.9rem, 2.8vw, 1.1rem);
    }

    .dialog-actions {
        display: flex;
        justify-content: center;
        gap: 1rem;
    }

    .dialog-actions button {
        padding: clamp(0.5rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem);
        border: none;
        border-radius: 5px;
        font-size: clamp(0.9rem, 2.5vw, 1rem);
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .cancel-button {
        background-color: #415a77;
        color: #e0e1dd;
    }

    .cancel-button:hover {
        background-color: #526d8e;
        transform: translateY(-2px);
    }

    .confirm-button {
        background-color: #e13e59;
        color: #e0e1dd;
    }

    .confirm-button:hover {
        filter: brightness(90%);
        transform: translateY(-2px);
    }

    .rotate-button {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: clamp(20px, 5vw, 24px);
        height: clamp(20px, 5vw, 24px);
        background-color: #3498db;
        color: white;
        border: none;
        border-radius: 50%;
        font-size: clamp(14px, 4vw, 16px);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
        opacity: 0.8;
        transition: opacity 0.2s;
        pointer-events: all;
    }

    .rotate-button:hover {
        opacity: 1;
        background-color: #2980b9;
    }

</style> 