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
  /* 供竖屏全屏游戏参考：顶部导航占用的高度（含刘海安全区），游戏旋转区需减掉它；
     与首页顶部导航统一高度（--topbar-h），移动端小屏更紧凑 */
  --gs-head-h: calc(var(--topbar-h, 44px) + env(safe-area-inset-top, 0px));
}
.gs-head {
  flex: none;
  height: var(--gs-head-h);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  padding-top: env(safe-area-inset-top, 0px);
  background: var(--surface);
  border-bottom: 1px solid rgba(120, 90, 50, 0.1);
  position: relative; /* 让 z-index 生效，浮在竖屏全屏游戏画面之上 */
  z-index: 2;
}
.gs-back {
  color: var(--primary);
  text-decoration: none;
  font-size: 13px;
}
.gs-title {
  margin: 0;
  font-size: 17px;
  font-family: var(--font-display);
  flex: 1;
}
.gs-board {
  flex: 1;
  min-height: 0;
  position: relative;
}
</style>
