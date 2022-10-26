<script>
  import VirtualList from 'svelte-tiny-virtual-list'
  import InfiniteLoading from 'svelte-infinite-loading'
  import posts from './posts.js'

  // let posts = [
  //   { src: '/2022/accumulated-units', title: 'Accumulated-housing in Toronto' },
  //   { src: '/2022/bluejays-calendar', title: 'Bluejays Calendar' },
  //   { src: '/2022/construction-map', title: 'Toronto construction-map' },
  //   { src: '/2022/missing-middle', title: "Toronto's missing middle" },
  //   { src: '/2022/pipeline', title: 'Toronto housing pipeline' },
  //   { src: '/2022/population-growth', title: 'population-growth' },
  //   { src: '/2022/riding-sankey', title: 'Toronto housing by ward' },
  //   { src: '/2022/toronto-construction', title: 'Toronto construction applications' },
  //   { src: '/2022/toronto-council', title: 'Toronto Council' },
  //   { src: '/2022/transit-map', title: 'Toronto transit by ward' },
  // ]

  let n = 3
  let data = posts.slice(0, 3)

  function infiniteHandler({ detail: { loaded, complete, error } }) {
    try {
      // Normally you'd make an http request here...

      // const newData = ['G', 'H', 'I', 'J', 'K', 'L' /* ... */]
      n += 1
      if (posts[n]) {
        data.push(posts[n])
        console.log('more:', posts[n].title)
        data = data
        loaded()
      } else {
        console.log('done!')
        complete()
      }
    } catch (e) {
      console.log(e)
      error()
    }
  }
  let height = window.innerHeight
</script>

<VirtualList width="100%" {height} itemCount={data.length} itemSize={850}>
  <div slot="item" class="item" let:index let:style {style}>
    <a href={data[index].src}>{data[index].title}</a>
    <iframe
      class="frame"
      src={data[index].src}
      title={data[index].title}
      loading="lazy"
      scrolling="no"
      frameborder="0"
    />
  </div>

  <div slot="footer">
    <InfiniteLoading on:infinite={infiniteHandler} noMore="-">
      <span slot="noMore" />
    </InfiniteLoading>
  </div>
</VirtualList>

<style>
  .item {
    min-height: 100px;
    width: 100px;
    border: 1px solid grey;
  }
  .frame {
    width: 100%;
    min-height: 800px;
    border: 1px solid grey;
  }
</style>
