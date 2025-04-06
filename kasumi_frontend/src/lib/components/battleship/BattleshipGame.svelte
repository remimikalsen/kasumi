<script lang="ts">
    import { onMount } from 'svelte';
    import BattleshipGameEngine from './BattleshipGameEngine.svelte';
    import GameSetup from './GameSetup.svelte';
    import { battleshipConfig } from '$lib/config/battleshipConfig.ts';
    import type { GameState, LeaderboardEntry } from '$lib/services/battleshipServices';
    import { battleshipApi } from '$lib/services/battleshipServices';
    import { getLocalizedText, loadTexts, activeLanguage } from '$lib/stores/translatedTexts.js';
    import VirtualKeyboard from '$lib/components/common/VirtualKeyboard.svelte';

    const pageTexts = 'battleship';
    let isLoadingTexts = true;

    let gameStarted = false;
    let playerInitials = "";
    let gameId: string | null = null;
    let gameState: GameState | null = null;
    let leaderboard: LeaderboardEntry[] = [];
    let winStreak = 0;
    let showScoreModal = false;
    
    async function fetchTexts() {
        isLoadingTexts = true;
        await loadTexts(pageTexts);
        isLoadingTexts = false;
    }

    $: $activeLanguage, fetchTexts();

    onMount(async () => {
        await loadLeaderboard();
    });

    async function loadLeaderboard() {
        try {
            const data = await battleshipApi.getLeaderboard();
            if (Array.isArray(data) && data.length > 0) {
                leaderboard = [...data];
            }
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
        }
    }

    async function handleGameStart(event: CustomEvent<{username: string, gameId: string}>) {
        playerInitials = event.detail.username;
        gameId = event.detail.gameId;

        const gameStateResponse = await battleshipApi.getGameState(gameId, playerInitials);
        gameState = gameStateResponse.gameState;

        gameStarted = true;
    }

    async function handleGameDone(event: CustomEvent<{winStreak?: number}>) {
        // Check if player has a win streak to save
        if (event.detail?.winStreak && event.detail.winStreak > 0) {
            winStreak = event.detail.winStreak;
            showScoreModal = true;
        } else {
            gameStarted = false;
        }
    }

    async function handleSubmitScore() {
        try {
            await battleshipApi.submitScore(gameId!, playerInitials);
            await loadLeaderboard();
            showScoreModal = false;
            gameStarted = false;
        } catch (error) {
            console.error('Failed to submit score:', error);
            // Continue to end the game even if score submission fails
            showScoreModal = false;
            gameStarted = false;
        }
    }

    function skipSubmitScore() {
        showScoreModal = false;
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

    {#if leaderboard && leaderboard.length > 0}
        <div class="leaderboard">
            <h2>{getLocalizedText(pageTexts, "high_score")}</h2>
            <table>
                <thead>
                    <tr>
                        <th class="rank">{getLocalizedText(pageTexts, "rank")}</th>
                        <th class="initials">{getLocalizedText(pageTexts, "initials")}</th>
                        <th class="win-streak">{getLocalizedText(pageTexts, "win_streak")}</th>
                    </tr>
                </thead>
                <tbody>
                    {#each leaderboard as { initials, win_streak }, i}
                        <tr>
                            <td class="rank">{i + 1}.</td>
                            <td class="initials">{initials}</td>
                            <td class="win-streak">{win_streak}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}

    {#if showScoreModal}
        <div class="score-modal-overlay">
            <div class="score-modal">
                <h2>{getLocalizedText(pageTexts, "battle_complete")}</h2>
                <p>{getLocalizedText(pageTexts, "win_streak_text").replace("{0}", winStreak.toString())}</p>
                
                <div class="score-inputs">
                    <p>{getLocalizedText(pageTexts, "submit_score_prompt").replace("{0}", playerInitials)}</p>
                </div>
                
                <div class="modal-actions">
                    <button class="submit-button" on:click={handleSubmitScore}>
                        {getLocalizedText(pageTexts, "submit_label")}
                    </button>
                    <button class="skip-button" on:click={skipSubmitScore}>
                        {getLocalizedText(pageTexts, "skip")}
                    </button>
                </div>
                
                {#if leaderboard && leaderboard.length > 0}
                    <div class="leaderboard">
                        <h3>{getLocalizedText(pageTexts, "high_score")}</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th class="rank">{getLocalizedText(pageTexts, "rank")}</th>
                                    <th class="initials">{getLocalizedText(pageTexts, "initials")}</th>
                                    <th class="win-streak">{getLocalizedText(pageTexts, "win_streak")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each leaderboard as { initials, win_streak }, i}
                                    <tr>
                                        <td class="rank">{i + 1}.</td>
                                        <td class="initials">{initials}</td>
                                        <td class="win-streak">{win_streak}</td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
{/if}

<style>
    .env-info {
        margin-top: 2rem;
        font-size: 0.8rem;
        color: #7f8c8d;
    }

    .leaderboard {
        margin: 2rem auto;
        max-width: 500px;
        background-color: #1b263b;
        border-radius: 8px;
        padding: 1rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .leaderboard h2, .leaderboard h3 {
        color: #e0e1dd;
        text-align: center;
        margin-bottom: 1rem;
        font-size: 1.5rem;
    }

    .leaderboard h3 {
        font-size: 1.2rem;
    }

    .leaderboard table {
        width: 100%;
        border-collapse: collapse;
        color: #e0e1dd;
    }

    .leaderboard th, .leaderboard td {
        padding: 0.5rem;
        text-align: center;
        border-bottom: 1px solid #415a77;
    }

    .leaderboard th {
        color: #e0e1dd;
        font-weight: bold;
    }

    .leaderboard tr:first-child td {
        color: #ffd700;
        font-weight: bold;
    }

    .leaderboard tr:nth-child(2) td {
        color: #c0c0c0;
        font-weight: bold;
    }

    .leaderboard tr:nth-child(3) td {
        color: #cd7f32;
        font-weight: bold;
    }

    .leaderboard .rank {
        width: 15%;
    }

    .leaderboard .initials {
        width: 40%;
    }

    .leaderboard .win-streak {
        width: 45%;
    }

    .score-modal-overlay {
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

    .score-modal {
        background-color: #1b263b;
        padding: 2rem;
        border-radius: 10px;
        max-width: 600px;
        width: 90%;
    }

    .score-modal h2 {
        color: #e0e1dd;
        text-align: center;
        margin-bottom: 1rem;
    }

    .score-modal p {
        color: #e0e1dd;
        text-align: center;
        margin-bottom: 1.5rem;
        font-size: 1.2rem;
    }

    .score-inputs {
        margin-bottom: 1.5rem;
    }

    .player-name {
        font-size: 1.5rem;
        color: #e0e1dd;
        background-color: #415a77;
        padding: 0.75rem 1.5rem;
        border-radius: 4px;
        display: inline-block;
        margin: 0.5rem 0;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    .modal-actions {
        display: flex;
        justify-content: center;
        gap: 1rem;
        margin: 1.5rem 0;
    }

    .submit-button {
        background-color: #0b5d0b;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.3s ease;
    }

    .submit-button:hover {
        filter: brightness(90%);
        transform: translateY(-2px);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
    }

    .skip-button {
        background-color: #778da9;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.3s ease;
    }

    .skip-button:hover {
        filter: brightness(90%);
        transform: translateY(-2px);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
    }
</style>