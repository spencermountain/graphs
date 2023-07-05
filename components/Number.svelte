<script>
  export let text = 0
  export let label = ''
</script>

<div class="col">
  <div class="label">{label}</div>
  <input type="text" bind:value={text} class="number" />
</div>

<style>
  .number {
    width: 100px;

    border-radius: 4px;
    padding-left: 1rem;
    color: #525050;
    direction: ltr;
    line-height: 2.6rem;
    font-size: 2rem;
    padding-top: 0.85rem;
    padding-bottom: 0.75rem;
    font-family: 'Merriweather', Georgia, 'Times New Roman', Times, serif;
    box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
  }
  .col {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
    text-align: center;
    flex-wrap: wrap;
    align-self: stretch;
  }
</style>
