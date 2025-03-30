<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher<string>();

    let username = '';
    let error = '';

    function handleInput(event: Event) {
        const input = event.target as HTMLInputElement;
        const value = input.value.toUpperCase();
        
        // Only allow letters
        if (value.length > 0 && !/^[A-Z]*$/.test(value)) {
            error = 'Only letters are allowed';
            return;
        }

        // Limit to 3 characters
        if (value.length > 3) {
            username = value.slice(0, 3);
        } else {
            username = value;
        }

        error = '';
        dispatch('usernameChange', username);
    }
</script>

<div class="username-input">
    <label for="username">Enter your three-letter username:</label>
    <input
        type="text"
        id="username"
        bind:value={username}
        on:input={handleInput}
        maxlength="3"
        placeholder="ABC"
        autocomplete="off"
    />
    {#if error}
        <p class="error">{error}</p>
    {/if}
</div>

<style>
    .username-input {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        width: 100%;
    }

    label {
        font-size: 1.1rem;
        color: #2c3e50;
    }

    input {
        padding: 0.8rem;
        font-size: 1.2rem;
        border: 2px solid #3498db;
        border-radius: 5px;
        text-transform: uppercase;
        letter-spacing: 0.2rem;
        text-align: center;
    }

    input:focus {
        outline: none;
        border-color: #2980b9;
        box-shadow: 0 0 5px rgba(41, 128, 185, 0.3);
    }

    .error {
        color: #e74c3c;
        font-size: 0.9rem;
        margin: 0;
    }
</style> 