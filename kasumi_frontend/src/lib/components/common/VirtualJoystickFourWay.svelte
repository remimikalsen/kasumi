<script>
    import { onDestroy } from 'svelte';
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();
    let interval;
    export let spaceKey = '';

    function startKeyRepeat(key) {
        stopKeyRepeat();
        handleKey(key);
        interval = setTimeout(() => {
            interval = setInterval(() => {
                handleKey(key);
            }, 100);
        }, 100);
    }

    function stopKeyRepeat() {
        clearTimeout(interval);
        clearInterval(interval);
    }

    function handleKey(key) {
        dispatch('key', { key });
    }

    function handleTouchEvents(node, key) {
        const start = () => startKeyRepeat(key);
        const stop = () => stopKeyRepeat();

        node.addEventListener('touchstart', start);
        node.addEventListener('touchend', stop);
        node.addEventListener('touchcancel', stop);

        return {
            destroy() {
                node.removeEventListener('touchstart', start);
                node.removeEventListener('touchend', stop);
                node.removeEventListener('touchcancel', stop);
            }
        };
    }

    onDestroy(() => {
        stopKeyRepeat(); // This will run when the component is unmounted
    });

</script>

<div class="virtual-joystick">
    {#if spaceKey}
    <div class="space-key">
        <button class="space" use:handleTouchEvents={'Space'}>{spaceKey}</button>
    </div>
    {/if}
    <div class="directional-keys">
    <button use:handleTouchEvents={'ArrowUp'}>↑</button>
    <div>
        <button class="left" use:handleTouchEvents={'ArrowLeft'}>←</button>
        <button use:handleTouchEvents={'ArrowDown'}>↓</button>
        <button class="right" use:handleTouchEvents={'ArrowRight'}>→</button>
    </div>
    </div>
</div>


<!-- Rest of your Svelte component code -->

<style>

    .virtual-joystick {
       display: none;
    }

    .virtual-joystick div {
        display: flex;
        margin: auto;
    }

    .virtual-joystick button:active {
        background-color: #e04b5d;
    }


@media (pointer: coarse) {
    .virtual-joystick {
        display: flex;
        flex-direction: row;
        align-items: center;
        margin-top: 10px;
        margin-bottom: 10px;
    }

    .virtual-joystick .space-key {
        justify-content: bottom;
    }

    .virtual-joystick .directional-keys {
        flex-direction: column;
        align-items: center;
        justify-content: center; 
    }
}

    .virtual-joystick button {
        user-select: none;  /* Prevent text selection */
        -webkit-user-select: none;
        -ms-user-select: none;
        -moz-user-select: none;
        -webkit-tap-highlight-color: transparent; /* Remove tap highlight on touch devices */
        width: 60px;
        height: 60px;
        font-size: 24spx;
        margin: 5px;
        border-radius: 10px;
        background-color: #f05972;
        color: white;
        border: none;
        cursor: pointer;
    }

    .virtual-joystick button.space {
        width: 100px;
    }

</style>
