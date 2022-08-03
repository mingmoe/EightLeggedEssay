<script setup lang="ts">
  import { nextTick, reactive } from 'vue'

  const state = reactive({count: 0})

  function increment(event:any) {
    event.target.value = state.count
    state.count++
  }
</script>

<template>
  <input :value="state.count" @input="increment"/>
</template>

<style scoped lang="postcss">


    
</style>
