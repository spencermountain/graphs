<script setup>
import { computed } from 'vue'
import { calcMonth } from './calendar.js'

// ported from somehow-calendar Month.svelte (build-time version, with top/bottom split days)
// date: spacetime month-start; tops/bottoms/isHome: {iso-date: value} maps (already fmtDays'd)
const props = defineProps({
  date: { type: Object, required: true },
  tops: { type: Object, default: () => ({}) },
  bottoms: { type: Object, default: () => ({}) },
  isHome: { type: Object, default: () => ({}) },
})

const isWeekend = (d) => {
  let day = d.dayName()
  return day === 'saturday' || day === 'sunday'
}

const weeks = computed(() =>
  calcMonth(props.date).map((w) =>
    w.map((day) => {
      let iso = day.format('iso-short')
      return {
        iso,
        color: props.tops[iso] || 'none', // day-games get an inline bg colour
        num: day.format('{date}'),
        isTop: Object.hasOwn(props.tops, iso),
        isHome: Object.hasOwn(props.isHome, iso),
        isBottom: Object.hasOwn(props.bottoms, iso),
        isWeekend: isWeekend(day),
        inMonth: day.isSame(props.date, 'month'),
      }
    })
  )
)
</script>

<template>
  <div class="month w-full">
    <div class="monthName">{{ date.format('month') }}</div>
    <div v-for="(w, i) in weeks" :key="i" class="week">
      <template v-for="d in w" :key="d.iso">
        <div v-if="d.inMonth" class="day square" :class="{
          weekend: d.isWeekend,
          topHome: d.isTop && d.isHome,
          bottomHome: d.isBottom && d.isHome,
          topAway: d.isTop && !d.isHome,
          bottomAway: d.isBottom && !d.isHome,
          highlight: d.color !== 'none',
        }" :style="{ backgroundColor: d.color }" :title="d.iso">
          <div class="num">{{ d.num }}</div>
        </div>
        <div v-else class="day noday square"></div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* css kept in original order — .weekend last so its bg wins over the gradients' */
.monthName {
  font-size: 1rem;
  color: #838b91;
  text-align: right;
  margin-bottom: 0.2rem;
  margin-top: 0.2rem;
  margin-right: 0.7rem;
}

.week {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  text-align: center;
  flex-wrap: nowrap;
  align-self: stretch;
}

.day {
  position: relative;
  flex: 1;
  margin: 0.5%;
  border-radius: 3px;
  box-shadow: 2px 1px 6px 0px rgba(0, 0, 0, 0.2);
  min-width: 13px;
  min-height: 12px;
  box-sizing: border-box;
  font-size: 9px;
  color: #a3a5a5;
  overflow: hidden;
  z-index: 1;
  cursor: pointer;
}

.day:hover {
  box-shadow: 1px 4px 10px 1px rgba(0, 0, 0, 0.2);
}

.highlight {
  box-shadow: 1px 4px 10px 1px rgba(0, 0, 0, 0.4);
}

.square {
  padding-top: 15%;
  position: relative;
}

.noday {
  box-shadow: none !important;
}

/* top half = day game, bottom half = night game; blue = home, grey-purple = away */
.topHome {
  background: linear-gradient(0deg, #f0f0f0 50%, rgba(81, 115, 166, 0.7) 50%);
}

.bottomHome {
  background: linear-gradient(0deg, rgba(81, 115, 166, 0.9) 50%, #f0f0f0 50%);
}

.topAway {
  background: linear-gradient(0deg, #f0f0f0 50%, rgba(151, 139, 163, 0.7) 50%);
}

.bottomAway {
  background: linear-gradient(0deg, rgba(151, 139, 163, 0.9) 50%, #f0f0f0 50%);
}

/* day number, shows on hover */
.num {
  position: absolute;
  z-index: 4;
  font-size: 14px;
  color: #949a9e;
  width: 100%;
  height: 100%;
  top: 0px;
  text-align: center;
  margin: auto;
  opacity: 0;
  cursor: pointer;
}

.num:hover {
  opacity: 0.8;
}

.weekend {
  background-color: #f0f0f0;
}

@media only screen and (max-width: 400px) {
  .monthName {
    font-size: 0.7rem;
  }

  .day {
    border-radius: 2px;
    margin: 0.5%;
    box-shadow: 1px 1px 1px 0px rgba(0, 0, 0, 0.2);
  }

  .num {
    display: none;
  }
}
</style>
