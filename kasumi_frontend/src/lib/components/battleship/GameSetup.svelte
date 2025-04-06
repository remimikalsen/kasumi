<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import VirtualKeyboard from '$lib/components/common/VirtualKeyboard.svelte';
    import { battleshipApi, type BattleshipConfig } from '$lib/services/battleshipServices';
    import { battleshipConfig } from '$lib/config/battleshipConfig.js';
    import { getLocalizedText, loadTexts, activeLanguage } from '$lib/stores/translatedTexts.js';

    const pageTexts = 'battleship';
    let isLoadingTexts = true;

    async function fetchTexts() {
        isLoadingTexts = true;
        await loadTexts(pageTexts);
        isLoadingTexts = false;
    }

    $: $activeLanguage, fetchTexts();

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
    let cpuDifficulty: 'easy' | 'hard' = defaultConfig.cpuDifficulty || 'easy';
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
                errorMessage = getLocalizedText(pageTexts, "failed_start_game");
            }
        } catch (error) {
            console.error('Failed to start game:', error);
            errorMessage = getLocalizedText(pageTexts, "failed_start_game");
        }
    }

</script>

{#if !isLoadingTexts}
<div class="game-setup">
    <h2>{getLocalizedText(pageTexts, "setup_title")}</h2>
    
    {#if !initialsSubmitted}
        <VirtualKeyboard onSubmit={handleUsernameChange} initials_label={getLocalizedText(pageTexts, "initials_label")} submit_label={getLocalizedText(pageTexts, "submit_label")} />
    {:else}
        <div class="initials-display">
            <p>{getLocalizedText(pageTexts, "admiral")} <span>{username}</span> <button class="pencil-button" on:click={editUsername}>✏️</button></p>
        </div>
    {/if}
    
    {#if isUsernameValid && initialsSubmitted}
        <div class="game-mode-sections">
            <div class="glowing mode-section">
                <h3>{getLocalizedText(pageTexts, "play_against_cpu")}</h3>
                <div class="difficulty-selector">
                    <button 
                        class="mode-button {cpuDifficulty === 'easy' ? 'selected' : ''}"
                        on:click={() => handleCpuDifficultySelect('easy')}
                    >
                        <span class="emoji">🌱</span> {getLocalizedText(pageTexts, "difficulty_easy")} {cpuDifficulty === 'easy' ? '✓' : ''}
                    </button>
                    <button 
                        class="mode-button {cpuDifficulty === 'hard' ? 'selected' : ''}"
                        on:click={() => handleCpuDifficultySelect('hard')}
                    >
                        <span class="emoji">🔥</span> {getLocalizedText(pageTexts, "difficulty_hard")} {cpuDifficulty === 'hard' ? '✓' : ''}
                    </button>
                </div>
                <button class="start-button" on:click={handleStartCpuGame}>
                    <span class="emoji">🤖</span> {getLocalizedText(pageTexts, "start_cpu_game")}
                </button>
            </div>
            
            <div class="glowing mode-section">
                <h3>{getLocalizedText(pageTexts, "multiplayer_coming_soon")}</h3>
                <div class="multiplayer-options">
                    <button 
                        class="mode-button disabled"
                        disabled
                    >
                        <span class="emoji">👑</span> {getLocalizedText(pageTexts, "host_game")}
                    </button>
                    <button 
                        class="mode-button disabled"
                        disabled
                    >
                        <span class="emoji">🤝</span> {getLocalizedText(pageTexts, "join_game")}
                    </button>
                    <button 
                        class="mode-button disabled"
                        disabled
                    >
                        <span class="emoji">🔍</span> {getLocalizedText(pageTexts, "find_local_players")}
                    </button>
                </div>
            </div>
        </div>
    {/if}

    {#if errorMessage}
        <p class="error-message">{errorMessage}</p>
    {/if}
</div>
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
        width: 100%;
        padding-bottom: 2rem;
    }

    .mode-section:hover {
        background-color: transparent;
    }

    .difficulty-selector, .multiplayer-options {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .mode-button {
        padding: 0.8rem 1rem;
        font-size: 1rem;
        border-radius: 5px;
        border: 2px solid #314875;
        background-color: white;
        color: #314875;
        cursor: pointer;
        transition: all 0.2s;
        width: 75%;
        margin: 0 auto;
    }

    .mode-button:hover:not(.disabled):not(.selected) {
        background-color: #7da7fc;
        transform: translateY(-2px);
    }

    .mode-button.selected {
        background-color: #314875;
        color: white;
    }

    .mode-button.disabled {
        border-color: #bdc3c7;
        color: #bdc3c7;
        cursor: not-allowed;
    }

    .start-button {
        background-color: #314875;
        color: white;
        border: none;
        padding: 1rem 2rem;
        border-radius: 5px;
        font-size: 1.2rem;
        cursor: pointer;
        transition: background-color 0.2s;
        width: 75%;
        margin: 0 auto;
        margin-top: 0.5rem;
    }

    .start-button:hover {
        filter: brightness(90%);
        transform: translateY(-2px);
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
    
    .emoji {
        font-size: 1.5em;
        line-height: 1;
        vertical-align: middle;
    }
</style> 