<script>
    export let x;
    export let y;
    export let width = 40;
    export let height = 20;
</script>

<style>
    .bone {
        position: absolute;
        background-image: url('/images/dogrun/bone/bone.png');
        background-size: cover;
        background-color: transparent;
    }
</style>

<div class="bone" style="left: {x}px; top: {y}px; width: {width}px; height: {height}px;"></div>
