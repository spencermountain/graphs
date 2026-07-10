<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import spacetime from 'spacetime'
import getYear from './getYear.js'

definePageMeta({ title: 'Timezone offsets by date', description: 'each timezone sliding between its winter and summer UTC offset' })

// tunables
const stepDays = 10 // days added per animation tick
const startMs = 500 // initial tick speed
const resumeMs = 200 // speed after un-pausing (matches the original)

// current date — fixed for SSR, swapped to this year on mount
const s = ref(spacetime('January 1, 2023'))

// dst-observing zones, with spring/fall change-points for the current year
const dots = computed(() => getYear(s.value.year()))

// a very-tiny linear scale: offset hours (-14..14) → percent (0..100)
const scale = (num) => parseInt(((num + 14) / 28) * 100, 10)

// playback loop
let interval = null
const play = (ms) => {
  interval = setInterval(() => {
    s.value = s.value.add(stepDays, 'days')
  }, ms)
}
onMounted(() => {
  s.value = spacetime.now().startOf('year')
  play(startMs)
})
onUnmounted(() => clearInterval(interval))

const pause = function () {
  if (interval) {
    clearInterval(interval)
    interval = null
  } else {
    play(resumeMs)
  }
}
const reset = function () {
  s.value = spacetime.now().startOf('year')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start w-full max-w-5xl mx-auto">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-xl font-semibold text-gray-700 mt-2">Timezone offsets by date</h1>
    </div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 mt-4 w-full max-w-5xl col items-stretch">
      <!-- playback controls -->
      <div class="row-right mr-12">
        <button class="ctrl" @click="reset">🔙</button>
        <span class="year">{{ s.format('{month-short} {date-ordinal} {year}') }}</span>
        <button class="ctrl" @click="pause">⏸️</button>
      </div>

      <div class="box col">
        <!-- axis labels -->
        <div class="row w-full" style="margin-bottom: 3rem">
          <div class="name"></div>
          <div class="line">
            <div class="hr" style="position: absolute; left: -5%">-14h</div>
            <div class="hr" style="position: absolute; left: 95%">+14h</div>
          </div>
        </div>

        <!-- one row per timezone -->
        <div v-for="dot in dots" :key="dot.tz" class="row w-full">
          <div class="name">{{ dot.name }}</div>
          <div class="line">
            <div class="track"></div>
            <!-- span between winter + summer offsets -->
            <div class="inside" :title="dot.name" :style="{
              left: scale(dot.start.offset) + '%',
              width: scale(dot.end.offset) - scale(dot.start.offset) + '%',
            }"></div>
            <div class="dot end" :title="dot.name" :style="{ left: scale(dot.start.offset) + '%' }"></div>
            <div class="dot end" :title="dot.name" :style="{ left: scale(dot.end.offset) + '%' }"></div>
            <!-- current offset, before/after the spring change -->
            <div class="dot" :title="dot.name"
              :style="{ left: scale(s.epoch <= dot.start.epoch ? dot.start.offset : dot.end.offset) + '%' }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
.year {
  font-size: 1.5rem;
  margin: 1rem;
  width: 180px;
}

.ctrl {
  font-size: 1.4rem;
  height: 40px;
  margin: 0.5rem;
}

.box {
  margin: 3rem;
  margin-top: 1rem;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
  border-radius: 5px;
  padding: 3rem;
}

.name {
  width: 150px;
}

.hr {
  font-size: 1.5rem;
}

.line {
  z-index: 3;
  position: relative;
  flex-grow: 1;
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
  height: 20px;
}

.track {
  height: 3px;
  top: 9px;
  border-radius: 3px;
  box-shadow: 1px 1px 8px 0px rgba(0, 0, 0, 0.1);
  position: absolute;
  background-color: lightgrey;
  width: 100%;
}

.dot {
  width: 20px;
  height: 20px;
  background-color: steelblue;
  border-radius: 50%;
  position: absolute;
  top: 0px;
}

.end {
  background-color: #d6e0ec;
}

.inside {
  height: 20px;
  position: absolute;
  margin-left: 10px;
  top: 0px;
  background-color: #d6e0ec;
}
</style>
