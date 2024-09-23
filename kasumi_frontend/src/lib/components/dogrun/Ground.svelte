<script>
    export let x;
    export let y;
    export let width = 150;
    export let height = 20;
    export let groundAdjustment = 0;
</script>

<style>
    .ground {
        position: absolute;
        background-image: url('/images/dogrun/ground/ground.png');
        background-repeat: repeat-x;
        background-size: auto 100%; /* Scale the image to the height of the div */
    }
</style>

<div class="ground" style="left: {x}px; top: {y - groundAdjustment}px; width: {width}px; height: {height}px; "></div>