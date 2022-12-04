<script>
  import { Page } from '../../components/index.mjs'
  export let title = 'Aspect Ratios'
  export let sub = ''
  let x = 200
  let window = 800
  $: x = window > 600 ? 200 : 150
  // aspect ratios as %s:
  let ratios = [
    {
      name: '5:4',
      desc: 'monitors',
      css: '5 / 4 ',
      ratio: 1.25,
    },
    {
      name: '4:3',
      desc: 'ipads, photos',
      css: '4 / 3',
      ratio: 1.3,
    },
    {
      name: '1:√2',
      desc: 'A4 paper',
      css: '1.4142 / 1',
      ratio: 1.41,
    },
    {
      name: '3:2',
      desc: '35mm film',
      css: '3 / 2',
      ratio: 1.5,
    },
    {
      name: 'golden',
      desc: ' snails, etc.',
      css: '1.618 / 1',
      ratio: 1.618,
    },
    {
      name: '16:9',
      desc: "1080p, 'widescreen'",
      css: '16 / 9',
      ratio: 1.77,
    },
    {
      name: '19.5:9',
      desc: 'recent iphones',
      css: '19.5 / 9',
      ratio: 2.16,
    },
  ]
</script>

<svelte:window bind:innerWidth={window} />
<Page {title} {sub}>
  <div style="position:relative; margin-bottom:2rem;">
    {#each ratios as o}
      <div class="ratio col">
        <div class="row">
          <div class="name" class:tinier={true}>{o.name}</div>
          <div class="bars" style=" min-width:{x * ratios[ratios.length - 1].ratio}px; ">
            <div class="one" style="height:50px;  width:{x}px;" />
            <div class="plus" style="height:50px; width:{x * o.ratio}px;" />
            <div class="desc" style="width:100px; left:{x * o.ratio}px;">{o.desc}</div>
            <div class="below" style="left:{x}px; margin-left:15px; color: #946da5;">
              <span style="font-size:10px;">x</span>
              <span style="">{o.ratio}</span>
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>
</Page>

<style>
  .tinier {
    font-size: 16px !important;
  }
  .below {
    position: absolute;
    bottom: -30px;
    color: grey;
    font-size: 18px;
  }

  .row {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    text-align: left;
    flex-wrap: nowrap;
    align-items: center;
  }

  .bars {
    position: relative;
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    flex-wrap: nowrap;
    width: 100%;
    margin-top: 5px;
    margin-right: 100px;
  }

  .desc {
    position: absolute;
    font-size: 14px;
    margin-left: 20px;
    top: 10px;
    color: grey;
    font-style: italic;
    white-space: nowrap;
  }
  @media only screen and (max-width: 850px) {
    .desc {
      top: -30px;
      left: 100px !important;
      /* display: none; */
    }
    .row {
      flex-wrap: wrap;
    }
    .bars {
      margin-top: 10px;
      margin-right: 10px;
    }
  }

  .ratio {
    margin-top: 1rem;
    margin-bottom: 3rem;
  }
  .name {
    font-size: 20px;
    font-weight: bold;
    margin-left: 2rem;
    margin-right: 0.2rem;
    width: 80px;
    color: grey;
  }
  .col {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }
  .one {
    background-color: #6d87a5;
    z-index: 3;
    border-radius: 5px 0px 0px 5px;
  }
  .plus {
    background-color: #946da5;
    border-radius: 5px 5px 5px 5px;
    position: absolute;
    left: 0px;
    z-index: 1;
  }
</style>
