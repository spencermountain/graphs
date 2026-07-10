<script setup>
import spacetime from 'spacetime'
import data from './data.js'
import scale from './scale.js'
import colors from '~/assets/colors.js'

definePageMeta({
  title: 'Toronto housing pipeline',
  description: 'building permits for multiplexes — application, permit, and construction',
})

// config — timeline window, election dates, colors
const START = '2006-11-13'
const END = '2023-01-01'
const elections = ['2010-10-25', '2014-10-27', '2018-10-22'] // toronto municipal elections
const terms = ['Miller #2', 'Ford', 'Tory #1', 'Tory #2']
const barColors = {
  wait: 'lightsteelblue', // application under review
  build: colors.blue, // permit issued → completed
  submitted: colors.greygreen, // tick at application date
  issued: colors.rose, // tick at issue date
}

const start = spacetime(START)
const end = spacetime(END)
// date string → 0-100 percent across the timeline
const xScale = (str) =>
  scale({ world: [0, 100], minmax: [start.epoch, end.epoch] }, spacetime(String(str)).epoch)

// one row per permit: wait bar (submitted → issued), build bar (issued → completed)
const rows = data
  .map((o) => {
    let submitted = xScale(o.start)
    let issued = xScale(o.issued)
    let done = xScale(o.completed)
    return {
      wait_start: submitted,
      wait_width: issued - submitted,
      build_start: issued,
      build_width: done - issued,
      done,
      units: o.units,
      address: o.address,
      completed: o.completed,
    }
  })
  .filter((o) => o.units > 4) // multiplexes only
  .sort((a, b) => b.done - a.done) // most-recently completed on top
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-2xl text-gray-700 mt-2">Toronto housing pipeline</h1>
      <div class="text-gray-400">each multiplex building permit, from application to completed construction</div>
    </div>

    <!-- card -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-[1600px] mt-6">
      <!-- legend -->
      <div class="row-center wholeLegend">
        <div class="lcol" style="width:12px; align-self:flex-end;">
          <div class="label">&nbsp;</div>
          <div class="legend" :style="{ width: '12px', borderRadius: '2px 0 0 2px', backgroundColor: barColors.submitted, alignSelf: 'flex-end' }"></div>
        </div>
        <div class="lcol">
          <div class="label">Application Process</div>
          <div class="legend" :style="{ backgroundColor: barColors.wait }"></div>
          <div class="label sublabel" style="margin-left:-150px;">submitted</div>
        </div>
        <div class="lcol" style="width:12px; align-self:flex-end;">
          <div class="label">&nbsp;</div>
          <div class="legend" :style="{ width: '12px', backgroundColor: barColors.issued, alignSelf: 'flex-end' }"></div>
          <div class="label sublabel">issued</div>
        </div>
        <div class="lcol" style="align-self:flex-end;">
          <div class="label">Building</div>
          <div class="legend" :style="{ borderRadius: '0 2px 2px 0', backgroundColor: barColors.build }"></div>
        </div>
      </div>

      <!-- graph -->
      <div class="graph col">
        <div class="row-right w-full" style="margin-right:20px;">
          <h4 class="text-right font-semibold" style="color:grey;">Multiplexes completed<br /> during this term ↓</h4>
        </div>
        <div style="margin:0.75rem;"></div>
        <div v-for="(o, i) in rows" :key="i" class="lines">
          <div class="bar" :style="{ left: o.wait_start + '%', width: o.wait_width + '%', backgroundColor: barColors.wait }"></div>
          <div class="bar" :style="{ left: o.wait_start + '%', width: '0.65%', backgroundColor: barColors.submitted, borderRadius: '2px' }"></div>
          <div class="bar" :style="{ left: o.build_start + '%', width: o.build_width + '%', backgroundColor: barColors.build, borderRadius: '0 2px 2px 0' }"
            :title="o.address + ' — ' + o.completed"></div>
          <div class="bar" :style="{ left: o.build_start + '%', width: '0.5%', backgroundColor: barColors.issued, borderRadius: '2px' }"></div>
        </div>
        <!-- dashed election-day lines -->
        <div v-for="e in elections" :key="e" class="election" :style="{ left: xScale(e) + '%' }"></div>
        <div style="margin:0.75rem;"></div>
      </div>

      <!-- mayoral terms -->
      <div class="row termRow">
        <div v-for="t in terms" :key="t" class="term">{{ t }}</div>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
/* legend */
.wholeLegend {
  position: relative;
  margin-left: 3rem;
  margin-bottom: 3rem;
  margin-top: 1rem;
}
.lcol {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  align-items: center;
  text-align: center;
  align-self: stretch;
}
.label {
  color: grey;
  margin-bottom: 0.4rem;
  line-height: 18px;
}
.sublabel {
  position: absolute;
  bottom: -29px;
  font-size: 11px;
}
.legend {
  width: 100%;
  min-width: 10px;
  height: 8px;
}

/* graph */
.graph {
  margin-left: 5%;
  margin-right: 5%;
  position: relative;
  overflow: clip; /* some applications start before 2006 */
}
.lines {
  position: relative;
  min-height: 5px;
  margin-top: 1px;
  align-self: stretch; /* full width, so the % bars line up */
}
.bar {
  min-height: 6px;
  position: absolute;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
}
.election {
  height: 95%;
  bottom: 1%;
  border-left: 2px dashed darkgrey;
  width: 10px;
  position: absolute;
}

/* term labels */
.termRow {
  margin-left: 5%;
  margin-right: 5%;
  margin-bottom: 2rem;
}
.term {
  color: grey;
  padding: 1rem 0.3rem 0.3rem;
  font-size: 15px;
  line-height: 15px;
  font-weight: 100;
  flex: 1;
  margin: 1rem 5px 5px;
  height: 20px;
  text-align: center;
  border-top: 3px solid lightgrey;
}

@media only screen and (max-width: 600px) {
  .graph {
    margin-left: 2.5%;
    margin-right: 2.5%;
  }
  .wholeLegend {
    margin-left: 0px;
  }
}
</style>
