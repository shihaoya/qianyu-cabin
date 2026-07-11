<!--
@doc
name: GameShell
path: src/components/GameShell.vue
category: business
purpose: 游戏通用外壳：返回、存档/暂停按钮、游戏棋盘插槽（#board）、右侧排行榜。排行榜数据由 useGameLeaderboard 拉取，
         每行展示排名/昵称/平台/分数/自定义明细（明细由 game.formatDetail 渲染，计分展示与服务端 engine 对应）。
appliesTo: PC
props: game(Object, 必填)
events: pause
example: <GameShell :game="game" @pause="onPause"><template #board><MyGame/></template></GameShell>
-->
<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import BaseButton from './base/BaseButton.vue'
import { useGameLeaderboard } from '../composables/useGame.js'

const props = defineProps({
  game: { type: Object, required: true },
})
const emit = defineEmits(['pause'])

const { list, total, load: loadLeaderboard } = useGameLeaderboard(props.game.key)

onMounted(loadLeaderboard)

function platformLabel(p) {
  return p === 'mobile' ? '手机' : '电脑'
}
function formatDetail(detail) {
  return props.game.formatDetail ? props.game.formatDetail(detail) : []
}
// 供外层在提交成绩后刷新榜单
function refresh() {
  return loadLeaderboard()
}
defineExpose({ refresh })
</script>

<template>
  <div class="game-shell">
    <header class="gs-head">
      <RouterLink to="/" class="gs-back">← 返回</RouterLink>
      <h1 class="gs-title">{{ game.name }}</h1>
      <BaseButton type="text" @click="emit('pause')">存档 / 暂停</BaseButton>
    </header>

    <div class="gs-body">
      <section class="gs-board">
        <slot name="board" />
      </section>

      <aside class="gs-side">
        <h2 class="gs-side__title">排行榜</h2>
        <ol class="gs-rank">
          <li v-for="row in list" :key="row.userId" class="gs-rank__item">
            <span class="gs-rank__no">{{ row.rank }}</span>
            <span class="gs-rank__name">{{ row.nickname }}</span>
            <span class="gs-rank__plat" :class="'plat--' + row.platform">{{ platformLabel(row.platform) }}</span>
            <span class="gs-rank__score">{{ row.score }} {{ game.scoreLabel }}</span>
            <span class="gs-rank__detail">
              <template v-for="(f, i) in formatDetail(row.detail)" :key="i">{{ f.label }}:{{ f.value }}&nbsp;</template>
            </span>
          </li>
          <li v-if="!list.length" class="gs-rank__empty">还没有记录，来抢第一名～</li>
        </ol>
        <p v-if="total > list.length" class="gs-rank__more">仅显示前 {{ list.length }} 名</p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.game-shell {
  max-width: 1100px;
  margin: 0 auto;
  padding: 20px;
}
.gs-head {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}
.gs-back {
  color: var(--primary);
  text-decoration: none;
  font-size: 14px;
}
.gs-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 24px;
  flex: 1;
}
.gs-body {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
  align-items: start;
}
.gs-board {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 24px;
  min-height: 320px;
}
.gs-side {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 18px;
}
.gs-side__title {
  margin: 0 0 12px;
  font-size: 18px;
  font-family: var(--font-display);
}
.gs-rank {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.gs-rank__item {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  grid-template-areas: 'no name plat' 'no score detail';
  gap: 2px 8px;
  align-items: center;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(91, 140, 123, 0.08);
}
.gs-rank__no {
  grid-area: no;
  font-weight: 700;
  color: var(--primary);
  text-align: center;
}
.gs-rank__name {
  grid-area: name;
  font-weight: 600;
}
.gs-rank__plat {
  grid-area: plat;
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 999px;
  justify-self: end;
}
.plat--pc {
  background: rgba(201, 116, 59, 0.18);
  color: var(--primary);
}
.plat--mobile {
  background: rgba(91, 140, 123, 0.18);
  color: var(--accent);
}
.gs-rank__score {
  grid-area: score;
  font-size: 13px;
  color: var(--text);
}
.gs-rank__detail {
  grid-area: detail;
  font-size: 12px;
  color: var(--muted);
  justify-self: end;
}
.gs-rank__empty {
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  padding: 16px 0;
}
.gs-rank__more {
  margin: 10px 2px 0;
  color: var(--muted);
  font-size: 12px;
}
@media (max-width: 760px) {
  .gs-body {
    grid-template-columns: 1fr;
  }
}
</style>
