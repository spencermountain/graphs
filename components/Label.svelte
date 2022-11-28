<script>
  export let left = 0
  export let top = 0
  export let height = 300
  export let width = 50
  export let opacity = 1
  export let text = ''
</script>

<div
  class="myLabel row"
  style="left:{left}px; top:{top}px; height:{height}px; width:{width}px; opacity:{opacity};"
>
  <div class="flip" style="position:relative;">
    <div class="brace brace_part1" />
    <div class="brace brace_part2" />
    <div class="brace brace_part3" />
    <div class="brace brace_part4" />
  </div>
  <div>
    {text}
  </div>
</div>

<style>
</style>
