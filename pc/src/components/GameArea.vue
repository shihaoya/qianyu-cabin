<!--
@doc
name: GameArea
path: src/components/GameArea.vue
category: business
purpose: 主页游戏区入口列表，每条游戏用 EntryCard（图标+标题+描述+箭头）呈现；后续加游戏只需在 games 数组追加
appliesTo: PC
props: games(Array)
events: select(game)
example: <GameArea :games="games" @select="onPlay" />
-->
<script setup>
import EntryCard from './base/EntryCard.vue'

defineProps({
  games: { type: Array, default: () => [] },
})
const emit = defineEmits(['select'])
</script>

<template>
  <div class="game-list">
    <EntryCard
      v-for="game in games"
      :key="game.id"
      :icon="game.icon"
      :title="game.name"
      desc="进去玩玩 ~"
      @select="emit('select', game)"
    />
  </div>
</template>

<style scoped>
.game-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
