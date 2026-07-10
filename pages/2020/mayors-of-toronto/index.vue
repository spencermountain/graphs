<script setup>
import { ref, computed, onMounted } from 'vue'
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'
import mayors from './data.js'

definePageMeta({ title: 'Mayors of Toronto', description: 'every mayor since 1834' })

// tunables — same values as the original somehow-timeline post
const height = 4500 // px
const start = spacetime('Jan 1 1834')
const end = spacetime('Dec 31 2026')
const margin = 2 // px gap between stacked pills

// spencer-color 'dupont' combo — mayor pills cycle through it
const dupont = [colors.green, colors.brown, colors.orange, colors.red, colors.olive, colors.blue]

// tiny linear scale ported from somehow-timeline: epoch → y px (truncated, like the original)
const scale = (epoch) => parseInt(((epoch - start.epoch) / (end.epoch - start.epoch)) * height, 10)

// axis ticks — years ending in 00 get underlined
const ticksEvery = (unit) =>
  start.minus(1, 'second').every(unit, end).map((s) => {
    const label = s.format('year')
    return { label, top: scale(s.epoch), underline: /00$/.test(label) }
  })
const decades = ticksEvery('decade')
const years = ticksEvery('year')

// narrow pill with a vertical label beside it (somehow-timeline <Label/>)
const pill = (label, from, to, color, opts = {}) => {
  const a = scale(spacetime(from).epoch)
  const b = scale(spacetime(to).epoch)
  return {
    kind: 'pill', label, color, top: a + margin, height: b - a - margin * 2,
    size: opts.size || '0.8rem', opacity: opts.opacity ?? 0.7, left: opts.left || false,
  }
}

// full-width bar; white label on the bar, or a tiny colored one when the bar is short (<Line/>)
const bar = (label, from, to, color) => {
  const a = scale(spacetime(from).epoch)
  const b = scale(spacetime(to).epoch)
  return { kind: 'bar', label, color, top: a + margin, height: b - a - margin * 2, mid: b - a > 20 }
}

// underlined single-date marker (<WideLabel/>)
const wide = (label, date) => ({ kind: 'wide', label, top: scale(spacetime(date).epoch) })

// world wars
const wars = [
  pill('WW1', '28 July 1914', '11 November 1918', colors.rose, { size: '10px', opacity: 0.5 }),
  pill('WW2', 'September 13 1939', 'September 2 1945', colors.rose, { size: '10px', opacity: 0.5 }),
]

// the sitting mayor's pill runs to 'now', like the original — set on mount for ssr-safety
const now = ref(end.epoch)
onMounted(() => (now.value = Date.now()))

// one pill per mayor: each term ends where the next begins; shown names alternate sides
const mayorPills = computed(() =>
  mayors.map((m, i) => {
    const next = (mayors[i + 1] || {}).start
    const a = scale(spacetime(m.start).epoch)
    const b = scale(next ? spacetime(next).epoch : now.value)
    return {
      name: m.name, label: m.show ? m.name : '', top: a + margin,
      height: b - a - margin * 2, color: dupont[i % 6], left: i % 2 === 1,
    }
  })
)

