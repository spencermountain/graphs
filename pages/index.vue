<script setup>
import manifest from '../manifest.js'

</script>

<template>
  <div class="col-left mx-auto w-full max-w-2xl gap-4 p-6">
    <div class="text-xl">graphs</div>

    <div v-for="year in Object.keys(manifest).reverse()" :key="year">
      <div class="text-sm text-slate-400">/{{ year }}</div>
      <ul class="ml-3">
        <li v-for="post in manifest[year]" :key="post.id">
          • <a :href="`/${post.id}`" class="link">{{ post.label }}</a>
        </li>
      </ul>
    </div>
  </div>
</template>
