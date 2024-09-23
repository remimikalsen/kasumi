<script>
    import { onMount } from 'svelte';
    import { activeLanguage, getLocalizedText, loadTexts } from '$lib/stores/translatedTexts.js';
    import { config } from '@lib/config.js';
    import Dropdown from '$lib/components/common/Dropdown.svelte';

    const componentFile = 'languageselector';
    const languages = config.availableLangs;
    let isLoading = true;

    let options = [];
    
    onMount(async () => {
        isLoading = true;
        await loadTexts(componentFile);
        options = languages.map(lang => ({
            value: lang,
            label: getLocalizedText(componentFile, lang),
            image: `/images/flags/${lang}.png`
        }));
        isLoading = false;
    });

    function changeLanguage(value) {
        activeLanguage.set(value);
        loadTexts(componentFile);
    }
</script>

{#if !isLoading}
    <Dropdown {options} selectOptionText={getLocalizedText(componentFile, "selectLanguage")} dropdownLabel={getLocalizedText(componentFile, "selectLanguage")} className="language-selector" selectedValue={$activeLanguage} onChange={changeLanguage} />
{/if}