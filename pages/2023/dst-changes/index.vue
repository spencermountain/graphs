<script setup>
import { ref, computed } from 'vue'
import getYear from './build.js'

definePageMeta({ title: 'DST changes by year', description: 'daylight-saving start and end, for each timezone' })

const year = ref(2023)
const dots = computed(() => getYear(year.value))
const yearStart = computed(() => Date.UTC(year.value, 0, 1))
const yearEnd = computed(() => Date.UTC(year.value, 11, 31, 11, 59))

// a very-tiny linear scale: epoch → percent across the year
const scale = (num) => {
  let range = yearEnd.value - yearStart.value
  return parseInt(((num - yearStart.value) / range) * 100, 10)
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4">
    <div class="max-w-5xl w-full mx-auto mb-4">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-2xl font-semibold text-gray-700 mt-2">DST changes by year</h1>
    </div>

    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-5xl mx-auto flex flex-col">
      <!-- year nav -->
      <div class="rightSide">
        <button @click="year -= 1">←</button>
        <span class="year">{{ year }}</span>
        <button @click="year += 1">→</button>
      </div>

      <!-- one row per timezone: track across the year, dot at dst start + end -->
      <div class="box">
        <div v-for="dot in dots" :key="dot.tz" class="tzRow" style="width:100%;">
          <div class="name">{{ dot.name }}</div>
          <div class="line">
            <div class="track" />
            <div class="inside" :title="dot.name" :style="{
              left: scale(dot.start.epoch) + '%',
              width: (scale(dot.end.epoch) - scale(dot.start.epoch)) + '%',
            }" />
            <div class="dot" :title="dot.name" :style="{ left: scale(dot.start.epoch) + '%' }" />
            <div class="dot end" :title="dot.name" :style="{ left: scale(dot.end.epoch) + '%' }" />
          </div>
        </div>
      </div>
    </div>

    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
/* tunable colors, from the original post */
/* start dot: #4386cc | end dot: steelblue | dst span: #d6e0ec */
.name {
  width: 150px;
}

.rightSide {
  justify-content: flex-end;
  display: flex;
  margin-right: 3rem;
  align-items: center;
}

.year {
  font-size: 2.5rem;
  margin: 1rem;
}

button {
  font-size: 1.4rem;
  height: 40px;
  padding: 0 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #f9fafb;
}

.box {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 3rem;
  margin-top: 1rem;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
  border-radius: 5px;
  padding: 3rem;
}

.tzRow {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  text-align: center;
  flex-wrap: nowrap;
  align-self: stretch;
}

.dot {
  width: 20px;
  height: 20px;
  background-color: #4386cc;
  border-radius: 50%;
  position: absolute;
  top: 0px;
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

.end {
  background-color: steelblue;
}

.inside {
  height: 20px;
  position: absolute;
  margin-left: 10px;
  top: 0px;
  background-color: #d6e0ec;
}

.line {
  z-index: 3;
  position: relative;
  flex-grow: 1;
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
  height: 20px;
}
</style>
