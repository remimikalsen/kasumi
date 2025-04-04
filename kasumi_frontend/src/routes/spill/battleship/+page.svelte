<script lang="ts">
    import { onMount } from 'svelte';
    import { env } from '$env/dynamic/public';
    import { getLocalizedText, loadTexts, pageHeader, pageSubHeader, documentTitle } from '$lib/stores/translatedTexts.js';
    import BattleshipGame from '$lib/components/battleship/BattleshipGame.svelte';
    import GameSetup from '$lib/components/battleship/GameSetup.svelte';
    import { battleshipConfig } from '$lib/config/battleshipConfig.js';
    import type { GameState } from '$lib/services/battleshipServices';
    import { battleshipApi } from '$lib/services/battleshipServices';

    let gameStarted = false;
    let playerInitials = "";
    let gameId: string | null = null;
    let gameState: GameState | null = null;
    
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
    
    async function handleGameStart(event: CustomEvent<{username: string, gameId: string}>) {
        playerInitials = event.detail.username;
        gameId = event.detail.gameId;

        const gameStateResponse = await battleshipApi.getGameState(gameId, playerInitials);
        gameState = gameStateResponse.gameState;

        gameStarted = true;
    }

    function handleGameDone() {
        gameStarted = false;
    }
</script>

    {#if !gameStarted}
        <GameSetup on:gameStart={handleGameStart} />
    {:else}
        <BattleshipGame 
            username={playerInitials} 
            gameState={gameState}
            on:done={handleGameDone}
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