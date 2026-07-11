<!--
@doc
name: GameShell
path: src/components/GameShell.vue
category: business
purpose: 游戏通用外壳（PC）：仅提供返回、标题、暂停/继续按钮与游戏棋盘插槽（#board）。
         排行榜改为游戏内按钮弹出（见各游戏组件），不再占用侧栏，使整页即游戏。
appliesTo: PC
props: game(Object, 必填)
events: pause
example: <GameShell :game="game" @pause="onPause"><template #board><MyGame/></template></GameShell>
-->
<script setup>
import { RouterLink } from 'vue-router'
import BaseButton from './base/BaseButton.vue'

const props = defineProps({
  game: { type: Object, required: true },
})
</script>

<template>
  <div class="game-shell">
    <header class="gs-head">
      <RouterLink to="/" class="gs-back">← 返回</RouterLink>
      <h1 class="gs-title">{{ game.name }}</h1>
    </header>

    <div class="gs-board">
      <slot name="board" />
    </div>
  </div>
</template>

<style scoped>
.game-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.gs-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  background: var(--surface);
  box-shadow: var(--shadow);
  z-index: 2;
}
.gs-back {
  color: var(--primary);
  text-decoration: none;
  font-size: 14px;
}
.gs-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 22px;
  flex: 1;
}
.gs-board {
  flex: 1;
  min-height: 0;
  position: relative;
}
</style>
