<script lang="ts">
    import GameSetup from '$lib/components/battleship/GameSetup.svelte';
</script>

<div class="game-container">
    <h1>Battleship</h1>
    <GameSetup />
</div>

<style>
    .game-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 2rem;
        max-width: 600px;
        margin: 0 auto;
    }

    h1 {
        color: #2c3e50;
        margin-bottom: 2rem;
        font-size: 2.5rem;
        text-align: center;
    }
</style> 