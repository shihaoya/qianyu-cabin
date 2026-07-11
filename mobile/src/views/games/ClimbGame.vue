<!--
@doc
name: ClimbGame
path: src/views/games/ClimbGame.vue
category: business
purpose: 示例游戏「千羽爬树」（移动端）。状态契约与 PC 完全一致（height/stamina/climbs），
         仅操作/布局差异，保证 PC 存、手机续玩，反之亦然。
appliesTo: 移动
-->
<script setup>
import { onMounted, reactive, ref } from 'vue'
import BaseButton from '../../components/base/BaseButton.vue'
import { useGameSave, submitGameRecord } from '../../composables/useGame.js'
import { confirm, alert } from '../../composables/useConfirm.js'

const props = defineProps({ gameKey: { type: String, required: true } })
const emit = defineEmits(['finished'])

const save = useGameSave(props.gameKey)
const state = reactive({ height: 0, stamina: 10, climbs: 0 })
const finished = ref(false)
const lastResult = ref(null)

onMounted(async () => {
  const existing = await save.load()
  if (existing && existing.state) {
    const ok = await confirm({
      title: '继续上局？',
      message: `检测到上次在${existing.platform === 'mobile' ? '手机' : '电脑'}端的进度（高度 ${existing.score ?? 0}），要继续吗？`,
      confirmText: '继续',
      cancelText: '重新开始',
    })
    if (ok) {
      Object.assign(state, existing.state)
    } else {
      await save.clear()
    }
  }
})

function climb() {
  if (finished.value) return
  const gain = 1 + Math.floor(Math.random() * 5)
  state.height += gain
  state.stamina -= 1
  state.climbs += 1
  save.save({ height: state.height, stamina: state.stamina, climbs: state.climbs }, state.height)
  if (state.stamina <= 0) finish()
}

async function finish() {
  finished.value = true
  const result = { height: state.height, climbs: state.climbs }
  lastResult.value = result
  try {
    await submitGameRecord(props.gameKey, result)
    await alert({ title: '爬到顶啦', message: `最终高度 ${result.height}，共攀爬 ${result.climbs} 次！` })
    emit('finished')
  } catch (e) {
    await alert({ title: '出错', message: e.message || '成绩提交失败' })
  }
}

async function onSave() {
  if (finished.value) return
  await save.save({ height: state.height, stamina: state.stamina, climbs: state.climbs }, state.height)
  await alert({ title: '已存档', message: '下次进来可以继续哦～' })
}
defineExpose({ onSave })

async function restart() {
  await save.clear()
  state.height = 0
  state.stamina = 10
  state.climbs = 0
  finished.value = false
  lastResult.value = null
}
</script>

<template>
  <div class="climb">
    <div class="climb__stats">
      <div class="climb__stat"><span>高度</span><b>{{ state.height }}</b></div>
      <div class="climb__stat"><span>体力</span><b>{{ state.stamina }}</b></div>
      <div class="climb__stat"><span>攀爬</span><b>{{ state.climbs }}</b></div>
    </div>

    <div class="climb__tree">
      <div class="climb__bird" :style="{ bottom: Math.min(state.height * 3, 230) + 'px' }">🐦</div>
      <div class="climb__trunk" />
    </div>

    <BaseButton v-if="!finished" type="primary" @click="climb">攀爬一下</BaseButton>

    <div v-else class="climb__over">
      <p>这局结束啦～ 高度 <b>{{ lastResult.height }}</b></p>
      <BaseButton @click="restart">再来一局</BaseButton>
    </div>
  </div>
</template>

<style scoped>
.climb {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}
.climb__stats {
  display: flex;
  gap: 10px;
  width: 100%;
  justify-content: center;
}
.climb__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  max-width: 100px;
  padding: 10px;
  background: rgba(91, 140, 123, 0.1);
  border-radius: 12px;
}
.climb__stat span {
  font-size: 12px;
  color: var(--muted);
}
.climb__stat b {
  font-size: 20px;
}
.climb__tree {
  position: relative;
  width: 100px;
  height: 250px;
  display: flex;
  justify-content: center;
}
.climb__trunk {
  width: 16px;
  height: 100%;
  border-radius: 8px;
  background: var(--primary);
  opacity: 0.85;
}
.climb__bird {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 28px;
  transition: bottom 0.25s ease;
}
.climb__over {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  width: 100%;
}
</style>
