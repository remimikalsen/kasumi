<script>
    export let x = 0;
    export let y = 0;
    export let width = 50; // Set the default width
    export let height = 50; // Set the default height
</script>

<style>
    .dog {
        position: absolute;
    }
</style>

<div 
    class="dog" 
    style="left: {x}px; top: {y}px; width: {width}px; height: {height}px;">
    <img src="/images/dogrun/goal/dog-house2.png" alt="Dog" style="width: 100%; height: 100%;" />
</div>
