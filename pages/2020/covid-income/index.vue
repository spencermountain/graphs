<script setup>
import colors from '~/assets/colors.js'
import layout from './circle.js'

definePageMeta({
  title: 'Income by demographic in Canada, during Covid-19',
  description: 'CERB, CPP/OAS and the Child Benefit, drawn as circle arcs against salary levels',
})

const title = 'Income by demographic in Canada, during Covid-19'

// arcs + rings, in the same paint-order as the 2020 post ({from,to} in degrees, radius/width in $k)
const arcs = [
  { from: 90, to: 181, radius: 5, width: 8, color: 'blue' }, // child benefit
  { from: 181, to: 270, radius: 5, width: 18, color: 'red' }, // CERB
  { from: 18, to: 90, radius: 2, width: 23, color: 'purple' }, // CPP/OAS
  { from: 180, to: 450, radius: 20, width: 0.5, color: 'green' }, // poverty line
  { from: 360, to: 0, radius: 50, width: 0.2, color: 'pink' }, // mean salary ring
  // r-axis rings
  { from: 360, to: 0, radius: 0, width: 0.1, color: 'lighter' },
  { from: 360, to: 0, radius: 10, width: 0.1, color: 'lighter' },
  { from: 360, to: 0, radius: 20, width: 0.1, color: 'lighter' },
  { from: 360, to: 0, radius: 30, width: 0.1, color: 'lighter' },
  { from: 360, to: 0, radius: 40, width: 0.1, color: 'lighter' },
  { from: 360, to: 0, radius: 60, width: 0.1, color: 'lighter' },
  { from: 360, to: 0, radius: 70, width: 0.1, color: 'lighter' },
  { from: 360, to: 0, radius: 80, width: 0.1, color: 'lighter' },
  // salaries, by decile
  { from: 270, to: 280, radius: 20, width: 1, color: 'sky' },
  { from: 280, to: 290, radius: 30, width: 1, color: 'sky' },
  { from: 290, to: 300, radius: 40, width: 1, color: 'sky' },
  { from: 300, to: 310, radius: 50, width: 1, color: 'sky' },
  { from: 310, to: 320, radius: 50, width: 1, color: 'sky' },
  { from: 320, to: 330, radius: 50, width: 1, color: 'sky' },
  { from: 330, to: 340, radius: 50, width: 1, color: 'sky' },
  { from: 340, to: 350, radius: 60, width: 1, color: 'sky' },
  { from: 350, to: 360, radius: 70, width: 1, color: 'sky' },
  { from: 360, to: 370, radius: 80, width: 1, color: 'sky' },
]

// labels ('at' = angle in degrees; size/align defaults match the old lib)
const labels = [
  { text: 'Child Benefit', at: 150, radius: 14, align: 'middle', color: 'blue', size: 1.5 },
  { text: 'CERB', at: 220, radius: 28, align: 'middle', color: 'red', size: 2.5 },
  { text: 'CPP/', at: 50, radius: 36, align: 'left', color: 'purple', size: 2 },
  { text: 'OAS', at: 42.5, radius: 36, align: 'left', color: 'purple', size: 2 },
  { text: 'poverty line', at: 5, radius: 22, align: 'right', color: 'green' },
  { text: 'mean', at: 142, radius: 51.5, align: 'right', color: 'pink' },
  { text: 'salary', at: 145, radius: 51.5, align: 'right', color: 'pink' },
  { text: '50k', at: 148, radius: 51.5, align: 'right', color: 'pink', size: 1.6 },
  { text: '30k', at: 135, radius: 35.5, color: 'lighter' },
  { text: '40k', at: 135, radius: 45.5, color: 'lighter' },
  { text: '60k', at: 135, radius: 65.5, color: 'lighter' },
  { text: '70k', at: 135, radius: 75.5, color: 'lighter' },
  { text: '80k', at: 135, radius: 85.5, color: 'lighter' },
]

// static graphic — compute the shapes once, like the old <Round rotate="0" margin="10">
const named = (o) => ({ ...o, angle: o.at, color: colors[o.color] || o.color })
const shapes = layout(arcs.map(named), labels.map(named), { rotate: 0, margin: 10 })
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <a href="/" class="link text-sm text-gray-400 self-start">〱 graphs</a>
    <h1>{{ title }}</h1>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-2xl mt-4">
      <svg viewBox="-50 -50 100 100" shape-rendering="geometricPrecision" class="w-full h-auto">
        <template v-for="(o, i) in shapes" :key="i">
          <path v-if="o.type === 'arc'" class="arc" :d="o.path" stroke="none" :fill="o.color" :stroke-width="1" />
          <text v-else :x="o.x" :y="o.y" :transform="`rotate(${o.angle},${o.x},${o.y})`" :font-size="o.size"
            :text-anchor="o.align" :fill="o.color">{{ o.text }}</text>
        </template>
      </svg>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
/* hover-shadow on arcs, from the original somehow-circle */
.arc {
  pointer-events: all;
}

.arc:hover {
  filter: drop-shadow(0px 1px 1px steelblue);
}
</style>
