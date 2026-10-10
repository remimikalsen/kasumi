<script>
    import PuddelGame from '#lib/components/puddel/PuddelGame.svelte';
    import { getLocalizedText, loadTexts, activeLanguage, pageHeader, pageSubHeader, documentTitle } from '#lib/stores/translatedTexts.js';
    import { onMount } from 'svelte';
    import { PUBLIC_VARIANT } from '$app/env/public';

    const pageTexts = 'puddel';
    const commonTexts = 'common';
    let isLoading = true;

    let alt = PUBLIC_VARIANT === 'alt' ? 'Alt' : '';

    async function fetchTexts() {
        isLoading = true;
        await loadTexts(pageTexts);
        await loadTexts(commonTexts);
        isLoading = false;
    }

    onMount(async () => {
        await fetchTexts();
    });

    $: ($activeLanguage, fetchTexts());

    $: if (!isLoading) {
        pageHeader.set(getLocalizedText(pageTexts, 'headerTitle'));
        pageSubHeader.set(getLocalizedText(pageTexts, 'headerSubTitle'));
        documentTitle.set(getLocalizedText(pageTexts, 'headerTitle') + ' - ' + getLocalizedText(commonTexts, 'documentTitle' + alt));
    }
</script>

<PuddelGame />
