<template>
  <div class="flex items-center justify-between gap-3">
    <span class="text-white/80">{{ label }}</span>
    <span v-if="!active" class="text-white/30">—</span>
    <span v-else-if="ok" class="text-green-400 font-semibold">✓</span>
    <span v-else class="text-red-400 font-semibold">✗</span>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  ok: { type: Boolean, default: true },
  active: { type: Boolean, default: false },
})
</script>
