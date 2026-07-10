<script setup>
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'
import { bands, columns } from './data.js'

definePageMeta({ title: 'Toronto Construction Timeline', description: 'how long the big builds took' })

// timeline range + height, from the original Post.svelte
const start = spacetime('Jan 1 1910')
const end = spacetime('Dec 31 2024')
const height = 1600 // px
const trim = 2 // px shaved from each end of a bar

// date (or epoch) -> y px — somehow-timeline's tiny linear scale
const scale = (d) => Math.floor(((spacetime(d).epoch - start.epoch) / (end.epoch - start.epoch)) * height)

// named color, or raw hex
const named = (c) => colors[c] || c

// absolute-position style for one event
const box = (ev) => ({
  top: scale(ev.start) + trim + 'px',
  height: scale(ev.end) - scale(ev.start) - trim * 2 + 'px',
  opacity: ev.opacity,
})

// a tick each decade; centuries get underlined
const ticks = start
  .minus(1, 'second')
  .every('decade', end)
  .map((s) => ({
    y: scale(s.epoch),
    label: s.format('year'),
    underline: /00$/.test(String(s.format('year'))),
  }))
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <a href="/" class="link text-sm text-gray-400 self-start">〱 graphs</a>
    <h1>Toronto Construction Timeline</h1>
    <div class="text-gray-400 mb-4">how long the big builds took</div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-[1500px]">
      <div class="timeline" :style="{ height: height + 'px' }">
        <!-- war bands span the full width -->
        <div v-for="b in bands" :key="b.label" class="band" :style="box(b)">
          <div class="band-label">{{ b.label }}</div>
          <div class="band-line" :style="{ backgroundColor: named(b.color) }"></div>
          <!-- dot texture sits behind the solid band, same as the original build -->
          <svg v-if="b.dotted" class="band-dots" width="100%" height="100%">
            <defs>
              <pattern :id="`dots-${b.label}`" x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
                <circle :fill="named(b.color)" cx="3" cy="3" r="1.5" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" :fill="`url(#dots-${b.label})`" />
          </svg>
        </div>

        <!-- decade ticks -->
        <div class="part" style="min-width: 30px; max-width: 30px">
          <div v-for="t in ticks" :key="t.label" class="tick" :class="{ century: t.underline }"
            :style="{ top: t.y + 'px', color: colors.grey }">{{ t.label }}</div>
        </div>

        <!-- flexible spacer column, as in the original -->
        <div class="part"></div>

        <!-- one column of bars per theme -->
        <div v-for="(col, i) in columns" :key="i" class="part" style="min-width: 80px; max-width: 80px">
          <div v-for="ev in col" :key="ev.label" class="event" :style="box(ev)">
            <div class="bar" :style="{ backgroundColor: named(ev.color) }"></div>
            <div class="tag" :style="{ color: named(ev.color) }">{{ ev.label }}</div>
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
/* ported from somehow-timeline's Timeline.svelte */
.timeline {
  position: relative;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  flex-wrap: nowrap;
  text-align: center;
  margin: 1rem;
}

/* Column.svelte */
.part {
  flex: 1;
  position: relative;
  margin: 0 20px;
  min-height: 100%;
}

/* Line.svelte — full-width band with a centered white label */
.band {
  position: absolute;
  left: 0;
  width: 100%;
  border-radius: 5px;
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.band-label {
  position: absolute;
  z-index: 3;
  color: #fbfbfb;
}

.band-line {
  width: 100%;
  height: 100%;
  border-radius: 3px;
  z-index: 1;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
}

.band-dots {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  z-index: 0;
  background-color: white;
}

/* Ticks.svelte */
.tick {
  position: absolute;
  padding: 0 4px;
  white-space: nowrap;
  text-align: left;
  font-size: 12px;
  height: 1.2rem;
  opacity: 0.6;
  transform: translate(0px, -8px);
}

.century {
  opacity: 1;
  border-bottom: 1px solid grey;
}

/* Label.svelte — 25px bar with a rotated label anchored at its bottom */
.event {
  position: absolute;
  left: 0;
  width: 150px;
  border-radius: 5px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  text-align: left;
}

.bar {
  width: 25px;
  height: 100%;
  border-radius: 3px;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
}

.bar:hover,
.band-line:hover {
  box-shadow: 2px 2px 8px 0px steelblue;
}

.tag {
  position: absolute;
  left: 0;
  bottom: 0;
  margin-left: 0.8rem;
  width: 50px;
  height: 20px;
  font-size: 0.7rem;
  white-space: nowrap;
  transform: rotate(270deg);
}
</style>
