<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import VirtualKeyboard from '$lib/components/common/VirtualKeyboard.svelte';
    import GameModeSelector from './GameModeSelector.svelte';
    import GameBoard from './GameBoard.svelte';
    import { battleshipApi, type BattleshipConfig } from '$lib/services/battleshipServices';
    import { battleshipConfig } from '$lib/config/battleshipConfig.js';

    const dispatch = createEventDispatcher();


    let defaultConfig: BattleshipConfig = battleshipConfig;
    let username = '';
    let gameMode: 'cpu' | 'token' | 'discovery' | null = null;
    let gameToken = '';
    let isUsernameValid = false;
    let gameStarted = false;
    let gameId: string | null = null;
    let errorMessage = '';
    let initialsSubmitted = false;

    function handleUsernameChange(initials: string) {
        username = initials.toUpperCase();
        isUsernameValid = username.length === 3;
        initialsSubmitted = true;
    }

    function handleGameModeSelect(event: CustomEvent<'cpu' | 'token' | 'discovery'>) {
        gameMode = event.detail;
        if (gameMode === 'cpu') {
            startGame();
        }
    }

    function handleTokenInput(event: CustomEvent<string>) {
        gameToken = event.detail;
    }

    async function startGame() {
        if (!isUsernameValid || !gameMode) return;

        try {
            const response = await battleshipApi.createGame(username, 'cpu', defaultConfig);
            if (response.status === 'success') {
                gameId = response.gameId;
                gameStarted = true;
                dispatch('gameStart', {
                    username,
                    gameId,
                    isCPU: gameMode === 'cpu'
                });
            } else {
                errorMessage = 'Failed to start game. Please try again.';
            }
        } catch (error) {
            console.error('Failed to start game:', error);
            errorMessage = 'Failed to start game. Please try again.';
        }
    }

    function handleReady(event: CustomEvent) {
        // The ready event is now handled by the GameBoard component
        console.log('Player ready:', event.detail);
    }
</script>

{#if !gameStarted}
    <div class="game-setup">
        <h2>Getting ready to play</h2>
        
        {#if !initialsSubmitted}
            <VirtualKeyboard onSubmit={handleUsernameChange} />
        {:else}
            <div class="initials-display">
                <p>Your initials: <span>{username}</span></p>
                <button class="edit-button" on:click={() => initialsSubmitted = false}>Edit</button>
            </div>
        {/if}
        
        {#if isUsernameValid}
            <GameModeSelector 
                on:gameModeSelect={handleGameModeSelect}
                on:tokenInput={handleTokenInput}
            />
        {/if}

        {#if errorMessage}
            <p class="error-message">{errorMessage}</p>
        {/if}

        {#if isUsernameValid && gameMode && gameMode !== 'cpu'}
            <button 
                class="start-button"
                on:click={startGame}
                disabled={gameMode === 'token' && !gameToken}
            >
                Start Game
            </button>
        {/if}
    </div>
{:else if gameId}
    <GameBoard 
        username={username}
        gameId={gameId}
        on:ready={handleReady}
    />
{/if}

<style>
    .game-setup {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        width: 100%;
        max-width: 400px;
        margin: 0 auto;
        align-items: center;
    }

    h2 {
        color: #3498db;
        margin-bottom: 1rem;
        font-size: 1.5rem;
        text-align: center;
    }

    .initials-display {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
    }

    .initials-display p {
        font-size: 1.5rem;
        margin: 0;
    }

    .initials-display span {
        text-transform: uppercase;
        font-weight: bold;
        color: #3498db;
    }

    .edit-button {
        background-color: #3498db;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 5px;
        font-size: 1rem;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .edit-button:hover {
        background-color: #2980b9;
    }

    .start-button {
        background-color: #3498db;
        color: white;
        border: none;
        padding: 1rem 2rem;
        border-radius: 5px;
        font-size: 1.2rem;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .start-button:hover {
        background-color: #2980b9;
    }

    .start-button:disabled {
        background-color: #bdc3c7;
        cursor: not-allowed;
    }

    .error-message {
        color: #e74c3c;
        text-align: center;
        margin: 0;
    }
</style> 