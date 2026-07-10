<script setup>
import { ref, computed, onMounted } from 'vue'
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'

definePageMeta({ title: 'The Year in Toronto', description: 'sports, festivals, and weather through the year' })

// tunables — same values as the original somehow-timeline post
const height = 900 // px
const margin = 2 // px trimmed from each bar end

// the original used the current year — set on mount for ssr-safety
const year = ref(2026)
const now = ref(null) // today's epoch, for the dashed line
onMounted(() => {
  year.value = new Date().getFullYear()
  now.value = Date.now()
})

// everything re-computes if the year flips
const view = computed(() => {
  const yr = year.value
  const start = spacetime(`Dec 20 ${yr - 1}`)
  const end = spacetime(`Dec 31 ${yr}`)
  // tiny linear scale ported from somehow-timeline: epoch → y px (truncated, like the original)
  const scale = (epoch) => parseInt(((epoch - start.epoch) / (end.epoch - start.epoch)) * height, 10)

  // month ticks down the left side (<Ticks every="month"/>)
  const ticks = start.minus(1, 'second').every('month', end)
    .map((s) => ({ label: s.format('{month-short}'), top: scale(s.epoch) }))

  // narrow pill with a rotated label beside it (<Label/>)
  const pill = (label, from, to, color, left = false) => {
    const a = scale(spacetime(`${from} ${yr}`).epoch)
    const b = scale(spacetime(`${to} ${yr}`).epoch)
    return { kind: 'pill', label, color, top: a + margin, height: b - a - margin * 2, left }
  }
  // full-width bar; white label on the bar, or a small colored one when short (<Line/>)
  const bar = (label, from, to, color) => {
    const a = scale(spacetime(`${from} ${yr}`).epoch)
    const b = scale(spacetime(`${to} ${yr}`).epoch)
    return { kind: 'bar', label, color, top: a + margin, height: b - a - margin * 2, mid: b - a > 20 }
  }
  // short event given as a duration (<Line duration="7 days"/>)
  const fest = (label, from, days, color) => {
    const s = spacetime(`${from} ${yr}`)
    const a = scale(s.epoch)
    const b = scale(s.add(days, 'day').epoch)
    return { kind: 'bar', label, color, top: a + margin, height: b - a - margin * 2, mid: b - a > 20 }
  }

  // same columns as the original Post.svelte
  const columns = [
    // hockey
    { width: 60, items: [pill('Leafs', 'Jan 1', 'April 6', colors.navy), pill('Leafs', 'October 3', 'Dec 31', colors.navy)] },
    // baseball — 'lightblue' wasn't in the palette; the old lib fell back to the css color
    { width: 60, items: [pill('Blue Jays', 'March 29', 'Oct 1', 'lightblue')] },
    // basketball
    { width: 80, items: [pill('Raptors', 'Jan 1', 'April 10', colors.red), pill('Raptors', 'October 16', 'Dec 31', colors.red)] },
    // mls
    { width: 60, items: [pill('TFC', 'March 3', 'Dec 1', colors.tulip)] },
    { width: 80, items: [pill('Patios', 'April 20', 'Sept 10', colors.slate, true)] },
    // festivals
    {
      width: 125,
      items: [
        fest('Pride', 'June 14', 7, colors.rose),
        fest('Fringe', 'July 14', 7, colors.rose),
        fest('CNE', 'August 20', 7, colors.rose),
        fest('TIFF', 'Sept 14', 7, colors.rose),
        fest('Nuit-blanche', 'Oct 14', 2, colors.orange),
      ],
    },
    // weather
    {
      width: 60,
      items: [
        bar('Snow', 'Jan 1', 'Feb 10', colors.lighter),
        bar('Snow', 'Dec 10', 'Dec 31', colors.lighter),
        bar('Leaves', 'May 5', 'Oct 1', colors.green),
        bar('Fall', 'Oct 5', 'Oct 25', colors.beige),
      ],
    },
    // clothes
    {
      width: 60,
      items: [
        bar('Coats', 'Jan 1', 'April 12', colors.blue),
        bar('Coats', 'Nov 1', 'Dec 31', colors.blue),
        bar('Shorts', 'May 24', 'Sept 1', colors.purple),
      ],
    },
  ]

  return { ticks, columns, nowTop: now.value === null ? null : scale(now.value) }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <div class="w-full max-w-4xl">
      <!-- header -->
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-2xl font-light text-gray-700 mt-2 mb-4">The Year in Toronto</h1>

      <!-- the graphic -->
      <div class="bg-white rounded-xl shadow-md p-6 overflow-x-auto">
        <div class="timeline" :style="{ height: height + 'px' }">
          <!-- today's dashed line (<Now/>) -->
          <div v-if="view.nowTop !== null" class="nowline" :style="{ top: view.nowTop + 'px' }"></div>

          <!-- month ticks -->
          <div class="tcol" style="min-width: 65px; max-width: 65px">
            <div class="ticks">
              <div v-for="t in view.ticks" :key="t.label" class="tick" :style="{ top: t.top + 'px' }">{{ t.label }}
              </div>
            </div>
          </div>

          <!-- one column per activity -->
          <div v-for="(c, ci) in view.columns" :key="ci" class="tcol"
            :style="{ minWidth: c.width + 'px', maxWidth: c.width + 'px' }">
            <template v-for="(it, ii) in c.items" :key="ii">
              <!-- narrow pill + rotated side-label -->
              <div v-if="it.kind === 'pill'" class="pillbox" :style="{ top: it.top + 'px', height: it.height + 'px' }">
                <div class="pill" :style="{ backgroundColor: it.color }"></div>
                <div class="vlabel" :class="{ 'on-left': it.left }" :style="{ color: it.color }">{{ it.label }}</div>
              </div>
              <!-- full-width bar -->
              <div v-else class="barbox" :style="{ top: it.top + 'px', height: it.height + 'px' }">
                <div v-if="it.mid" class="midlabel">{{ it.label }}</div>
                <div v-else class="toplabel" :style="{ color: it.color }">{{ it.label }}</div>
                <div class="barline" :style="{ backgroundColor: it.color }"></div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- footer -->
      <div class="mt-8 text-sm text-gray-400 row-center gap-4">
        <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* layout ported from somehow-timeline's Timeline/Ticks/Label/Line/Now svelte components */
.timeline {
  position: relative;
  display: flex;
  justify-content: space-around;
  text-align: center;
  margin: 1rem;
  min-width: 700px;
}

.tcol {
  flex: 1;
  position: relative;
}

/* month axis */
.ticks {
  position: relative;
  min-width: 40px;
}

.tick {
  position: absolute;
  padding: 0 4px;
  white-space: nowrap;
  text-align: left;
  height: 1.2rem;
  opacity: 0.6;
  transform: translate(0px, -8px);
  color: #838B91;
  /* colors.grey */
  font-size: 12px;
}

/* today's dashed line (<Now/>) */
.nowline {
  position: absolute;
  width: 100%;
  z-index: 0;
  border-bottom: 2px dashed #a3a5a5;
  /* colors.light */
}

/* narrow pill + rotated side-label (<Label/>) */
.pillbox {
  position: absolute;
  width: 150px;
  opacity: 0.7;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  text-align: left;
}

.pill {
  height: 100%;
  width: 25px;
  cursor: default;
  border-radius: 3px;
  z-index: 1;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
}

.pill:hover {
  box-shadow: 2px 2px 8px 0px steelblue;
}

.vlabel {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 50px;
  height: 20px;
  margin-left: 0.8rem;
  font-size: 0.8rem;
  transform: rotate(270deg);
  white-space: nowrap;
}

.vlabel.on-left {
  left: -50px;
}

/* full-width bar (<Line/>) */
.barbox {
  position: absolute;
  width: 100%;
  opacity: 0.7;
  display: flex;
  justify-content: space-around;
  align-items: center;
  text-align: center;
  flex-wrap: wrap;
}

.barline {
  height: 100%;
  width: 100%;
  cursor: default;
  border-radius: 3px;
  z-index: 1;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
}

.barline:hover {
  box-shadow: 2px 2px 8px 0px steelblue;
}

.midlabel {
  position: absolute;
  z-index: 3;
  color: #fbfbfb;
  font-size: 12px;
  line-height: 1.2rem;
  white-space: nowrap;
}

.toplabel {
  width: 100%;
  position: relative;
  white-space: nowrap;
  z-index: 4;
  font-size: 11px;
}

@media only screen and (max-width: 600px) {
  .midlabel {
    font-size: 11px;
  }
}
</style>
