<script setup>
import { ref, computed, onMounted } from 'vue'
import Chart from './Chart.vue'
import { growth, rules, players, teams } from './charts.js'

definePageMeta({ title: 'History of the NHL', description: 'league expansion, lockouts, players and teams since 1942' })

// every x-axis runs from 1942 to "now" — fixed placeholder for prerender, real value on mount
const today = ref(Date.UTC(2026, 6, 10))
onMounted(() => {
  today.value = Date.now()
})

const charts = computed(() => ({
  growth: growth(today.value),
  rules: rules(today.value),
  players: players(today.value),
  teams: teams(today.value),
}))
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1>History of the NHL</h1>
      <div class="text-gray-400 ml-4">expansion, rule-changes, star players and teams — 1942 to today</div>
    </div>

    <!-- the four stacked timelines, all sharing the same 1942→today x-axis -->
    <div class="bg-white rounded-xl shadow-md p-6 mt-6 w-full max-w-[1000px] overflow-x-auto">
      <div class="col-left min-w-[900px]">
        <div class="m-8">
          <Chart :world="charts.growth" />
        </div>
        <div class="m-8 mt-24">
          <Chart :world="charts.rules" />
        </div>
        <div class="m-8 mt-24">
          <Chart :world="charts.players" />
        </div>
        <div class="m-8 mt-24">
          <Chart :world="charts.teams" />
        </div>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://github.com/spencermountain/thensome">source</a>
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>
