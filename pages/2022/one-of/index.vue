<script setup>
import { ref, computed } from 'vue'

definePageMeta({ title: 'One out of...', description: 'seeing 1-in-100 up to 1-in-a-million' })

// dropdown choices
const options = [
  { val: 100, label: '100' },
  { val: 1000, label: '1,000' },
  { val: 10000, label: '10,000' },
  { val: 100000, label: '100,000' },
  { val: 1000000, label: '1,000,000' },
]
const val = ref(100)

// 5x5 grid for 100, 10x10 after that
const grid = computed(() => (val.value === 100 ? 5 : 10))
const boxes = computed(() => val.value / (grid.value * grid.value))
const tiny = computed(() => boxes.value >= 10) // 150px boxes
const tinier = computed(() => boxes.value >= 100) // 70px boxes
const expand = computed(() => boxes.value > 100) // widen the wrapper

// filler boxes (all but the last); ~20% go lighter-blue at big counts
const plain = computed(() =>
  Array.from({ length: boxes.value - 1 }, () => boxes.value >= 1000 && Math.random() > 0.8)
)
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
    </div>
    <h1 class="text-xl font-semibold text-gray-700 mt-2">
      One out of
      <select v-model.number="val" class="picker">
        <option v-for="o in options" :key="o.val" :value="o.val">{{ o.label }}</option>
      </select>
    </h1>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 mt-6">
      <div class="all frow" :class="{ expand }">
        <div v-for="(light, i) in plain" :key="i" class="box" :class="{ tiny, tinier, light }" />
        <!-- the last box holds the grid, with the highlighted 'one' -->
        <div class="box fcol" :class="{ tiny, tinier }">
          <div v-for="r in grid" :key="r" class="frow">
            <div v-for="c in grid" :key="c" class="one" :class="{ square: tiny }" />
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
/* select styling from the original page */
.picker {
  font-size: 20px;
  color: grey;
  margin-left: 6px;
  border: 1px solid lightgrey;
}

.all {
  width: 400px;
}

.expand {
  width: 800px;
}

/* wrapping flex row (original '.row') — used for the box pile and each grid line */
.frow {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  text-align: center;
  flex-wrap: wrap;
  align-self: stretch;
  flex-grow: 1;
}

/* the 'one' — bottom-left cell of the gridded box */
.frow:last-child>.one:first-child {
  border-top: 1px solid #52d1dae6;
  border-right: 1px solid #52d1dae6;
  background-color: #2cc4cee6;
  box-shadow: 4px 4px 18px 2px rgba(0, 0, 0, 0.3);
  border-radius: 5px;
}

.light {
  background-color: #629edf !important;
}

.one {
  flex-grow: 1;
  height: 100%;
}

.square {
  border-radius: 2px !important;
}

.box {
  width: 300px;
  height: 300px;
  background-color: #438ee1;
  margin: 1rem;
  border-radius: 15px;
}

.tiny {
  width: 150px !important;
  height: 150px !important;
  margin: 5px !important;
  border-radius: 2px !important;
}

.tinier {
  width: 70px !important;
  height: 70px !important;
  margin: 5px !important;
  border-radius: 0px !important;
}

/* column layout for the gridded box (original '.col') */
.fcol {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  align-items: center;
  text-align: center;
  flex-wrap: wrap;
  align-self: stretch;
}
</style>
