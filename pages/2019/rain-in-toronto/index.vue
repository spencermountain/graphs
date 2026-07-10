<script setup>
import colors from '~/assets/colors.js'
import { W, H, BAR_W, yearChart } from './chart.js'
import y2000 from './data/2000-toronto.js'
import y2001 from './data/2001-toronto.js'
import y2002 from './data/2002-toronto.js'
import y2003 from './data/2003-toronto.js'
import y2004 from './data/2004-toronto.js'
import y2005 from './data/2005-toronto.js'
import y2006 from './data/2006-toronto.js'
import y2007 from './data/2007-toronto.js'
import y2008 from './data/2008-toronto.js'
import y2009 from './data/2009-toronto.js'
import y2010 from './data/2010-toronto.js'
import y2011 from './data/2011-toronto.js'
import y2012 from './data/2012-toronto.js'
import y2013 from './data/2013-toronto.js'
import y2014 from './data/2014-toronto.js'
import y2015 from './data/2015-toronto.js'
import y2016 from './data/2016-toronto.js'
import y2017 from './data/2017-toronto.js'
import y2018 from './data/2018-toronto.js'
import y2019 from './data/2019-toronto.js'

definePageMeta({ title: 'Rain in Toronto', description: 'over 20 years' })

// newest year on top, like the original page
const yearData = {
  2019: y2019, 2018: y2018, 2017: y2017, 2016: y2016, 2015: y2015,
  2014: y2014, 2013: y2013, 2012: y2012, 2011: y2011, 2010: y2010,
  2009: y2009, 2008: y2008, 2007: y2007, 2006: y2006, 2005: y2005,
  2004: y2004, 2003: y2003, 2002: y2002, 2001: y2001, 2000: y2000,
}
const years = Object.keys(yearData)
  .sort((a, b) => b - a)
  .map((y) => yearChart(yearData[y], Number(y)))

// flood photos beside some years (served from public/)
const dir = 'https://snip.spencermountain.dev/2019/01'
const pics = {
  2018: {
    src: `${dir}/2018-08-07-streetcar.jpg`,
    href: 'https://www.thestar.com/news/gta/2018/08/27/august-flooding-damaged-nine-new-ttc-streetcars.html',
    caption: 'Aug 7 2018',
  },
  2017: {
    src: `${dir}/2017-toronto-island.jpg`,
    href: 'http://torontostoreys.com/2017/12/environmental-flooding-toronto-islands/',
    caption: 'Toronto island flooding, May 2017',
  },
  2015: {
    src: `${dir}/dec-2015.jpg`,
    href: 'https://www.theglobeandmail.com/news/national/ontarios-ice-and-slush-just-dont-even-bother-today/article27949735/',
    caption: 'Winter rain, Dec 2015',
  },
}

// the July 8 2013 flash-flood gets its own photo strip
const flood2013 = [
  { src: `${dir}/2013-dufferin.jpg`, href: 'http://niche-canada.org/2013/07/18/the-toronto-flood-of-2013-actions-from-the-past-a-warning-for-the-new-normal/' },
  { src: `${dir}/2013-go-train.jpg`, href: 'http://happyorhungry.com/2013/07/12/flood-city/' },
  { src: `${dir}/2013-dvp.jpg`, href: 'http://happyorhungry.com/2013/07/12/flood-city/' },
]
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start ml-2">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-2xl text-gray-700 mt-2">Rain in Toronto</h1>
      <div class="text-gray-400">over 20 years</div>
    </div>

    <!-- one small-multiple per year: daily rain bars + thunder dots -->
    <div class="bg-white rounded-xl shadow-md p-6 mt-4">
      <template v-for="yr in years" :key="yr.year">
        <div class="row year">
          <svg :width="W" :height="H" :viewBox="`0,0,${W},${H}`" preserveAspectRatio="xMidYMid meet"
            style="overflow: visible; margin: 10px 20px 25px 25px">
            <!-- x-axis -->
            <g>
              <text v-for="t in yr.ticks" :key="t.label" :x="t.x" :y="H + 15" fill="#d7d5d2" text-anchor="middle"
                style="font-size: 12px">{{ t.label }}</text>
              <line x1="0" :y1="H" :x2="W" :y2="H" stroke="#d7d5d2" stroke-width="1" />
            </g>
            <!-- one 5px bar per rainy day -->
            <rect v-for="b in yr.bars" :key="b.date" :x="b.x" :y="b.y" :width="BAR_W" :height="b.h" rx="1"
              :fill="colors.blue" :stroke="colors.blue" stroke-width="1">
              <title>{{ b.date }}</title>
            </rect>
            <!-- rose dot below the axis on thunderstorm days -->
            <text v-for="(x, i) in yr.dots" :key="i" :x="x + 2" :y="H + 34" :fill="colors.rose">•</text>
            <!-- year label, top-left -->
            <text x="2" y="19" fill="grey">{{ yr.year }}</text>
          </svg>

          <!-- side photo, on flood years -->
          <div class="pic">
            <template v-if="pics[yr.year]">
              <a :href="pics[yr.year].href">
                <img class="rounded shadow-md max-w-40" :src="pics[yr.year].src" />
              </a>
              <div>{{ pics[yr.year].caption }}</div>
            </template>
          </div>
        </div>

        <!-- 2013 flash-flood photo strip -->
        <div v-if="yr.year === 2013" class="row year mb0">
          <div v-for="p in flood2013" :key="p.src">
            <a :href="p.href"><img class="rounded shadow-md max-w-48" :src="p.src" /></a>
          </div>
        </div>
        <div v-if="yr.year === 2013" class="row year mb0">
          <div>Flash-flood, July 8</div>
        </div>
      </template>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://github.com/spencermountain/thensome">source</a>
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
/* chart bottom-aligned with its photo, one year per row — from the original page css */
.year {
  align-items: flex-end;
  margin-bottom: 3rem;
  width: 760px;
  max-width: 100%;
}

.year.mb0 {
  margin-bottom: 0;
}

.pic {
  min-width: 200px;
}
</style>
