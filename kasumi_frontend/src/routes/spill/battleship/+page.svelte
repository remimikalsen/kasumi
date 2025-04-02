texts<script lang="ts">
    import { onMount } from 'svelte';
    import { env } from '$env/dynamic/public';
    import { getLocalizedText, loadTexts, pageHeader, pageSubHeader, documentTitle } from '$lib/stores/translatedTexts.js';
    import BattleshipGame from '$lib/components/battleship/BattleshipGame.svelte';
    import GameSetup from '$lib/components/battleship/GameSetup.svelte';
    import { battleshipConfig } from '$lib/config/battleshipConfig.js';

    let gameStarted = false;
    let playerInitials = "";
    let gameId: string | null = null;
    let isCPU = true;
    
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
    
    function handleGameStart(event: CustomEvent<{username: string, gameId: string, isCPU: boolean}>) {
        playerInitials = event.detail.username;
        gameId = event.detail.gameId;
        isCPU = event.detail.isCPU;
        gameStarted = true;
    }
</script>

    {#if !gameStarted}
        <GameSetup on:gameStart={handleGameStart} />
    {:else}
        <BattleshipGame 
            username={playerInitials} 
            gameId={gameId}
        />
    {/if}
    
    <div class="env-info">
        <p>Debug CPU board: {battleshipConfig.debugCpuBoard ? 'Enabled' : 'Disabled'}</p>
    </div>

<style>

    .env-info {
        margin-top: 2rem;
        font-size: 0.8rem;
        color: #7f8c8d;
    }
    

</style> 