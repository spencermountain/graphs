<script>
  export let num = ''
  export let year = ''
</script>

<style>
  .footer {
    display: flex;
    margin: auto 1rem 1rem auto;
    padding: 0.5rem;
    justify-content: flex-end;
    align-content: flex-end;
    align-items: center;
    padding-top: 5rem;
    width: 100%;
    font-size: 0.8rem;
  }
  .m2 {
    margin: 1.5rem;
  }
  a {
    color: #69c;
    cursor: pointer;
    text-decoration: underline;
  }
  a:hover {
    text-decoration-color: #cc7066;
  }
  .name {
    margin-right: 4rem;
  }
</style>

<!-- footer -->
<div class="footer">
  {#if num && year}
    <a class="m2" href="https://github.com/spencermountain/thensome/tree/gh-pages/{year}/{num}">
      source
    </a>
  {:else}
    <a class="m2" href="https://github.com/spencermountain/thensome">source</a>
  {/if}
  <a class="name" href="http://twitter.com/spencermountain/">@spencermountain</a>
</div>
