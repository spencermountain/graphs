<script setup>
import byColor from './colors.js'
import data from './data.js'
import counts from './counts.js'

definePageMeta({ title: 'Long-serving Toronto city councilors', description: 'councilors re-elected since 1997' })

// highlight anyone who served this many terms or more
const minTerms = 2
// integer-like keys enumerate ascending: 1997 → 2022
const years = Object.keys(data)
// years where the seat-count changed (amalgamation, then the 2018 cut)
const seatNote = ['1997', '2000', '2018']
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1>Long-serving Toronto city councilors</h1>
    </div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 mt-6 w-full max-w-6xl">
      <!-- top legend: rotated names above their seat position in the early terms -->
      <div class="term legend" style="margin-bottom: 5px">
        <div class="year" style="border: none"></div>
        <div class="rel">
          <div class="label" style="left: 3%; color: #735873">Gloria Lindsay Luby</div>
          <div class="label" style="left: 15.5%; color: #D68881">Maria Augimeri</div>
          <div class="label" style="left: 45%; color: #978BA3">John Filion</div>
          <div class="label" style="left: 49%; color: #2D85A8">David Shiner</div>
          <div class="label" style="left: 40%; color: #F2C0BB">Joe Mihevc</div>
          <div class="label" style="left: 69%; color: #335799">Denzil Minnan-Wong</div>
          <div class="label" style="left: 88%; color: #e6d7b3">Raymond Cho</div>
        </div>
        <div class="aside"></div>
      </div>

      <!-- one row per election, a tick per seat -->
      <template v-for="year in years" :key="year">
        <div v-if="year === '2000' || year === '2018'" style="margin-top: 20px"></div>
        <div class="term">
          <div class="year">{{ year }}</div>
          <div
            v-for="(str, i) in data[year]"
            :key="i"
            class="person"
            :class="{ highlight: counts[str] >= minTerms }"
            :style="counts[str] >= minTerms && byColor[str] ? { borderLeft: '7px solid ' + byColor[str] } : null"
            :title="str"
          ></div>
          <div class="aside">
            <template v-if="seatNote.includes(year)">
              {{ data[year].length }} seats
              <br />
              ↓
            </template>
          </div>
        </div>
      </template>

      <!-- bottom legend: still-serving councilors, below their 2022 seat -->
      <div class="term legend" style="margin-top: 1rem; align-items: flex-end; max-height: 40px; margin-bottom: 3rem">
        <div class="year" style="border: none"></div>
        <div class="rel">
          <div class="label right" style="left: 10%; color: #2D85A8">Anthony Perruzza</div>
          <div class="label right" style="left: 18%; color: #6699cc">Frances Nunziata</div>
          <div class="label right" style="left: 27%; color: #cc6966">Gord Perks</div>
          <div class="label right" style="left: 60%; color: #d8b3e6">Paula Fletcher</div>
          <div class="label right" style="left: 76%; color: #7f9c6c">Michael Thompson</div>
          <div class="label right" style="left: 88%; color: #275291">Paul Ainslie</div>
        </div>
        <div class="aside"></div>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
.right {
  text-align: right !important;
  width: 70px !important;
}
.label {
  flex: 1;
  flex-wrap: nowrap;
  position: absolute;
  transform: rotate(-90deg) translateX(10px);
  width: 100px;
  height: 20px;
  text-align: left;
  font-size: 12px;
  line-height: 1rem;
}
.rel {
  position: relative;
  width: 100%;
  flex: 1;
}
.legend {
  position: relative;
}
.term {
  flex: 1;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  text-align: center;
  flex-wrap: nowrap;
  align-self: stretch;
  box-sizing: border-box;
  min-width: 300px;
}
/* each seat is a thin vertical tick; grey unless re-elected */
.person {
  min-height: 100px;
  height: 100%;
  border-left: 7px solid lightgrey;
  box-sizing: border-box;
  margin-left: 0px;
  margin-top: 0px !important;
}
.highlight {
  opacity: 1;
  margin-top: 0px !important;
  min-height: 120px;
}
.aside {
  width: 100px;
  color: grey;
  font-size: 12px;
}
.year {
  min-width: 45px;
  max-width: 45px;
  color: grey;
  font-size: 12px;
  text-align: left;
  align-self: flex-start;
  border-right: 1px solid lightsteelblue;
  min-height: 110px;
}
@media only screen and (max-width: 700px) {
  .aside {
    display: none;
  }
  .person {
    border-left: 5px solid lightgrey;
  }
}
</style>
