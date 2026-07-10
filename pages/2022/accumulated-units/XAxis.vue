<script setup>
import spacetime from 'spacetime'

const props = defineProps({ xScale: { type: Function, required: true } })

// toronto municipal election days
const dates = ['13 November 2006', 'October 25, 2010', 'October 27, 2014', 'October 22, 2018', 'October 22, 2022']
const ticks = dates.map((str) => ({ left: props.xScale(str), year: spacetime(str).year() }))
</script>

<template>
  <div class="bottom">
    <div v-for="t in ticks" :key="t.year" class="tick" :style="{ left: t.left + '%', bottom: '0%' }">
      {{ t.year }}
    </div>
  </div>
</template>

<style scoped>
.bottom {
  height: 25px;
  left: 0px;
  width: 100%;
  position: absolute;
  bottom: -55px;
}
.tick {
  position: absolute;
  color: grey;
  font-size: 15px;
}
</style>