// subways, highways, airport terminals + landmark buildings — same columns as the original
const eventCols = [
  {
    width: 60,
    items: [
      bar('Line 1', 'September 8, 1949', 'March 30, 1954', '#d7d072'),
      bar('Gardiner', 'Jan 1 1955', 'August 1960', colors.grey),
    ],
  },
  {
    width: 50,
    items: [
      bar('Line 2', 'September 5, 1958', 'February 26, 1966', colors.green),
      bar('Line 3', 'June 16, 1981', 'March 22, 1985', colors.sky),
      bar('401', 'July 1 1952', 'August 1956', colors.grey),
    ],
  },
  {
    width: 50,
    items: [
      pill('Pearson #1', 'October 3, 1957', 'February 28, 1964', colors.purple),
      pill('Terminal 2', '1970', 'June 15, 1972', colors.purple),
      pill('Terminal 3', '1989', 'February 21 1991', colors.purple),
      pill('Crosstown', 'July 28, 2010', 'Dec 1 2023', colors.orange, { opacity: 0.5, left: true }),
    ],
  },
  {
    width: 50,
    items: [bar('DVP', 'July 1 1955', 'October 30, 1962', colors.grey)],
  },
  {
    width: 100,
    items: [
      pill('Finch West', 'April 1 2018', 'April 1 2023', colors.purple, { opacity: 0.5 }),
      wide('Confederation', 'July 1, 1867'),
      wide('amalgamation', 'Jan 1, 1998'),
      wide('electricity', 'Jan 1, 1908'),
      bar('(Old) City Hall', '1889', '1899', colors.rose),
      bar('Royal York Hotel', '1927', '1929', colors.rose),
      bar('Maple Leaf Gardens', 'May 30, 1931', 'November 12, 1931', colors.rose),
      bar('City Hall', 'November 7 1961', 'September 13 1965', colors.rose),
      bar('CN tower', 'August 20 1973', 'August 20 1976', colors.rose),
      bar('Skydome', 'October 3, 1986', 'June 3 1989', colors.rose),
    ],
  },
]
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <div class="w-full max-w-5xl">
      <!-- header -->
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-2xl font-light text-gray-700 mt-2 mb-4">Mayors of Toronto</h1>

      <!-- the graphic -->
      <div class="bg-white rounded-xl shadow-md p-6 overflow-x-auto">
        <div class="timeline" :style="{ height: height + 'px' }">
          <!-- decade axis -->
          <div class="tcol decades" style="min-width: 15px; max-width: 15px">
            <div class="ticks">
              <div v-for="t in decades" :key="t.label" class="tick" :class="{ underline: t.underline }"
                :style="{ top: t.top + 'px' }">{{ t.label }}</div>
            </div>
          </div>
          <!-- year axis -->
          <div class="tcol years" style="min-width: 15px; max-width: 15px">
            <div class="ticks">
              <div v-for="t in years" :key="t.label" class="tick" :class="{ underline: t.underline }"
                :style="{ top: t.top + 'px' }">{{ t.label }}</div>
            </div>
          </div>

          <!-- world wars -->
          <div class="tcol" style="min-width: 75px; max-width: 75px">
            <div v-for="w in wars" :key="w.label" class="pillbox"
              :style="{ top: w.top + 'px', height: w.height + 'px', opacity: w.opacity }">
              <div class="pill" :style="{ backgroundColor: w.color }"></div>
              <div class="vlabel" :style="{ color: w.color, fontSize: w.size }">{{ w.label }}</div>
            </div>
          </div>

          <!-- mayors -->
          <div class="tcol" style="min-width: 100px; max-width: 100px">
            <div v-for="(p, i) in mayorPills" :key="i" class="pillbox" :title="p.name"
              :style="{ top: p.top + 'px', height: p.height + 'px', opacity: 0.7 }">
              <div class="pill" :style="{ backgroundColor: p.color }"></div>
              <div class="vlabel" :class="{ 'on-left': p.left }" :style="{ color: p.color, fontSize: '14px' }">
                {{ p.label }}</div>
            </div>
          </div>

          <!-- city events -->
          <div v-for="(c, ci) in eventCols" :key="ci" class="tcol"
            :style="{ minWidth: c.width + 'px', maxWidth: c.width + 'px' }">
            <template v-for="(it, ii) in c.items" :key="ii">
              <!-- full-width bar -->
              <div v-if="it.kind === 'bar'" class="barbox"
                :style="{ top: it.top + 'px', height: it.height + 'px', opacity: 0.5 }">
                <div v-if="it.mid" class="midlabel">{{ it.label }}</div>
                <div v-else class="toplabel" :style="{ color: it.color }">{{ it.label }}</div>
                <div class="barline" :style="{ backgroundColor: it.color }"></div>
              </div>
              <!-- narrow pill -->
              <div v-else-if="it.kind === 'pill'" class="pillbox"
                :style="{ top: it.top + 'px', height: it.height + 'px', opacity: it.opacity }">
                <div class="pill" :style="{ backgroundColor: it.color }"></div>
                <div class="vlabel" :class="{ 'on-left': it.left }" :style="{ color: it.color, fontSize: it.size }">
                  {{ it.label }}</div>
              </div>
              <!-- underlined date marker -->
              <div v-else class="widelabel" :style="{ top: it.top + 'px' }">{{ it.label }}</div>
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
/* layout ported from somehow-timeline's Timeline/Column/Ticks/Label/Line/WideLabel svelte components */
.timeline {
  position: relative;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  text-align: center;
  margin: 1rem;
}

.tcol {
  flex: 1;
  position: relative;
  margin: 0 20px;
}

/* axis ticks */
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
}

.tick.underline {
  opacity: 1;
  border-bottom: 1px solid grey;
}

.decades .tick {
  color: #838B91;
  /* colors.grey */
  font-size: 12px;
}

.years .tick {
  color: #949a9e;
  /* colors.lightgrey */
  font-size: 8px;
}

/* narrow pill + rotated side-label (<Label/>) */
.pillbox {
  position: absolute;
  width: 150px;
  border-radius: 5px;
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
  border-radius: 5px;
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

/* underlined single-date marker (<WideLabel/>) */
.widelabel {
  position: absolute;
  width: 90%;
  left: 10%;
  min-height: 3px;
  font-size: 0.8rem;
  text-align: right;
  color: lightgrey;
  border-bottom: 1px solid lightgrey;
}

@media only screen and (max-width: 600px) {
  .tcol {
    margin: 0 5px;
  }

  .midlabel {
    font-size: 11px;
  }
}
</style>
