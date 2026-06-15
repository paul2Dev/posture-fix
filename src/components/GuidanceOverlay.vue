<template>
  <div class="absolute bottom-24 left-4 right-4 flex flex-col items-center gap-2 pointer-events-none">

    <!-- Calibration phase: shown while auto-calibrating -->
    <div v-if="active && !isCalibrated" class="calib-pill">
      <span class="text-sm font-medium mb-2">Stai drept — calibrare automată...</span>
      <div class="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
        <div
          class="h-full bg-white rounded-full transition-all duration-200"
          :style="{ width: (calibProgress * 100) + '%' }"
        />
      </div>
    </div>

    <!-- Active issue chips — shown after calibration -->
    <transition-group v-else name="chip" tag="div" class="flex flex-col items-center gap-2 w-full">
      <div v-if="issues.forwardHead" key="fh" class="guidance-chip">
        <span class="guidance-icon">↕</span>
        <span>Aliniează capul deasupra umerilor</span>
      </div>
      <div v-if="issues.headTilt" key="ht" class="guidance-chip">
        <span class="guidance-icon">↔</span>
        <span>Nu înclina capul — ține-l drept</span>
      </div>
      <div v-if="issues.roundedShoulders" key="rs" class="guidance-chip">
        <span class="guidance-icon">⟵⟶</span>
        <span>Deschide umerii, trage omoplații înapoi</span>
      </div>
      <div v-if="issues.curvedBack" key="cb" class="guidance-chip">
        <span class="guidance-icon">↑</span>
        <span>Îndreaptă spatele, stai pe șezut</span>
      </div>
      <div v-if="issues.lateralTilt" key="lt" class="guidance-chip">
        <span class="guidance-icon">⇅</span>
        <span>Echilibrează umerii — un umăr e mai jos</span>
      </div>
    </transition-group>

    <!-- All good indicator -->
    <div v-if="active && isCalibrated && !hasIssue" class="guidance-good">
      <span class="text-green-400 font-bold mr-1">✓</span> Postură corectă
    </div>

  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  issues:        { type: Object,  default: () => ({}) },
  active:        { type: Boolean, default: false },
  isCalibrated:  { type: Boolean, default: false },
  calibProgress: { type: Number,  default: 0 },
})

const hasIssue = computed(() => Object.values(props.issues).some(Boolean))
</script>

<style scoped>
.calib-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  color: white;
  padding: 10px 18px;
  border-radius: 16px;
  width: 240px;
  max-width: 100%;
}
.guidance-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(239, 68, 68, 0.85);
  backdrop-filter: blur(4px);
  color: white;
  font-size: 13px;
  font-weight: 500;
  padding: 6px 14px;
  border-radius: 999px;
  width: fit-content;
  max-width: 100%;
}
.guidance-icon {
  font-size: 16px;
  flex-shrink: 0;
}
.guidance-good {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  color: white;
  font-size: 13px;
  padding: 6px 16px;
  border-radius: 999px;
}
.chip-enter-active, .chip-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.chip-enter-from, .chip-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
