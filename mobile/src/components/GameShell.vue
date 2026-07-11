<!--
@doc
name: GameShell
path: src/components/GameShell.vue
category: business
purpose: 游戏通用外壳（移动端）：仅提供返回、标题、暂停按钮与游戏棋盘插槽（#board）。
         排行榜改为游戏内按钮弹出（见各游戏组件），不再占用下方区域，使整页即游戏。
appliesTo: 移动
props: game(Object, 必填)
events: pause
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
  gap: 12px;
  padding: 10px 14px;
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
  font-size: 20px;
  font-family: var(--font-display);
  flex: 1;
}
.gs-board {
  flex: 1;
  min-height: 0;
  position: relative;
}
</style>
