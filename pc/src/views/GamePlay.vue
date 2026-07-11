<script setup>
import { computed, ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { getGame } from '../games/registry.js'
import GameShell from '../components/GameShell.vue'

const route = useRoute()
const game = computed(() => getGame(route.params.key))
const boardRef = ref(null)
const shellRef = ref(null)

// GameShell 的「存档/暂停」按钮 → 转发给具体游戏组件去存档
function onPause() {
  boardRef.value?.onSave?.()
}
// 游戏结束提交成绩后 → 刷新排行榜
function onFinished() {
  shellRef.value?.refresh?.()
}
</script>

<template>
  <div class="game-play">
    <GameShell v-if="game" ref="shellRef" :game="game" @pause="onPause">
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
  padding-bottom: 40px;
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
