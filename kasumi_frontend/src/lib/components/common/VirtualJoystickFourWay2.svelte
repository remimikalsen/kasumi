<script>
    import { createEventDispatcher } from 'svelte';

const dispatch = createEventDispatcher();
export let spaceKey = '';

function handleTouchEvents(node, key) {
    const start = (event) => {
        event.preventDefault();
        handleKeyDown(key);
    };
    const stop = (event) => {
        event.preventDefault();
        handleKeyUp(key);
    };

    node.addEventListener('touchstart', start);
    node.addEventListener('touchend', stop);
    node.addEventListener('touchcancel', stop);

    node.addEventListener('mousedown', start);
    node.addEventListener('mouseup', stop);
    node.addEventListener('mouseleave', stop);

    return {
        destroy() {
            node.removeEventListener('touchstart', start);
            node.removeEventListener('touchend', stop);
            node.removeEventListener('touchcancel', stop);
            node.removeEventListener('mousedown', start);
            node.removeEventListener('mouseup', stop);
            node.removeEventListener('mouseleave', stop);
        }
    };
}

function handleKeyDown(key) {
    dispatch('keydown', { key });
}

function handleKeyUp(key) {
    dispatch('keyup', { key });
}
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
        touch-action: none;
        -webkit-user-select: none; /* Prevent text selection on iOS */
        -ms-user-select: none; /* Prevent text selection on IE10+ */
        user-select: none; /* Prevent text selection on modern browsers */
        -webkit-touch-callout: none; /* Disable callout on long press on iOS */
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
