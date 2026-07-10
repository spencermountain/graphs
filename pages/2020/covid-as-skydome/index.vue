<script setup>
// static image post — a 3d render of the skydome with covid deaths shaded as seats
import img from './third-covid.jpg'

definePageMeta({
  title: 'Canadian Covid deaths as percentage of skydome',
  description: '- as of June 8th, 2020',
})

// the two figures from the original post
const skydomeSeats = '53,000'
const covidDeaths = '7,835'
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <div class="w-full max-w-4xl">
      <!-- header -->
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-2xl font-light text-gray-700 mt-2">Canadian Covid deaths as percentage of skydome</h1>
      <div class="text-gray-400 mb-4">- as of June 8th, 2020</div>

      <!-- the graphic -->
      <div class="bg-white rounded-xl shadow-md p-6 col">
        <img :src="img" alt="covid deaths as % of Skydome seats" class="w-full rounded-md shadow" />
        <ul class="mt-4 text-gray-600 self-start">
          <div>skydome: {{ skydomeSeats }}</div>
          <div>covid deaths: {{ covidDeaths }}</div>
        </ul>
      </div>

      <!-- footer -->
      <div class="mt-8 text-sm text-gray-400 row-center gap-4">
        <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
      </div>
    </div>
  </div>
</template>
