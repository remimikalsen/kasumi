<script>
    import { onMount, onDestroy } from 'svelte';

    export let options = [];
    export let selectedValue = '';
    export let onChange = () => {};
    export let className = '';
    export let dropdownLabel = '';
    export let selectOptionText = "Select an option";

    let isOpen = false;
    let dropdownRef;
    let imageCache = {};

    function toggleDropdown() {
        isOpen = !isOpen;
    }

    function handleOptionClick(value) {
        onChange(value);
        isOpen = false;
    }

    function handleClickOutside(event) {
        if (dropdownRef && !dropdownRef.contains(event.target)) {
            isOpen = false;
        }
    }

    function preloadImages() {
        options.forEach(option => {
            if (option.image && !imageCache[option.image]) {
                const img = new Image();
                img.src = option.image;
                imageCache[option.image] = img;
            }
        });
    }

    onMount(() => {
        document.addEventListener('click', handleClickOutside);
        preloadImages();
    });

    onDestroy(() => {
        document.removeEventListener('click', handleClickOutside);
    });
</script>

<div class="dropdown {className}" bind:this={dropdownRef}>
    <button class="dropdown-button" on:click={toggleDropdown} aria-label="{dropdownLabel}" title="{dropdownLabel}">
        {#if selectedValue}
            {#if options.find(option => option.value === selectedValue)?.image}
                <img src={options.find(option => option.value === selectedValue).image} alt={`${selectedValue} flag`} style="width: 20px; height: 20px; vertical-align: middle; margin-right: 5px;">
            {/if}
            {options.find(option => option.value === selectedValue)?.label}
        {:else}
            <span class="dropdown-text">{selectOptionText}</span>
        {/if}
        <span class="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
    </button>
    {#if isOpen}
        <div class="dropdown-options">
            {#each options as option}
                <button type="button" class="dropdown-option {option.value === selectedValue ? 'selected' : ''}" on:click={() => handleOptionClick(option.value)} on:keydown={(e) => e.key === 'Enter' && handleOptionClick(option.value)} role="option" aria-selected={option.value === selectedValue}>
                    {#if option.image}
                        <img src={option.image} alt={`${option.value} flag`} style="width: 20px; height: 20px; vertical-align: middle; margin-right: 5px;">
                    {/if}
                    <span class="dropdown-text">{option.label}</span>
                </button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .dropdown-button {
        background-color: #1b263b;
        color: #e0e1dd;
        border: 1px solid #f05972;
        padding: 10px;
        border-radius: 5px;
        font-size: 1rem;
        outline: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: border-color 0.3s ease-in-out, box-shadow 0.3s ease-in-out;
        width: 100%;
    }

    .dropdown-button:hover,
    .dropdown-button:focus {
        border-color: #f05972;
        box-shadow: 0 0 10px #f05972;
    }

    .dropdown-arrow {
        margin-left: auto;
        padding-left: 10px;
    }

    .dropdown-options {
        display: block;
        position: absolute;
        background-color: #1b263b;
        border: 1px solid #f05972;
        border-radius: 5px;
        margin-top: 0px;
        z-index: 1;
        box-sizing: border-box;
    }

    .dropdown-option {
        padding: 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        box-sizing: border-box;
        border-radius: 6px;
        border-style: none;
        background-color: transparent;
        width: 100%;
        color: #e0e1dd;
    }

    .dropdown-option:hover {
        background-color: #0d1b2a;
        font-weight: bold;
    }

    .dropdown-option.selected {
        background-color: #f05972;
    }

    .dropdown-option img {
        margin-right: 5px;
    }
</style>