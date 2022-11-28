<script>
  export let title = ''
  export let year = ''
  let url = 'https://github.com/spencermountain/thensome'
  if (title && year) {
    url += `/tree/gh-pages/${year}/${title}`
  }
</script>

<!-- footer -->
<div class="footer">
  <a class="link m2" href={url}>source</a>
  <a class="link name" href="http://twitter.com/spencermountain/">@spencermountain</a>
</div>

<style>
  .footer {
    display: flex;
    margin: auto 1rem 1rem auto;
    padding: 0.5rem;
    justify-content: flex-end;
    align-content: flex-end;
    align-items: center;
    padding-top: 1rem;
    width: 100%;
    font-size: 0.8rem;
  }
  .m2 {
    margin: 1.5rem;
  }
  .link {
    color: #769bb5;
    cursor: pointer;
    text-decoration: none;
  }
  a:hover {
    text-decoration-color: #cc7066;
  }
  .name {
    margin-right: 2rem;
  }
</style>
