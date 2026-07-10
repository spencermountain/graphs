<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

definePageMeta({ title: 'Aspect Ratios', description: 'common aspect ratios, drawn as bars' })

// bar colors from the original
const blue = '#6d87a5' // 1:1 base square
const purple = '#946da5' // the extra width

// aspect ratios as %s:
const ratios = [
  { name: '5:4', desc: 'monitors', ratio: 1.25 },
  { name: '4:3', desc: 'ipads, photos', ratio: 1.3 },
  { name: '1:√2', desc: 'A4 paper', ratio: 1.41 },
  { name: '3:2', desc: '35mm film', ratio: 1.5 },
  { name: 'golden', desc: ' snails, etc.', ratio: 1.618 },
  { name: '16:9', desc: "1080p, 'widescreen'", ratio: 1.77 },
  { name: '19.5:9', desc: 'recent iphones', ratio: 2.16 },
]
const maxRatio = ratios[ratios.length - 1].ratio

// base bar width shrinks on narrow screens (svelte:window innerWidth)
const x = ref(200)
const onResize = () => (x.value = window.innerWidth > 600 ? 200 : 150)
onMounted(() => {
  onResize()
  window.addEventListener('resize', onResize)
})
onUnmounted(() => window.removeEventListener('resize', onResize))
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start mb-4">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-lg text-gray-800 mt-2">Aspect Ratios</h1>
    </div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6">
      <div class="relative mb-8">
        <div v-for="o in ratios" :key="o.name" class="ratio col">
          <div class="bar-row">
            <div class="name">{{ o.name }}</div>
            <div class="bars" :style="{ minWidth: x * maxRatio + 'px' }">
              <!-- 1:1 base square -->
              <div class="one" :style="{ height: '50px', width: x + 'px' }"></div>
              <!-- full-ratio bar underneath -->
              <div class="plus" :style="{ height: '50px', width: x * o.ratio + 'px' }"></div>
              <div class="desc" :style="{ width: '100px', left: x * o.ratio + 'px' }">{{ o.desc }}</div>
              <div class="below" :style="{ left: x + 'px', marginLeft: '15px', color: purple }">
                <span style="font-size: 10px">x</span>
                <span>{{ o.ratio }}</span>
              </div>
            </div>
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
.bar-row {
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  text-align: left;
  flex-wrap: nowrap;
  align-items: center;
}

.bars {
  position: relative;
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  flex-wrap: nowrap;
  width: 100%;
  margin-top: 5px;
  margin-right: 100px;
}

.name {
  font-size: 16px;
  font-weight: bold;
  margin-left: 2rem;
  margin-right: 0.2rem;
  width: 80px;
  color: grey;
}

.ratio {
  margin-top: 1rem;
  margin-bottom: 3rem;
}

.one {
  background-color: #6d87a5;
  z-index: 3;
  border-radius: 5px 0px 0px 5px;
}

.plus {
  background-color: #946da5;
  border-radius: 5px 5px 5px 5px;
  position: absolute;
  left: 0px;
  z-index: 1;
}

.desc {
  position: absolute;
  font-size: 14px;
  margin-left: 20px;
  top: 10px;
  color: grey;
  font-style: italic;
  white-space: nowrap;
}

.below {
  position: absolute;
  bottom: -30px;
  color: grey;
  font-size: 18px;
}

/* on narrow screens, desc moves above the bar */
@media only screen and (max-width: 850px) {
  .desc {
    top: -30px;
    left: 100px !important;
  }
  .bar-row {
    flex-wrap: wrap;
  }
  .bars {
    margin-top: 10px;
    margin-right: 10px;
  }
}
</style>
