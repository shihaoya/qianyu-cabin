<!--
@doc
name: GameArea
path: src/components/GameArea.vue
category: business
purpose: 主页游戏区网格容器，展示多个游戏入口（当前含千羽爬树），后续加游戏只需在 games 数组追加
appliesTo: PC
props: games(Array)
events: select(game)
example: <GameArea :games="games" @select="onPlay" />
-->
<script setup>
import GameIcon from './base/GameIcon.vue'

defineProps({
  games: { type: Array, default: () => [] },
})
const emit = defineEmits(['select'])
</script>

<template>
  <div class="game-grid">
    <button
      v-for="game in games"
      :key="game.id"
      class="game-tile"
      type="button"
      @click="emit('select', game)"
    >
      <span class="game-tile__art">
        <GameIcon :type="game.icon" :size="56" />
      </span>
      <span class="game-tile__name">{{ game.name }}</span>
    </button>
  </div>
</template>

<style scoped>
.game-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 16px;
}
.game-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 18px 12px;
  border: 1px solid #eadfca;
  border-radius: var(--radius);
  background: var(--bg);
  cursor: pointer;
  font: inherit;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.game-tile:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(91, 140, 123, 0.18);
  border-color: var(--primary);
}
.game-tile:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.game-tile__art {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(91, 140, 123, 0.14);
}
.game-tile__name {
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
}
</style>
