<script>
  import byYear from '../../manifest.js'
</script>

<div>
  <div class="" style="font-size:10px; color:grey;">
    graphs by <a class="link" style="font-size:10px;" href="http://twitter.com/spencermountain/"
      >@spencermountain</a
    >
  </div>
  <div class="container ">
    {#each Object.keys(byYear).sort().reverse() as year}
      <div class="year col">
        <div class="which">
          <div class="num">{year}</div>
        </div>
        <div class="posts">
          {#each byYear[year] as o}
            <div class="post col">
              <a href="/{year}/{o.num}" class="target">
                <div>
                  <a href="/{year}/{o.num}" class="link">{o.title}</a>
                </div>
                <div>
                  <img alt="" style="width:150px;" src="/{year}/{o.num}/{o.thumb}" />
                </div>
              </a>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<!-- <svelte:component this={ChatBox} /> -->
<style>
  .target:hover {
    border: 1px solid lightgrey;
    box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
  }
  .target {
    border: 1px solid #fbfbfb;
    padding: 2rem;
  }
  .link {
    color: steelblue;
    text-decoration: none;
  }
  .container {
    margin: 3rem;
  }
  .which {
    width: 800px;
    text-align: left;
    /* align-self: flex-start;
    margin-left: 150px; */
    margin-bottom: 2rem;
    margin-top: 50px;
  }
  .num {
    display: inline;
    padding-left: 1.5rem;
    padding-right: 1.5rem;
    border-bottom: 3px solid steelblue;
  }
  .posts {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
    margin-bottom: 2rem;
    /* height: fit-content; */
  }
  @media only screen and (max-width: 800px) {
    .posts {
      grid-template-columns: repeat(1, 1fr);
    }
    .which {
      width: 400px;
    }
  }

  .link {
    font-size: 0.9rem;
  }
  .col {
    display: flex;
    width: 100%;
    flex: 1;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    text-align: center;
    flex-wrap: nowrap;
    align-self: stretch;
  }
  .year {
    margin-top: 2rem;
  }
  .post {
    /* border: 1px solid grey; */
    overflow: hidden;
    width: 400px;
    min-height: 260px;
    font-size: 1.2rem;
  }
</style>
