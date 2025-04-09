<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import VirtualKeyboard from '$lib/components/common/VirtualKeyboard.svelte';
    import { battleshipApi, type BattleshipConfig } from '$lib/services/battleshipServices';
    import { battleshipConfig, type GameIdLetter } from '$lib/config/battleshipConfig';
    import { getLocalizedText, loadTexts, activeLanguage } from '$lib/stores/translatedTexts.js';
    import { soundManager } from '$lib/services/soundManager';

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
    let hostedGameId: string | null = null;
    let emojiSequence: string[] = [];
    let joiningGame = false;
    let selectedEmojis: string[] = [];
    let soundInitialized = false;
    
    const emojisArray = Object.values(battleshipConfig.gameIdEmojis);

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
        if (mode === 'host') {
            handleHostGame();
        } else if (mode === 'join') {
            joiningGame = true;
            selectedEmojis = [];
        } else {
            joiningGame = false;
        }
    }

    function selectEmoji(emoji: string) {
        if (selectedEmojis.length < 6) {
            selectedEmojis = [...selectedEmojis, emoji];
        }
        
        // If we have 6 emojis, try to join the game
        if (selectedEmojis.length === 6) {
            handleJoinGame();
        }
    }
    
    function removeLastEmoji() {
        if (selectedEmojis.length > 0) {
            selectedEmojis = selectedEmojis.slice(0, -1);
        }
    }
    
    function clearEmojiSelection() {
        selectedEmojis = [];
    }
    
    function emojiToLetter(emoji: string): GameIdLetter | null {
        for (const [letter, mappedEmoji] of Object.entries(battleshipConfig.gameIdEmojis)) {
            if (mappedEmoji === emoji) {
                return letter as GameIdLetter;
            }
        }
        return null;
    }

    async function handleJoinGame() {
        if (!isUsernameValid || selectedEmojis.length !== 6) return;
        
        // Convert emoji sequence to game ID
        const gameIdLetters = selectedEmojis.map(emoji => emojiToLetter(emoji));
        
        // Make sure all emojis were valid
        if (gameIdLetters.includes(null)) {
            errorMessage = getLocalizedText(pageTexts, "invalid_emoji_sequence");
            return;
        }
        
        const joinGameId = gameIdLetters.join('');
        
        try {
            const response = await battleshipApi.joinGame(joinGameId, username);
            if (response.status === 'success') {
                gameId = joinGameId;
                gameMode = 'token';
                gameStarted = true;
                
                // Dispatch event to start the game
                dispatch('gameStart', {
                    username,
                    gameId: joinGameId
                });
            } else {
                errorMessage = getLocalizedText(pageTexts, "failed_join_game");
            }
        } catch (error) {
            console.error('Failed to join game:', error);
            errorMessage = getLocalizedText(pageTexts, "failed_join_game");
        }
    }

    async function handleHostGame() {
        if (!isUsernameValid) return;

        try {
            const response = await battleshipApi.createGame(username, 'multiplayer', defaultConfig);
            if (response.status === 'success') {
                hostedGameId = response.gameId;
                // Start the game immediately instead of just showing emoji sequence
                gameId = response.gameId;
                gameMode = 'token';
                gameStarted = true;
                
                // Dispatch event to start the game
                dispatch('gameStart', {
                    username,
                    gameId: response.gameId
                });
            } else {
                errorMessage = getLocalizedText(pageTexts, "failed_start_game");
            }
        } catch (error) {
            console.error('Failed to host game:', error);
            errorMessage = getLocalizedText(pageTexts, "failed_start_game");
        }
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

    onMount(async () => {
        // Initialize the sound manager without starting music
        if (!soundInitialized) {
            await soundManager.initialize();
            soundInitialized = true;
            // Don't start music here - will start in game phase
        }
    });

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
                <h3>{getLocalizedText(pageTexts, "multiplayer")}</h3>
                <div class="multiplayer-options">
                    <button 
                        class="mode-button {multiplayerMode === 'host' ? 'selected' : ''}"
                        on:click={() => handleMultiplayerModeSelect('host')}
                    >
                        <span class="emoji">👑</span> {getLocalizedText(pageTexts, "host_game")}
                    </button>
                    <button 
                        class="mode-button {multiplayerMode === 'join' ? 'selected' : ''}"
                        on:click={() => handleMultiplayerModeSelect('join')}
                    >
                        <span class="emoji">🤝</span> {getLocalizedText(pageTexts, "join_game")}
                    </button>
                    <button 
                        class="mode-button disabled"
                        disabled
                    >
                        <span class="emoji">🔍</span> {getLocalizedText(pageTexts, "find_local_players")} 
                        <span class="coming-soon">{getLocalizedText(pageTexts, "coming_soon") || "Coming soon"}</span>
                    </button>
                </div>
            </div>

            {#if hostedGameId}
                <div class="glowing mode-section">
                    <h3>{getLocalizedText(pageTexts, "game_hosted")}</h3>
                    <div class="emoji-sequence" aria-label="Game pin emoji sequence">
                        {#each emojiSequence as emoji}
                            <span class="emoji">{emoji}</span>
                        {/each}
                    </div>
                    <p class="game-id">{hostedGameId}</p>
                    <p class="instruction">{getLocalizedText(pageTexts, "share_emoji_sequence")}</p>
                </div>
            {/if}
        </div>
    {/if}

    {#if errorMessage}
        <p class="error-message">{errorMessage}</p>
    {/if}
</div>

{#if joiningGame}
    <div class="join-modal">
        <div class="modal-content join-modal-content">
            <h2>{getLocalizedText(pageTexts, "join_game")}</h2>
            <p>{getLocalizedText(pageTexts, "enter_emoji_sequence")}</p>
            
            <div class="selected-emojis">
                {#each selectedEmojis as emoji}
                    <span class="emoji selected">{emoji}</span>
                {/each}
                {#each Array(6 - selectedEmojis.length) as _}
                    <span class="emoji-placeholder"></span>
                {/each}
            </div>
            
            <div class="emoji-keyboard">
                {#each emojisArray as emoji}
                    <button class="emoji-button" on:click={() => selectEmoji(emoji)}>
                        <span class="emoji">{emoji}</span>
                    </button>
                {/each}
            </div>
            
            <div class="emoji-controls">
                <button class="control-button" on:click={removeLastEmoji}>
                    <span class="emoji">⬅️</span> {getLocalizedText(pageTexts, "backspace")}
                </button>
                <button class="control-button" on:click={clearEmojiSelection}>
                    <span class="emoji">🔄</span> {getLocalizedText(pageTexts, "clear")}
                </button>
            </div>
            
            {#if selectedEmojis.length === 6}
                <button class="join-button" on:click={handleJoinGame}>
                    <span class="emoji">🔗</span> {getLocalizedText(pageTexts, "join_now")}
                </button>
            {/if}
            
            <button class="cancel-button" on:click={() => { joiningGame = false; multiplayerMode = null; }}>
                <span class="emoji">❌</span> {getLocalizedText(pageTexts, "cancel")}
            </button>
        </div>
    </div>
{/if}
{/if}

<style>
    .game-setup {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        width: 100%;
        max-width: 400px;
        margin: 0 auto;
        align-items: center;
        margin-bottom: 2rem;
        padding: 0 1rem;
        box-sizing: border-box;
    }

    h2 {
        color: #3498db;
        margin-bottom: 0.75rem;
        font-size: clamp(1.25rem, 5vw, 1.5rem);
        text-align: center;
    }

    .game-setup h2 {
        margin-bottom: 0;
        font-size: 2rem;
        text-align: center;
    }

    h3 {
        color: #3498db;
        margin: 0 0 0.75rem 0;
        font-size: clamp(1rem, 4vw, 1.2rem);
        text-align: center;
    }

    .initials-display {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
        justify-content: center;
    }

    .initials-display p {
        font-size: clamp(1.2rem, 4vw, 1.5rem);
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
        font-size: clamp(1rem, 4vw, 1.2rem);
        padding: 0;
        margin-left: 5px;
    }

    .pencil-button:hover {
        transform: scale(1.2);
    }

    .game-mode-sections {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        width: 100%;
    }

    .mode-section {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 0.75rem 10px;
        width: 100%;
        padding-bottom: 1.5rem;
        box-sizing: border-box;
        max-width: 100%;
        overflow-x: hidden;
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
        padding: 0.75rem 0.75rem;
        font-size: clamp(0.85rem, 3vw, 1rem);
        border-radius: 5px;
        border: 2px solid #314875;
        background-color: white;
        color: #314875;
        cursor: pointer;
        transition: all 0.2s;
        width: 100%;
        max-width: 280px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
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
        color: #7f8c8d;
        cursor: not-allowed;
        opacity: 0.8;
    }

    .coming-soon {
        font-size: 0.7rem;
        color: #e67e22;
        margin-left: 5px;
        font-style: italic;
    }

    .start-button {
        background-color: #314875;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 5px;
        font-size: clamp(1rem, 3.5vw, 1.2rem);
        cursor: pointer;
        transition: background-color 0.2s;
        width: 100%;
        max-width: 280px;
        margin: 0 auto;
        margin-top: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
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
        font-size: clamp(0.85rem, 3vw, 1rem);
    }
    
    .emoji {
        font-size: clamp(1.2rem, 4vw, 1.5rem);
        line-height: 1;
        vertical-align: middle;
    }

    .emoji-sequence {
        display: flex;
        justify-content: center;
        gap: 0.4rem;
        margin: 0.75rem 0;
        font-size: clamp(1.2rem, 4vw, 1.5rem);
        flex-wrap: wrap;
        padding: 0 10px;
    }

    .game-id {
        text-align: center;
        font-family: monospace;
        font-size: clamp(1rem, 3.5vw, 1.2rem);
        color: #3498db;
        margin: 0.5rem 0;
        word-break: break-all;
    }

    .instruction {
        text-align: center;
        color: #7f8c8d;
        font-size: clamp(0.8rem, 3vw, 0.9rem);
        margin: 0.5rem 0;
    }
    
    .selected-emojis {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        margin: 0.75rem 0;
        flex-wrap: wrap;
    }
    
    .emoji.selected {
        font-size: clamp(1.5rem, 5vw, 2rem);
        animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }
    
    .emoji-placeholder {
        width: clamp(1.5rem, 5vw, 2rem);
        height: clamp(1.5rem, 5vw, 2rem);
        border: 2px dashed #7f8c8d;
        border-radius: 50%;
    }
    
    .emoji-keyboard {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.5rem;
        margin: 0.75rem 0;
        width: 100%;
    }
    
    .emoji-button {
        background-color: #314875;
        color: white;
        border: none;
        border-radius: 5px;
        padding: 0.5rem;
        font-size: clamp(1.2rem, 4vw, 1.5rem);
        cursor: pointer;
        transition: all 0.2s;
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .emoji-button:hover {
        transform: translateY(-2px);
        background-color: #486794;
    }
    
    .emoji-controls {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        margin: 0.75rem 0;
        flex-wrap: wrap;
    }
    
    .control-button, .back-button, .join-button, .cancel-button {
        padding: 0.5rem 0.75rem;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        font-size: clamp(0.85rem, 3vw, 1rem);
    }
    
    .control-button {
        background-color: #3498db;
        color: white;
        min-width: 100px;
    }
    
    .back-button {
        background-color: #7f8c8d;
        color: white;
        margin-top: 1rem;
    }
    
    .join-button {
        background-color: #27ae60;
        color: white;
        font-size: clamp(0.9rem, 3.5vw, 1.1rem);
        padding: 0.75rem 1rem;
        margin: 0.75rem auto;
        width: 100%;
        max-width: 200px;
    }
    
    .cancel-button {
        background-color: #e74c3c;
        color: white;
        margin: 0.75rem auto 0;
    }
    
    .control-button:hover, .back-button:hover, .join-button:hover, .cancel-button:hover {
        transform: translateY(-2px);
        filter: brightness(90%);
    }

    .join-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: rgba(0, 0, 0, 0.8);
        z-index: 1000;
        padding: 1rem;
        box-sizing: border-box;
    }

    .modal-content {
        background-color: #1b263b;
        padding: clamp(1rem, 5vw, 2rem);
        border-radius: 10px;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
        max-width: 400px;
        width: 100%;
        text-align: center;
    }
    
    .join-modal-content {
        min-height: 60vh;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }

    .modal-content h2 {
        color: #e0e1dd;
        margin: 0 0 0.75rem 0;
        font-size: clamp(1.2rem, 4vw, 1.5rem);
    }

    .modal-content p {
        color: #e0e1dd;
        margin-bottom: 0.75rem;
        font-size: clamp(0.85rem, 3vw, 1rem);
    }
    
    @media (max-width: 400px) {
        .emoji-sequence {
            gap: 0.3rem;
            font-size: clamp(1rem, 3.5vw, 1.2rem);
        }
        
        .mode-section h3 {
            font-size: 1rem;
        }
        
        .game-id {
            font-size: 0.9rem;
        }
        
        .instruction {
            font-size: 0.8rem;
        }
    }
    
    @media (max-width: 350px) {
        .emoji-controls {
            flex-direction: column;
            align-items: center;
        }
        
        .control-button {
            width: 100%;
        }
        
        .game-setup {
            gap: 1rem;
        }
        
        .game-mode-sections {
            gap: 1rem;
        }
        
        .mode-section {
            gap: 0.5rem;
            padding: 0.5rem;
        }
    }
</style> 