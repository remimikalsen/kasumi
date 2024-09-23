<script>
    export let x;
    export let y;
    export let width = 150;
    export let height = 50;
</script>

<style>
    .hole {
        position: absolute;
        background-color: skyblue;
        z-index: 1;
    }
</style>

<div class="hole" style="left: {x}px; top: {y}px; width: {width}px; height: {height}px; margin-top: -10px;"></div>
