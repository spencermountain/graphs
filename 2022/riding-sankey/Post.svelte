<script>
  import { Page, Label } from '../../components/index.mjs'
  import { Sankey, Node, Col } from '/Users/spencer/mountain/somehow-sankey/src/index.mjs'
  import counts from './counts.js'
  let sum = counts.reduce((h, a) => {
    h += a.total
    return h
  }, 0)

  const colors = {
    'Spadina-Fort York': '#D68881',
    'Toronto Centre': '#6699cc',
    'University-Rosedale': '#cc6966',
    'Etobicoke-Lakeshore': '#2D85A8',
    "Toronto-St. Paul's": 'rgb(115, 121, 155)',
    'Parkdale-High Park': '#2D85A8',
    'Toronto-Danforth': '#73799B',
    Willowdale: '#585A73',
    'Eglinton-Lawrence': '#cc6966',
    Davenport: 'rgb(115, 121, 155)',

    'Don Valley North': '#cc8a66',
    'Etobicoke Centre': '#838B91',
    'Beaches-East York': '#735873',
    'York South-Weston': '#D68881',
    'York Centre': '#4D6899',
    'Don Valley West': '#D68881',
    'Scarborough Southwest': '#6699cc',
    'Don Valley East': 'rgb(115, 121, 155)',
    'Scarborough-Agincourt': '#2D85A8',
    'Etobicoke North': '#978BA3',
    'Scarborough-Rouge Park': '#cc6966',
    'Scarborough Centre': '#914045',
    'Scarborough-Guildwood': '#cc6966',
    'Humber River-Black Creek': '#AB5850',
    'Scarborough North': '#6699cc',
  }

  let fmt = (num) => {
    if (num > 1000) {
      num = Math.round(num / 1000) * 1000
      return String(num / 1000) + 'k'
    }
    return num
  }
  let title = 'Active housing applications by Toronto ward'
</script>

<Page {title}>
  <div class="center col">
    <div class="container">
      <Sankey height="700" {fmt}>
        <Col>
          <Node
            name="Housing Units"
            value={sum}
            color="#2D85A8"
            accent="#6699cc"
            show_num={false}
          />
        </Col>
        <Col>
          {#each counts as a, i}
            <Node
              name={a.name}
              stroke="#d7d5d2"
              from="Housing Units"
              value={a.total}
              label={'5%'}
              accent={colors[a.name]}
              color={colors[a.name]}
              after={i > 6}
              inline={i === 5 || i === 6}
              show_percent={i < 7}
              show_num={false}
              show_label={i < 4}
            />
          {/each}
        </Col>
      </Sankey>
      <!-- <Label start={'20%'} text="7 Wards<br/>75% of applications" /> -->
    </div>
  </div>
</Page>

<!-- <div class="source">
        <a href="https://open.toronto.ca/dataset/building-permits-active-permits/">
          Active permits
        </a>
        - toronto.ca, Oct 2022
      </div> -->
<style>
  .col {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .center {
    text-align: center;
    margin: 3rem;
  }
  .container {
    flex-grow: 1;
    margin-top: 3rem;
  }
</style>
