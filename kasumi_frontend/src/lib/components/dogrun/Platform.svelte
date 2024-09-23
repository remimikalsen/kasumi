<script>
    export let x;
    export let y;
    export let width = 150;
    export let height = 20;
    export let platformAdjustment = 0;
</script>

<style>
    .platform {
        position: absolute;
        background-image: url('/images/dogrun/ground/ground.png');
        background-repeat: repeat-x;
        background-size: auto 100%; /* Scale the image to the height of the div */
    }
</style>

<div class="platform" style="left: {x}px; top: {y-platformAdjustment}px; width: {width}px; height: {height}px;"></div>
