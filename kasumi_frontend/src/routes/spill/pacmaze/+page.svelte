<script>
    import PacMazeGame from '$lib/components/pacmaze/PacMazeGame.svelte';
    import { getLocalizedText, loadTexts, pageHeader, pageSubHeader, documentTitle } from '$lib/stores/translatedTexts.js';
    import { onMount } from 'svelte';
    import { env } from '$env/dynamic/public';

    let pageTexts = 'pacmaze';
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

</script>

<PacMazeGame />