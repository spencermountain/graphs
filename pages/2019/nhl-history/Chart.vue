<script setup>
// generic renderer for a built somehow world — a flat list of svg primitives
defineProps({ world: { type: Object, required: true } })
</script>

<template>
  <svg :width="world.width" :height="world.height" :viewBox="`0,0,${world.width},${world.height}`"
    preserveAspectRatio="xMidYMid meet" style="overflow: visible; margin: 10px 20px 25px 25px">
    <template v-for="(el, i) in world.els" :key="i">
      <line v-if="el.type === 'line'" v-bind="el.attrs" />
      <rect v-else-if="el.type === 'rect'" v-bind="el.attrs" />
      <path v-else-if="el.type === 'path'" v-bind="el.attrs" />
      <!-- axis tick label -->
      <text v-else-if="el.type === 'tick'" :x="el.x" :y="el.y" :text-anchor="el.anchor" fill="#d7d5d2"
        style="font-size: 12px">{{ el.label }}</text>
      <!-- multi-line text block, optionally underlined (annotations) -->
      <g v-else-if="el.type === 'text'" :transform="`translate(${el.x} ${el.y})`">
        <text :text-anchor="el.anchor || 'start'" :fill="el.fill"
          :style="el.fontSize ? `font-size:${el.fontSize}px` : null">
          <tspan v-for="(line, j) in el.lines" :key="j" x="0" dy="1.2em">{{ line }}</tspan>
        </text>
        <line v-if="el.underline" x1="-2" :y1="el.underline.h" :x2="el.underline.w" :y2="el.underline.h"
          stroke="#838B91" stroke-width="1.5" />
      </g>
    </template>
  </svg>
</template>
