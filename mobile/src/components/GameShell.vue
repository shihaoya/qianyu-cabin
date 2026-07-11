<!--
@doc
name: GameShell
path: src/components/GameShell.vue
category: business
purpose: 游戏通用外壳（移动端）：返回、存档/暂停按钮、游戏棋盘插槽（#board）、下方排行榜。
         排行榜数据由 useGameLeaderboard 拉取，行内展示排名/昵称/平台/分数/自定义明细。
appliesTo: 移动
props: game(Object, 必填)
events: pause
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
      <BaseButton type="text" @click="emit('pause')">存档</BaseButton>
    </header>

    <section class="gs-board">
      <slot name="board" />
    </section>

    <section class="gs-side">
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
    </section>
  </div>
</template>

<style scoped>
.game-shell {
  padding: 14px;
}
.gs-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
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
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 18px;
  min-height: 260px;
}
.gs-side {
  margin-top: 16px;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 14px;
}
.gs-side__title {
  margin: 0 0 10px;
  font-size: 17px;
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
  grid-template-columns: 26px 1fr auto;
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
  padding: 14px 0;
}
</style>
