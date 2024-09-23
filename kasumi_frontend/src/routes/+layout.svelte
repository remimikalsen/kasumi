<script>
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import { env } from '$env/dynamic/public';
    import LanguageSelector from '$lib/components/common/LanguageSelector.svelte';
    import { getLocalizedText, loadTexts, activeLanguage, pageHeader, pageSubHeader, documentTitle } from '$lib/stores/translatedTexts.js';

    const commonTexts = 'common';
    let isLoading = true;
    let siteBy = '';
    let viewSourceCode = '';
    let back = '';
    let alt = env.PUBLIC_VARIANT === 'alt' ? 'Alt' : '';

    async function fetchTexts() {
        isLoading = true;
        await loadTexts(commonTexts);
        siteBy = getLocalizedText(commonTexts, 'siteBy'+alt);
        back = getLocalizedText(commonTexts, 'back');
        viewSourceCode = getLocalizedText(commonTexts, 'viewSourceCode');
        isLoading = false;
    }

    $: documentTitleText = $documentTitle || '<title>';
    $: pageHeaderText = $pageHeader || '<header>';
    $: pageSubHeaderText = $pageSubHeader || '<subheader>';
    $: $activeLanguage, fetchTexts();

    onMount(fetchTexts);

    function goBack() {
        window.history.back();
    }    

    $: {
        
        if (browser && documentTitle) {
            document.title = documentTitleText;
        }
        
    }
</script>

{#if isLoading}
    <div class="loading-container">
        <img src="/images/loading.gif" alt="Loading..." />
    </div>
{:else}
    <div class="layout">
        <header>
            <div class="header-left">
                {#if $page.url.pathname !== '/'}
                    <button type="button" class="back-button" on:click={goBack} aria-label="{back}" title="{back}">
                        <img src="/images/back.png" alt="{back}" title="{back}" />
                    </button>
                {/if}
            </div>
            <div class="header-center">
                <h1 class="page-header">{pageHeaderText}</h1>
                <p class="page-subheader">{pageSubHeaderText}</p>
            </div>
            <div class="header-right">
                {#if $page.url.pathname !== '/'}
                    <button type="button" class="back-button" on:click={goBack} aria-label="{back}" title="{back}">
                        <img src="/images/back.png" alt="{back}" title="{back}" />
                    </button>
                {/if}                
                <LanguageSelector />
            </div>
        </header>
        <main>
            <slot />
        </main>
        <footer>
            <p>{siteBy}</p>
            <p>{viewSourceCode} <a href="https://github.com/remimikalsen/kasumi">GitHub</a></p>
        </footer>
    </div>
{/if}

