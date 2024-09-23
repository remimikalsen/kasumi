<script>
    export let x;
    export let y;
    export let width = 23;
    export let height = 20;
</script>

<style>
    .spike {
        position: absolute;
        background-image: url('/images/dogrun/spike/dog-catcher.png');
        background-size: cover;
        background-color: transparent;
    }
</style>

<div class="spike" style="left: {x}px; top: {y}px; width: {width}px; height: {height}px;"></div>
