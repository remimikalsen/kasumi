<script lang="ts">
    import { onMount } from 'svelte';
    import BattleshipGameEngine from './BattleshipGameEngine.svelte';
    import GameSetup from './GameSetup.svelte';
    import { battleshipConfig } from '$lib/config/battleshipConfig.js';
    import type { GameState } from '$lib/services/battleshipServices';
    import { battleshipApi } from '$lib/services/battleshipServices';
    import { getLocalizedText, loadTexts, activeLanguage } from '$lib/stores/translatedTexts.js';

    const pageTexts = 'battleship';
    let isLoadingTexts = true;

    let gameStarted = false;
    let playerInitials = "";
    let gameId: string | null = null;
    let gameState: GameState | null = null;
    
    async function fetchTexts() {
        isLoadingTexts = true;
        await loadTexts(pageTexts);
        isLoadingTexts = false;
    }

    $: $activeLanguage, fetchTexts();

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

{#if !isLoadingTexts}
    {#if !gameStarted}
        <GameSetup on:gameStart={handleGameStart} />
    {:else}
        <BattleshipGameEngine 
            username={playerInitials} 
            gameState={gameState}
            on:done={handleGameDone}            
        />
    {/if}

    {#if battleshipConfig.debugOpponentBoard}
        <div class="env-info">
            <p>{getLocalizedText(pageTexts, "debuggingOpponentBoard")}</p>
        </div>
    {/if}
{/if}

<style>
    .env-info {
        margin-top: 2rem;
        font-size: 0.8rem;
        color: #7f8c8d;
    }
</style>