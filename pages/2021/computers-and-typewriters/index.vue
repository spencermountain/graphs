<script setup>
import colors from '~/assets/colors.js'
import Bar from './Bar.vue'
import { HEIGHT, scale, typewriters, computers, companies, engelbart, region } from './config.js'

definePageMeta({ title: 'Typewriters and Computers', description: 'a timeline, 1900 to 2021' })

// decade tick marks — the '00 years get an underline
const ticks = []
for (let y = 1900; y <= 2020; y += 10) {
  ticks.push({ label: String(y), top: scale(String(y)), underline: /00$/.test(String(y)) })
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <a href="/" class="link text-sm text-gray-400 self-start">〱 graphs</a>
    <h1>Typewriters and Computers</h1>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 mt-4">
      <div style="min-width: 500px"></div>
      <div class="timeline" :style="{ height: HEIGHT + 'px' }">
        <!-- typewriters column -->
        <div class="column">
          <div class="head" :style="{ color: colors.sky }">Typewriters</div>
          <Bar v-for="b in typewriters" :key="b.label" v-bind="b" />
        </div>

        <!-- decade ticks -->
        <div class="column">
          <div class="ticks">
            <div v-for="t in ticks" :key="t.label" class="tick" :class="{ century: t.underline }"
              :style="{ top: t.top + 'px', color: colors.grey }">
              {{ t.label }}
            </div>
          </div>
        </div>

        <!-- computers column -->
        <div class="column">
          <div class="head" :style="{ color: colors.sky }">Computers</div>
          <Bar v-for="b in computers" :key="b.label" v-bind="b" />
          <Bar v-for="b in companies" :key="b.topLabel" v-bind="b" />
        </div>

        <!-- engelbart demo — horizontal marker across both columns -->
        <div class="wide" :style="{
          top: scale(engelbart.date) + 'px',
          width: engelbart.width,
          left: engelbart.left,
          color: colors.red,
          backgroundColor: colors.red,
        }">
          <div class="wide-label">{{ engelbart.label }}</div>
        </div>

        <!-- shaded mainframe-era region behind the ticks -->
        <div class="region" :style="{
          top: scale(region.start) + 'px',
          height: (scale(region.end) - scale(region.start)) + 'px',
          width: region.width,
          left: region.left,
          backgroundColor: colors.sky,
        }"></div>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
.timeline {
  position: relative;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  text-align: center;
  flex-wrap: nowrap;
  align-self: stretch;
  margin: 1rem;
}
.column {
  flex: 1;
  position: relative;
  margin: 0 20px;
}
@media only screen and (max-width: 600px) {
  .column {
    margin: 0 5px;
  }
}
/* column titles, at 1900 */
.head {
  position: absolute;
  top: 0px;
  min-width: 25px;
  font-size: 1rem;
  border-bottom: 1px solid steelblue;
}
.ticks {
  position: relative;
  min-width: 40px;
}
.tick {
  position: absolute;
  padding-left: 4px;
  padding-right: 4px;
  white-space: nowrap;
  text-align: left;
  font-size: 12px;
  height: 1.2rem;
  opacity: 0.6;
  transform: translate(0px, -8px);
}
.tick.century {
  opacity: 1;
  border-bottom: 1px solid grey;
}
/* horizontal marker line */
.wide {
  position: absolute;
  height: 5px;
  min-height: 3px;
  border-radius: 3px;
  z-index: 1;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
  font-size: 0.8rem;
  text-align: right;
  cursor: default;
}
.wide:hover {
  opacity: 1;
  box-shadow: 2px 2px 8px 0px steelblue;
}
.wide-label {
  margin: 10px;
}
/* translucent background span */
.region {
  position: absolute;
  min-height: 3px;
  border-radius: 3px;
  z-index: 1;
  opacity: 0.3;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
  cursor: default;
}
.region:hover {
  opacity: 1;
  box-shadow: 2px 2px 8px 0px steelblue;
}
</style>
