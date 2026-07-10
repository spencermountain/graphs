<script setup>
import { computed } from 'vue'
import spacetime from 'spacetime'
import Month from './Month.vue'

// ported from somehow-calendar Quarter.svelte — three months, side by side
const props = defineProps({
  date: { type: String, required: true },
  tops: { type: Object, default: () => ({}) },
  bottoms: { type: Object, default: () => ({}) },
  isHome: { type: Object, default: () => ({}) },
})

const months = computed(() => {
  let start = spacetime(props.date).startOf('quarter')
  return [start, start.add(1, 'month').startOf('month'), start.add(2, 'month').startOf('month')]
})
</script>

<template>
  <div class="months">
    <div v-for="(m, i) in months" :key="i" class="gap">
      <Month :date="m" :tops="tops" :bottoms="bottoms" :is-home="isHome" />
    </div>
  </div>
</template>

<style scoped>
.months {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: flex-start;
  text-align: center;
  flex-wrap: nowrap;
  align-self: stretch;
}

.gap {
  margin: 10px;
  flex: 1;
  width: 100%;
}

@media only screen and (max-width: 340px) {
  .months {
    flex-direction: column;
    margin-left: 0px;
    margin-right: 20px;
  }
}
</style>
