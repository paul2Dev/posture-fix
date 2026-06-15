<template>
  <Transition name="slide-up">
    <div
      v-if="activeMessages.length > 0"
      class="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm px-4 py-4 space-y-2"
    >
      <div
        v-for="msg in activeMessages"
        :key="msg"
        class="flex items-center gap-3 text-white text-sm"
      >
        <span class="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
        {{ msg }}
      </div>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  activeMessages: { type: Array, default: () => [] },
})
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
