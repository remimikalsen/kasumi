<script>
    import { onDestroy } from 'svelte';
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();
    let intervals = {};

    function startKeyRepeat(key) {
        handleKey(key, 'pressed');
        intervals[key] = setTimeout(() => {
            intervals[key] = setInterval(() => {
                handleKey(key, 'pressed');
            }, 100);
        }, 100);
    }

    function stopKeyRepeat(key) {
        clearTimeout(intervals[key]);
        clearInterval(intervals[key]);
        handleKey(key, 'released');
        delete intervals[key];
    }

    function handleKey(key, type) {
        dispatch('key', { key, type });
    }

    function handleTouchEvents(node, key) {
        const start = () => startKeyRepeat(key);
        const stop = () => stopKeyRepeat(key);

        node.addEventListener('touchstart', start);
        node.addEventListener('mousedown', start);
        node.addEventListener('touchend', stop);
        node.addEventListener('mouseup', stop);
        node.addEventListener('touchcancel', stop);
        node.addEventListener('mouseleave', stop);

        return {
            destroy() {
                node.removeEventListener('touchstart', start);
                node.removeEventListener('mousedown', start);
                node.removeEventListener('touchend', stop);
                node.removeEventListener('mouseup', stop);
                node.removeEventListener('touchcancel', stop);
                node.removeEventListener('mouseleave', stop);
            }
        };
    }

    onDestroy(() => {
        Object.keys(intervals).forEach(key => stopKeyRepeat(key));
    });
</script>

<div class="virtual-joystick">
    <div>
        <button class="up" use:handleTouchEvents={'ArrowUp'}>↑</button>
        <button use:handleTouchEvents={'ArrowLeft'}>←</button>
        <button use:handleTouchEvents={'ArrowRight'}>→</button>
    </div>
</div>

<style>
    .virtual-joystick {
        display: none;
    }

    .virtual-joystick .up {
        margin-right: 75px;
    }

    @media (pointer: coarse) {
        .virtual-joystick {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-top: 20px;
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
        font-size: 24px;
        margin: 5px;
        border-radius: 10px;
        background-color: #f05972;
        color: white;
        border: none;
        cursor: pointer;
        touch-action: manipulation;
    }

    .virtual-joystick div {
        display: flex;
        justify-content: center;
    }

    .virtual-joystick button:active {
        background-color: #e04b5d;
    }
</style>
