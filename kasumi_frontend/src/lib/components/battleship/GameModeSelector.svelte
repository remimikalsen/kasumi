<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();

    let selectedMode: 'cpu' | 'token' | 'discovery' | null = null;
    let gameToken = '';
    let isDiscovering = false;
    let localPlayers: string[] = [];

    function handleModeSelect(mode: 'cpu' | 'token' | 'discovery') {
        selectedMode = mode;
        dispatch('gameModeSelect', mode);

        if (mode === 'discovery') {
            startDiscovery();
        }
    }

    function handleTokenInput(event: Event) {
        const input = event.target as HTMLInputElement;
        gameToken = input.value.toUpperCase();
        dispatch('tokenInput', gameToken);
    }

    async function startDiscovery() {
        isDiscovering = true;
        // TODO: Implement local network discovery
        // This will be implemented when we add the backend functionality
        setTimeout(() => {
            isDiscovering = false;
        }, 5000);
    }

    function selectPlayer(player: string) {
        // TODO: Implement player selection
        console.log('Selected player:', player);
    }
</script>

<div class="game-mode-selector">
    <h2>Select Game Mode</h2>
    
    <div class="mode-buttons">
        <button 
            class="mode-button {selectedMode === 'cpu' ? 'selected' : ''}"
            on:click={() => handleModeSelect('cpu')}
        >
            Play vs CPU
        </button>
        
        <button 
            class="mode-button {selectedMode === 'token' ? 'selected' : ''}"
            on:click={() => handleModeSelect('token')}
        >
            Join with Token
        </button>
        
        <button 
            class="mode-button {selectedMode === 'discovery' ? 'selected' : ''}"
            on:click={() => handleModeSelect('discovery')}
        >
            Find Local Players
        </button>
    </div>

    {#if selectedMode === 'token'}
        <div class="token-input">
            <label for="gameToken">Enter Game Token:</label>
            <input
                type="text"
                id="gameToken"
                bind:value={gameToken}
                on:input={handleTokenInput}
                maxlength="6"
                placeholder="ABC123"
                autocomplete="off"
            />
        </div>
    {/if}

    {#if selectedMode === 'discovery'}
        <div class="discovery-section">
            {#if isDiscovering}
                <p>Searching for players on local network...</p>
            {:else}
                {#if localPlayers.length > 0}
                    <div class="player-list">
                        <h3>Available Players:</h3>
                        {#each localPlayers as player}
                            <button 
                                class="player-button"
                                on:click={() => selectPlayer(player)}
                            >
                                {player}
                            </button>
                        {/each}
                    </div>
                {:else}
                    <p>No players found on local network</p>
                {/if}
            {/if}
        </div>
    {/if}
</div>

<style>
    .game-mode-selector {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        width: 100%;
    }

    h2 {
        color: #2c3e50;
        margin: 0;
        text-align: center;
    }

    .mode-buttons {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .mode-button {
        padding: 1rem;
        font-size: 1.1rem;
        border: 2px solid #3498db;
        border-radius: 5px;
        background-color: white;
        color: #3498db;
        cursor: pointer;
        transition: all 0.2s;
    }

    .mode-button:hover {
        background-color: #f7f9fc;
    }

    .mode-button.selected {
        background-color: #3498db;
        color: white;
    }

    .token-input {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .token-input input {
        padding: 0.8rem;
        font-size: 1.2rem;
        border: 2px solid #3498db;
        border-radius: 5px;
        text-transform: uppercase;
        letter-spacing: 0.2rem;
        text-align: center;
    }

    .discovery-section {
        text-align: center;
        padding: 1rem;
        background-color: #f7f9fc;
        border-radius: 5px;
    }

    .player-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .player-button {
        padding: 0.8rem;
        background-color: white;
        border: 1px solid #3498db;
        border-radius: 5px;
        color: #3498db;
        cursor: pointer;
        transition: all 0.2s;
    }

    .player-button:hover {
        background-color: #f7f9fc;
    }
</style> 