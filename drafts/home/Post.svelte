<script>
  let posts = [
    { src: '/2022/accumulated-units', title: 'Accumulated-housing in Toronto' },
    { src: '/2022/bluejays-calendar', title: 'Bluejays Calendar' },
    { src: '/2022/construction-map', title: 'Toronto construction-map' },
    { src: '/2022/missing-middle', title: "Toronto's missing middle" },
    { src: '/2022/pipeline', title: 'Toronto housing pipeline' },
    { src: '/2022/population-growth', title: 'population-growth' },
    { src: '/2022/riding-sankey', title: 'Toronto housing by ward' },
    { src: '/2022/toronto-construction', title: 'Toronto construction applications' },
    { src: '/2022/toronto-council', title: 'Toronto Council' },
    { src: '/2022/transit-map', title: 'Toronto transit by ward' },
  ]
</script>

<div>
  <div class="goleft m1" style="top:10px; left:10px; font-size:12px;">
    graphs by <a href="http://twitter.com/spencermountain/">@spencermountain</a>
  </div>
  <div>
    <a href={posts[0].src}>{posts[0].title}</a>
    <iframe
      class="frame"
      src={posts[0].src}
      title={posts[0].title}
      loading="lazy"
      frameborder="0"
    />
  </div>
</div>

<!-- <svelte:component this={ChatBox} /> -->
<style>
  .frame {
    width: 100%;
    min-height: 800px;
  }
</style>
