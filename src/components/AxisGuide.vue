<template>
  <div class="absolute inset-0 pointer-events-none select-none">

    <!-- Vertical center axis -->
    <div
      class="absolute inset-y-0 left-1/2 border-l border-dashed border-white/15"
      style="width: 1px;"
    />

    <!-- Horizontal reference lines with labels -->
    <div
      v-for="ref in REFS"
      :key="ref.label"
      class="absolute left-0 right-0 flex items-center"
      :style="{ top: ref.pct + '%' }"
    >
      <!-- Label -->
      <span class="ml-3 text-white/50 text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap">
        {{ ref.label }}
      </span>
      <!-- Dashed line -->
      <div class="flex-1 mx-2 border-t border-dashed border-white/20" />
      <!-- End dot -->
      <div class="w-2 h-2 rounded-full bg-white/25 mr-3 flex-shrink-0" />
    </div>

    <!-- Center intersection marker -->
    <div
      class="absolute"
      style="top: 36%; left: 50%; transform: translate(-50%, -50%);"
    >
      <div class="w-4 h-4 rounded-full border border-white/25" />
    </div>

  </div>
</template>

<script setup>
const REFS = [
  { label: 'Cap',     pct: 18 },
  { label: 'Umeri',   pct: 36 },
  { label: 'Șolduri', pct: 62 },
]
</script>
