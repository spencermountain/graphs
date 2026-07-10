<script setup>
// -/+ number stepper, ported from the original plus-minus.js
defineProps({ modelValue: { type: Number, default: 0 } })
const emit = defineEmits(['update:modelValue'])
const set = (val) => emit('update:modelValue', Number(val) || 0)
</script>

<template>
  <div class="row-left">
    <button class="btn" @click="set(modelValue - 1)">−</button>
    <input class="num" type="text" :value="modelValue" @change="set($event.target.value)" />
    <button class="btn" @click="set(modelValue + 1)">+</button>
  </div>
</template>

<style scoped>
/* matches the old 'w5 f2 grey rounded center' input */
.num {
  width: 5rem;
  font-size: 2rem;
  color: #838B91;
  text-align: center;
  border: 1px solid #d7d5d2;
  border-radius: 5px;
}

.btn {
  padding: 0 0.5rem;
  margin: 0 0.25rem;
  color: #606c74;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 5px;
  cursor: pointer;
}
</style>
