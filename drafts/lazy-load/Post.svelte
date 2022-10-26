<script>
  import VirtualList from 'svelte-tiny-virtual-list'
  import InfiniteLoading from 'svelte-infinite-loading'

  let data = ['A', 'B', 'C', 'D', 'E', 'F' /* ... */]

  function infiniteHandler({ detail: { loaded, complete, error } }) {
    try {
      // Normally you'd make an http request here...

      // const newData = ['G', 'H', 'I', 'J', 'K', 'L' /* ... */]
      data.push(Math.random() * 100)
      data = data
      // data = [...data, ...newData]
      // complete()
      loaded()
    } catch (e) {
      console.log(e)
      error()
    }
  }
</script>

<VirtualList width="100%" height={200} itemCount={data.length} itemSize={50}>
  <div slot="item" class="item" let:index let:style {style}>
    {data[index]}
  </div>

  <div slot="footer">
    <InfiniteLoading on:infinite={infiniteHandler} />
  </div>
</VirtualList>

<style>
  .item {
    min-height: 100px;
    width: 100px;
    border: 1px solid grey;
  }
</style>
