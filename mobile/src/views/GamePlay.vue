<script setup>
import { computed, ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { getGame } from '../games/registry.js'
import GameShell from '../components/GameShell.vue'

const route = useRoute()
const game = computed(() => getGame(route.params.key))
const boardRef = ref(null)
const shellRef = ref(null)

function onFinished() {
  shellRef.value?.refresh?.()
}
</script>

<template>
  <div class="game-play">
    <GameShell v-if="game" ref="shellRef" :game="game">
      <template #board>
        <component :is="game.component" :game-key="game.key" ref="boardRef" @finished="onFinished" />
      </template>
    </GameShell>
    <div v-else class="game-missing">
      <p>没有这个游戏哦～</p>
      <RouterLink to="/">返回首页</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.game-play {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}
.game-missing {
  text-align: center;
  padding: 80px 20px;
  color: var(--muted);
}
.game-missing a {
  color: var(--primary);
}
</style>
