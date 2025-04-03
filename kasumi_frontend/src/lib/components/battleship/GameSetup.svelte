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
    let cpuDifficulty: 'easy' | 'hard' = 'easy';
    let multiplayerMode: 'host' | 'join' | 'discover' | null = null;

    function handleUsernameChange(initials: string) {
        username = initials.toUpperCase();
        isUsernameValid = username.length === 3;
        initialsSubmitted = true;
    }

    function editUsername() {
        initialsSubmitted = false;
    }

    function handleCpuDifficultySelect(difficulty: 'easy' | 'hard') {
        cpuDifficulty = difficulty;
        defaultConfig.cpuDifficulty = difficulty;
    }

    function handleMultiplayerModeSelect(mode: 'host' | 'join' | 'discover') {
        multiplayerMode = mode;
        // For now, these are inactive
    }

    function handleStartCpuGame() {
        gameMode = 'cpu';
        startGame();
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
                    gameId
                });
            } else {
                errorMessage = 'Failed to start game. Please try again.';
            }
        } catch (error) {
            console.error('Failed to start game:', error);
            errorMessage = 'Failed to start game. Please try again.';
        }
    }

</script>

<div class="game-setup">
    <h2>Getting ready to play</h2>
    
    {#if !initialsSubmitted}
        <VirtualKeyboard onSubmit={handleUsernameChange} />
    {:else}
        <div class="initials-display">
            <p>Your initials: <span>{username}</span> <button class="pencil-button" on:click={editUsername}>✏️</button></p>
        </div>
    {/if}
    
    {#if isUsernameValid && initialsSubmitted}
        <div class="game-mode-sections">
            <div class="mode-section">
                <h3>Play against CPU</h3>
                <div class="difficulty-selector">
                    <button 
                        class="mode-button {cpuDifficulty === 'easy' ? 'selected' : ''}"
                        on:click={() => handleCpuDifficultySelect('easy')}
                    >
                        Easy
                    </button>
                    <button 
                        class="mode-button {cpuDifficulty === 'hard' ? 'selected' : ''}"
                        on:click={() => handleCpuDifficultySelect('hard')}
                    >
                        Hard
                    </button>
                </div>
                <button class="start-button" on:click={handleStartCpuGame}>
                    Start CPU Game
                </button>
            </div>
            
            <div class="mode-section">
                <h3>Multiplayer (Coming Soon)</h3>
                <div class="multiplayer-options">
                    <button 
                        class="mode-button disabled"
                        disabled
                    >
                        Host Game
                    </button>
                    <button 
                        class="mode-button disabled"
                        disabled
                    >
                        Join Game
                    </button>
                    <button 
                        class="mode-button disabled"
                        disabled
                    >
                        Find Local Players
                    </button>
                </div>
            </div>
        </div>
    {/if}

    {#if errorMessage}
        <p class="error-message">{errorMessage}</p>
    {/if}
</div>

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

    h3 {
        color: #3498db;
        margin: 0 0 1rem 0;
        font-size: 1.2rem;
        text-align: center;
    }

    .initials-display {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .initials-display p {
        font-size: 1.5rem;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .initials-display span {
        text-transform: uppercase;
        font-weight: bold;
        color: #3498db;
    }

    .pencil-button {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0;
        margin-left: 5px;
    }

    .pencil-button:hover {
        transform: scale(1.2);
    }

    .game-mode-sections {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        width: 100%;
    }

    .mode-section {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
        border-radius: 5px;
        background-color: #f7f9fc;
        border: 1px solid #e1e8ed;
    }

    .difficulty-selector, .multiplayer-options {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .mode-button {
        padding: 0.8rem 1rem;
        font-size: 1rem;
        border: 2px solid #3498db;
        border-radius: 5px;
        background-color: white;
        color: #3498db;
        cursor: pointer;
        transition: all 0.2s;
    }

    .mode-button:hover:not(.disabled) {
        background-color: #f7f9fc;
    }

    .mode-button.selected {
        background-color: #3498db;
        color: white;
    }

    .mode-button.disabled {
        border-color: #bdc3c7;
        color: #bdc3c7;
        cursor: not-allowed;
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
        margin-top: 0.5rem;
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