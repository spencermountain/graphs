<script setup>
import { ref } from 'vue'
import colors from '~/assets/colors.js'
import data from './data.js'

definePageMeta({ title: 'Elections in Toronto', description: 'mayoral race results, 1949–2022' })

// candidate → named color, same map as the original
// (original had duplicate keys — later value won: Doug Ford=fire, Ross Dowson=greypurple)
const personColors = {
  'Jennifer Keesmaat': colors.pink,
  'Jack Layton': colors.yellow,
  'Barbara Hall': colors.mud,
  'A. Hummer': colors.pink,
  'George Smitherman': colors.fuscia,
  'Gil Peñalosa': colors.royal,
  'June Rowlands': colors.tulip,
  'John Tory': colors.sea,
  'Olivia Chow': colors.olive,
  'Art Eggleton': colors.suede,
  'Nathan Phillips': colors.sky,
  'William Dennison': colors.greyblue,
  'Philip Givens': colors.tulip,
  'David Crombie': colors.orange,
  "Tony O'Donohue": colors.green,
  'Allan Lamport': colors.red,
  'Stephen Clarksont': colors.fire,
  'Mel Lastman': colors.cherry,
  'Tooker Gomberg': colors.fire,
  'David Miller': colors.brown,
  'Rob Ford': colors.fire,
  'Doug Ford': colors.fire,
  'Chloe-Marie Brown': colors.red,
  'Joe Pantalone': colors.slate,
  'Carolann Wright': colors.green,
  'Anne Johnston': colors.olive,
  'John Sewell': colors.blue,
  'Don Andrews': colors.red,
  'Margaret Campbell': colors.rouge,
  'Stephen Clarkson': colors.beige,
  'Donald Summerville': colors.greygreen,
  'Arthur J. Brown': colors.slate,
  'Ford Brand': colors.olive,
  'Arthur Brown': colors.green,
  'Leslie Saunders': colors.purple,
  'Roy E. Belyea': colors.greygreen,
  'Ross Dowson': colors.greypurple,
  'Hiram E. McCallum': colors.pink,
  'Charles Mahoney': colors.rose,
}

// each row keeps the remaining vote share as a grey 'other' bar
const rows = data.map((o) => {
  const sum = o.people.reduce((s, p) => s + parseInt(p.percent), 0)
  return { ...o, other: 100 - sum }
})

// hover fades everyone else; click pins the highlight
const hover = ref(null)
const clicked = ref(null)
const toggle = (str) => {
  if (clicked.value === str) {
    clicked.value = null
    hover.value = null
  } else {
    clicked.value = str
  }
}
const isShy = (name) =>
  (hover.value && hover.value !== name) || (clicked.value && clicked.value !== name)
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <a href="/" class="link text-sm text-gray-400 self-start">〱 graphs</a>
    <h1>Elections in Toronto</h1>
    <div class="text-gray-400 mb-6">mayoral race results, 1949–2022</div>

    <div class="bg-white rounded-xl shadow-md p-6">
      <div v-for="(o, i) in rows" :key="i" class="year">
        <div class="digit">{{ o.year }}</div>
        <div class="people">
          <div v-for="p in o.people" :key="p.name" class="person" :title="p.name"
            :class="{ shy: isShy(p.name) }"
            :style="{ width: p.percent, backgroundColor: personColors[p.name] || 'steelblue' }"
            @click="toggle(p.name)" @mouseenter="hover = p.name" @mouseleave="hover = null"></div>
          <div class="person other" :style="{ width: o.other + '%' }"></div>
        </div>
      </div>
    </div>

    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://en.wikipedia.org/wiki/List_of_Toronto_municipal_elections">data</a>
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
/* original layout, copied verbatim from the 2022 svelte post */
.year {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  text-align: center;
  flex-wrap: wrap;
  min-height: 90px;
}

.digit {
  width: 80px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  margin-bottom: 1rem;
  color: grey;
}

.people {
  width: 400px;
  display: flex;
  flex-direction: row;
  justify-content: stretch;
  align-items: flex-start;
  flex-wrap: nowrap;
  align-self: stretch;
}

/* 500px width is the fallback when a percent string lacks '%' (1991, 1994 rows) — matches original */
.person {
  height: 75px;
  width: 500px;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
  margin-right: 4px;
  border-radius: 5px;
  transition: opacity 0.25s;
}

.person:hover {
  box-shadow: 4px 4px 8px 0px rgba(0, 0, 0, 0.4);
}

.other {
  background-color: lightgrey;
}

.shy {
  opacity: 0.4;
}

@media only screen and (max-width: 500px) {
  .people {
    width: 300px;
  }

  .person {
    height: 60px;
  }
}
</style>
