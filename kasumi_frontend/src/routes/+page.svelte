
<script>
    import { onMount } from 'svelte';
    import { env } from '$env/dynamic/public';
    import { getLocalizedText, loadTexts, activeLanguage, documentTitle, pageHeader, pageSubHeader } from '$lib/stores/translatedTexts.js';

    const pageTexts = 'frontpage';
    const commonTexts = 'common';
    let isLoading = true;

    let alt = env.PUBLIC_VARIANT === 'alt' ? 'Alt' : '';

    async function fetchTexts() {
        isLoading = true;
        await loadTexts(pageTexts);
        await loadTexts(commonTexts);
        isLoading = false;
    }

    let dogrunLeaderboard = [];
    let pacmazeLeaderboard = [];
    let spaceAdventureLeaderboard = [];

    async function loadLeaderboards() {
        const headers = {
            'Authorization': `Bearer ${env.PUBLIC_API_KEY}`
        };

        const [dogrunResponse, pacmazeResponse, spaceAdventureResponse] = await Promise.all([
            fetch('/api/dogrun/get_leaderboard', { headers }),
            fetch('/api/pacmaze/get_leaderboard', { headers }),
            fetch('/api/space-adventure/get_leaderboard', { headers })
        ]);

        const dogrunData = await dogrunResponse.json();
        const pacmazeData = await pacmazeResponse.json();
        const spaceAdventureData = await spaceAdventureResponse.json();

        if (Array.isArray(dogrunData) && dogrunData.length > 0) {
            dogrunLeaderboard = [...dogrunData];
        }

        if (Array.isArray(pacmazeData) && pacmazeData.length > 0) {
            pacmazeLeaderboard = [...pacmazeData];
        }        
        
        if (Array.isArray(spaceAdventureData) && spaceAdventureData.length > 0) {
            spaceAdventureLeaderboard = [...spaceAdventureData];
        }        
                
    }

    onMount(async () => {
        await fetchTexts();
        await loadLeaderboards();
    });

    $: $activeLanguage, fetchTexts();

    
    $: if (!isLoading) {
        pageHeader.set(getLocalizedText(commonTexts, 'headerTitle'+alt));
        pageSubHeader.set(getLocalizedText(commonTexts, 'headerSubTitle'+alt));
        documentTitle.set(getLocalizedText(commonTexts, 'documentTitle'+alt));
    }
    
</script>

{#if isLoading}
    <div class="loading-container">
        <img src="/images/loading.gif" alt="Loading..." />
    </div>
{:else}
        <div class="ingress">
            <p>
                {#if getLocalizedText(pageTexts, 'contentIngress').includes('.')}
                    {#each getLocalizedText(pageTexts, 'contentIngress').split('.').filter(Boolean) as sentence, index (index)}
                        <span>{sentence}{index < getLocalizedText(pageTexts, 'contentIngress').split('.').filter(Boolean).length - 1 ? '.' : ''}</span>{index < getLocalizedText(pageTexts, 'contentIngress').split('.').filter(Boolean).length - 1 ? ' ' : ''}
                    {/each}
                {:else}
                    <span>{getLocalizedText(pageTexts, 'contentIngress')}</span>
                {/if}
            </p>
        </div>
        <div class="content">
            <div class="preview">
                <a href="/spill/dogrun" class="glowing">
                    <img src="/images/front-page/dogrun-preview.png" alt="{getLocalizedText(pageTexts, 'dogRunImgAltText')}" />
                </a>
                {#if dogrunLeaderboard.length > 0}
                    <div class="score">
                        <p class="topScore">{getLocalizedText(pageTexts, 'dogRunTopScoreIntro')}</p>
                        <p class="goldenLight">
                            {@html getLocalizedText(pageTexts, 'dogRunTopScore')
                                .replace('<INITIALS>', `<span style="text-transform: uppercase;">${dogrunLeaderboard[0]?.initials || ''}</span>`)
                                .replace('<SCORE>', dogrunLeaderboard[0]?.bones || '')
                                .replace('<BONE_TEXT>', dogrunLeaderboard[0]?.bones === 1 
                                    ? getLocalizedText(pageTexts, 'bone_singular') 
                                    : getLocalizedText(pageTexts, 'bone_plural'))}
                        </p>
                    </div>
                {/if}
            </div>
            <div class="preview">
                <a href="/spill/space-adventure" class="glowing">
                    <img src="/images/front-page/space-adventure-preview.png" alt="{getLocalizedText(pageTexts, 'spaceAdventureAltText')}" />
                </a>
                {#if spaceAdventureLeaderboard.length > 0}
                    <div class="score">
                        <p class="topScore">{getLocalizedText(pageTexts, 'spaceAdventureTopScoreIntro')}</p>
                        <p class="goldenLight">
                            {@html getLocalizedText(pageTexts, 'spaceAdventureTopScore')
                                .replace('<INITIALS>', `<span style="text-transform: uppercase;">${spaceAdventureLeaderboard[0]?.initials || ''}</span>`)
                                .replace('<POINTS>', (spaceAdventureLeaderboard[0].points))
                                .replace('<POINTS_TEXT>', getLocalizedText(pageTexts, 'points'))}
                        </p>
                    </div>
                {/if}
            </div>
            <div class="preview">
                <a href="/spill/pacmaze" class="glowing">
                    <img src="/images/front-page/pacmaze-preview.png" alt="{getLocalizedText(pageTexts, 'pacMazeImgAltText')}" />
                </a>
                {#if pacmazeLeaderboard.length > 0}
                    <div class="score">
                        <p class="topScore">{getLocalizedText(pageTexts, 'pacMazeTopScoreIntro')}</p>
                        <p class="goldenLight">
                            {@html getLocalizedText(pageTexts, 'pacMazeTopScore')
                                .replace('<INITIALS>', `<span style="text-transform: uppercase;">${pacmazeLeaderboard[0]?.initials || ''}</span>`)
                                .replace('<TIME>', (pacmazeLeaderboard[0].time).toFixed(2).replace('.', getLocalizedText(pageTexts, 'decimal_separator')))
                                .replace('<TIME_TEXT>', pacmazeLeaderboard[0]?.time >= 2 
                                    ? getLocalizedText(pageTexts, 'time_plural') 
                                    : getLocalizedText(pageTexts, 'time_singular'))}
                        </p>
                    </div>
                {/if}
            </div>
            <div class="preview">
                <a href="/spill/pawsclaws" class="glowing">
                    <img src="/images/front-page/pawsclaws-preview.png" alt="{getLocalizedText(pageTexts, 'pawsclawsImgAltText')}" />
                </a>
                    <div class="score">
                        <p class="topScore">{getLocalizedText(pageTexts, 'pawsclawsTopScoreIntro')}</p>
                        <p class="goldenLight">
                            {getLocalizedText(pageTexts, 'pawsclawsTopScore')}
                        </p>
                    </div>
            </div>
        </div>
{/if}

<style>
    .preview {
        flex: 1 1 450px;
        max-width: 450px;
        box-sizing: border-box;
    }    

    .ingress p span {
        display: inline-block;
        white-space: nowrap;
    }

    .preview a {
        display: block;
    }

    .preview img {
        width: 100%;
        height: auto;
        padding: 30px;
        box-sizing: border-box;
    }

    div.score,
    p.topScore {
        margin-top: 0px;
        white-space: nowrap;
    }

    div.score p.topScore {
        font-family: 'Courier New', Courier, monospace;
    }

</style>