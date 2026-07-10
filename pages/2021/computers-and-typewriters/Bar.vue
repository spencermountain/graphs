<script setup>
// port of somehow-timeline Label.svelte (2021 build) — a vertical bar with a rotated label
import { computed } from 'vue'
import colors from '~/assets/colors.js'
import { scale } from './config.js'

const props = defineProps({
  start: String,
  end: String,
  label: { type: String, default: '' },
  topLabel: { type: String, default: '' },
  color: { type: String, default: 'steelblue' },
  dodge: { type: String, default: '0px' }, // left offset within the column
  size: { type: String, default: '0.8rem' },
  opacity: { type: String, default: '0.7' },
  align: { type: String, default: 'right' }, // which side of the bar the label sits on
})

const margin = 2
const hex = computed(() => colors[props.color] || props.color) // named colors fall through to css keywords
const top = computed(() => scale(props.start))
const height = computed(() => scale(props.end) - top.value)
</script>

<template>
  <div class="bar" :style="{ opacity, top: top + margin + 'px', left: dodge, height: height - margin * 2 + 'px' }">
    <div v-if="topLabel" class="top" :style="{ color: hex, fontSize: size }">{{ topLabel }}</div>
    <div class="line" :style="{ backgroundColor: hex }"></div>
    <div class="tag" :class="{ left: align === 'left' }" :style="{ color: hex, fontSize: size }">{{ label }}</div>
  </div>
</template>

<style scoped>
.bar {
  position: absolute;
  width: 150px;
  border-radius: 5px;
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  text-align: left;
}
.line {
  height: 100%;
  width: 25px;
  cursor: default;
  border-radius: 3px;
  z-index: 1;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
}
.line:hover {
  opacity: 1;
  box-shadow: 2px 2px 8px 0px steelblue;
}
/* label sits at the bottom of the bar, rotated to read upward */
.tag {
  position: absolute;
  bottom: 0px;
  margin-left: 0.8rem;
  width: 50px;
  height: 20px;
  transform: rotate(270deg);
  white-space: nowrap;
}
.tag.left {
  left: -50px;
}
.top {
  position: absolute;
  top: -1.2rem;
  width: 100%;
}
</style>
