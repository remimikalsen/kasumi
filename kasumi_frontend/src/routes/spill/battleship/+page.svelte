<script lang="ts">
    import { onMount } from 'svelte';
    import { env } from '$env/dynamic/public';
    import { getLocalizedText, loadTexts, pageHeader, pageSubHeader, documentTitle } from '$lib/stores/translatedTexts.js';
    import BattleshipGame from '$lib/components/battleship/BattleshipGame.svelte';
    import { battleshipConfig } from '$lib/config/battleshipConfig.js';
    import VirtualKeyboard from '$lib/components/common/VirtualKeyboard.svelte';

    let playerInitials = "";
    let gameStarted = false;
    
    // Load language texts
    let pageTexts = 'battleship';
    let commonTexts = 'common';
    let isLoading = true;

    let alt = env.PUBLIC_VARIANT === 'alt' ? 'Alt' : '';

    async function fetchTexts() {
        isLoading = true;
        await loadTexts(pageTexts);
        await loadTexts(commonTexts);
        isLoading = false;
    }

    onMount(async () => {
        await fetchTexts();
    });

    $: if (!isLoading) {
        pageHeader.set(getLocalizedText(pageTexts, 'headerTitle'));
        pageSubHeader.set(getLocalizedText(pageTexts, 'headerSubTitle'));
        documentTitle.set(getLocalizedText(pageTexts, 'headerTitle') + ' - ' + getLocalizedText(commonTexts, 'documentTitle' + alt));
    }
    
    function handleSubmitInitials(initials) {
        playerInitials = initials.toUpperCase();
        gameStarted = true;
    }
</script>

<div class="battleship-container">
    {#if !gameStarted}
        <div class="game-setup">
            <h2>Enter your initials to play</h2>
            <VirtualKeyboard onSubmit={handleSubmitInitials} />
        </div>
    {:else}
        <BattleshipGame username={playerInitials} />
    {/if}
    
    <div class="env-info">
        <p>Debug CPU board: {battleshipConfig.debugCpuBoard ? 'Enabled' : 'Disabled'}</p>
    </div>
</div>

<style>
    .battleship-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 2rem;
        max-width: 1200px;
        margin: 0 auto;
    }

    h1 {
        color: #2c3e50;
        margin-bottom: 2rem;
        font-size: 2.5rem;
        text-align: center;
    }
    
    h2 {
        color: #3498db;
        margin-bottom: 1rem;
        font-size: 1.5rem;
        text-align: center;
    }
    
    .game-setup {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        align-items: center;
        margin-bottom: 2rem;
        width: 100%;
        max-width: 400px;
        padding: 2rem;
        border-radius: 10px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
    
    .env-info {
        margin-top: 2rem;
        font-size: 0.8rem;
        color: #7f8c8d;
    }
    

</style> 