<script lang="ts">
    import { onMount } from 'svelte';
    import UsernameInput from './UsernameInput.svelte';
    import GameModeSelector from './GameModeSelector.svelte';
    import GameBoard from './GameBoard.svelte';

    let username = '';
    let gameMode: 'cpu' | 'token' | 'discovery' | null = null;
    let gameToken = '';
    let isUsernameValid = false;
    let gameStarted = false;

    function handleUsernameChange(event: CustomEvent<string>) {
        username = event.detail;
        isUsernameValid = username.length === 3;
    }

    function handleGameModeSelect(event: CustomEvent<'cpu' | 'token' | 'discovery'>) {
        gameMode = event.detail;
        if (gameMode === 'cpu') {
            gameStarted = true;
        }
    }

    function handleTokenInput(event: CustomEvent<string>) {
        gameToken = event.detail;
    }

    async function startGame() {
        if (!isUsernameValid || !gameMode) return;

        // TODO: Implement game start logic for token and discovery modes
        console.log('Starting game with:', { username, gameMode, gameToken });
    }

    function handleReady(event: CustomEvent) {
        // TODO: Implement ready state handling
        console.log('Player ready:', event.detail);
    }
</script>

{#if !gameStarted}
    <div class="game-setup">
        <UsernameInput on:usernameChange={handleUsernameChange} />
        
        {#if isUsernameValid}
            <GameModeSelector 
                on:gameModeSelect={handleGameModeSelect}
                on:tokenInput={handleTokenInput}
            />
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
{:else}
    <GameBoard 
        username={username}
        isCPU={gameMode === 'cpu'}
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
</style> 