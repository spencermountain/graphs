<script setup>
import TorontoMap from './TorontoMap.vue'

definePageMeta({ title: 'Active building permits in Toronto', description: 'a 3d box per permit, sized by units, coloured by ward' })
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <a href="/" class="link text-sm text-gray-400 self-start">〱 graphs</a>
    <h1>Active building permits in Toronto</h1>
    <div class="text-gray-400 mb-4">a 3d box per permit — taller means more units, coloured by ward</div>

    <!-- the map, client-only -->
    <div class="bg-white rounded-xl shadow-md overflow-hidden w-full max-w-[1200px]">
      <ClientOnly>
        <TorontoMap />
        <template #fallback>
          <div class="w-full h-[700px] row-center text-gray-300">loading map…</div>
        </template>
      </ClientOnly>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
      <a class="link" href="https://open.toronto.ca/dataset/building-permits-active-permits/">data: City of Toronto</a>
    </div>
  </div>
</template>
