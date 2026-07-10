<script setup>
import fmt from './fmt.js'

defineProps({
  yScale: { type: Function, required: true },
  ticks: { type: Array, default: () => [] },
})
</script>

<template>
  <div class="left">
    <!-- each tick shows the per-term increment -->
    <div v-for="(n, i) in ticks" :key="n" class="tick" :style="{ bottom: yScale(n) + '%' }">
      +{{ fmt(n - (ticks[i - 1] || 0)) }}
    </div>
  </div>
</template>

<style scoped>
.left {
  position: absolute;
  top: 0px;
  height: 100%;
  width: 40px;
  left: -45px;
  padding-right: 5px;
  border-right: 1px solid lightgrey;
  text-align: right;
}
.tick {
  text-align: right;
  width: 35px;
  position: absolute;
  color: grey;
  font-size: 14px;
  height: 16px;
  margin-top: -16px;
}
</style>
