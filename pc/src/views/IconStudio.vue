<script setup>
import { ref, computed } from 'vue'
import AppHeader from '../components/base/AppHeader.vue'
import BaseCard from '../components/base/BaseCard.vue'
import BaseInput from '../components/base/BaseInput.vue'
import BaseButton from '../components/base/BaseButton.vue'
import BaseIcon from '../components/base/BaseIcon.vue'
import { ICONS, ICON_NAMES } from '../components/base/icons.js'

const draft = ref(ICONS.home.join('\n'))
const activeName = ref('home')
const size = ref(64)
const strokeWidth = ref(1.8)
const color = ref('var(--text)')
const viewBox = ref('0 0 24 24')
const filled = ref(false)
const search = ref('')
const copied = ref(false)

const parsedPaths = computed(() =>
  draft.value.split('\n').map((s) => s.trim()).filter(Boolean)
)
const fillValue = computed(() => (filled.value ? color.value : 'none'))
const colorHex = computed(() => (color.value.startsWith('#') ? color.value : '#3a322a'))

const filteredNames = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? ICON_NAMES.filter((n) => n.includes(q)) : ICON_NAMES
})

const svgCode = computed(() => {
  const paths = parsedPaths.value
    .map((d) => `  <path d="${d}" />`)
    .join('\n')
  return `<svg width="${size.value}" height="${size.value}" viewBox="${viewBox.value}" fill="${fillValue.value}" stroke="${color.value}" stroke-width="${strokeWidth.value}" stroke-linecap="round" stroke-linejoin="round">\n${paths}\n</svg>`
})

function loadIcon(name) {
  activeName.value = name
  draft.value = ICONS[name].join('\n')
}

function onColor(e) {
  color.value = e.target.value
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(svgCode.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <div class="studio">
    <AppHeader />
    <main class="studio__main">
      <h1 class="studio__title">图标工作室</h1>
      <p class="studio__hint">
        点选下方内置图标载入编辑器，或直接在左侧输入 path（每行一段 d）绘制，右侧实时预览。
        改色 / 改尺寸对所有图标生效，画好后复制 SVG 代码即可使用。
      </p>

      <BaseCard class="studio__lib">
        <div class="studio__lib-head">
          <h2 class="studio__h2">内置图标库（{{ ICON_NAMES.length }}）</h2>
          <BaseInput v-model="search" placeholder="搜索图标名" class="studio__search" />
        </div>
        <div class="studio__grid">
          <button
            v-for="name in filteredNames"
            :key="name"
            type="button"
            class="studio__cell"
            :class="{ 'is-active': activeName === name }"
            @click="loadIcon(name)"
          >
            <BaseIcon :name="name" :size="28" color="var(--text)" />
            <span class="studio__cell-name">{{ name }}</span>
          </button>
        </div>
      </BaseCard>

      <div class="studio__work">
        <BaseCard class="studio__edit">
          <h2 class="studio__h2">绘制 / 编辑</h2>
          <label class="studio__label">path（每行一段 d）</label>
          <textarea v-model="draft" class="studio__area" spellcheck="false" rows="10" />

          <div class="studio__controls">
            <BaseInput v-model="size" label="尺寸" type="number" />
            <BaseInput v-model="strokeWidth" label="线宽" type="number" step="0.1" />
            <div class="studio__ctrl">
              <label class="studio__label">颜色</label>
              <div class="studio__color">
                <input type="color" :value="colorHex" @input="onColor" />
                <input v-model="color" class="studio__color-text" />
              </div>
            </div>
            <BaseInput v-model="viewBox" label="viewBox" />
            <label class="studio__check">
              <input type="checkbox" v-model="filled" /> 实心填充
            </label>
          </div>
        </BaseCard>

        <BaseCard class="studio__preview">
          <h2 class="studio__h2">预览</h2>
          <div class="studio__stage">
            <BaseIcon
              :paths="parsedPaths"
              :size="size"
              :color="color"
              :stroke-width="strokeWidth"
              :view-box="viewBox"
              :fill="fillValue"
            />
          </div>
          <h3 class="studio__h3">SVG 代码</h3>
          <pre class="studio__code">{{ svgCode }}</pre>
          <BaseButton type="primary" @click="copyCode">
            {{ copied ? '已复制 ✓' : '复制 SVG 代码' }}
          </BaseButton>
        </BaseCard>
      </div>
    </main>
  </div>
</template>

<style scoped>
.studio {
  min-height: 100vh;
}
.studio__main {
  max-width: 1100px;
  margin: 0 auto;
  padding: 28px 20px 60px;
}
.studio__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 30px;
  color: var(--text);
}
.studio__hint {
  margin: 8px 0 22px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.7;
}
.studio__h2 {
  margin: 0 0 14px;
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--text);
}
.studio__lib {
  margin-bottom: 20px;
}
.studio__lib-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.studio__lib-head .studio__h2 {
  margin: 0;
}
.studio__search {
  width: 200px;
}
.studio__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 10px;
}
.studio__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 6px;
  border: 1px solid rgba(120, 90, 50, 0.12);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 12px;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.studio__cell:hover {
  border-color: var(--primary);
  background: rgba(201, 116, 59, 0.06);
}
.studio__cell.is-active {
  border-color: var(--primary);
  background: rgba(201, 116, 59, 0.1);
}
.studio__cell-name {
  color: var(--muted);
}
.studio__work {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.studio__label {
  display: block;
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 13px;
}
.studio__area {
  width: 100%;
  resize: vertical;
  padding: 12px;
  border: 1px solid rgba(120, 90, 50, 0.16);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
}
.studio__area:focus {
  outline: none;
  border-color: var(--primary);
}
.studio__controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 16px;
  align-items: end;
}
.studio__ctrl {
  grid-column: span 2;
}
.studio__color {
  display: flex;
  align-items: center;
  gap: 10px;
}
.studio__color input[type='color'] {
  width: 42px;
  height: 38px;
  padding: 0;
  border: 1px solid rgba(120, 90, 50, 0.16);
  border-radius: 10px;
  background: none;
  cursor: pointer;
}
.studio__color-text {
  flex: 1;
  height: 38px;
  padding: 0 12px;
  border: 1px solid rgba(120, 90, 50, 0.16);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
}
.studio__color-text:focus {
  outline: none;
  border-color: var(--primary);
}
.studio__check {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  font-size: 14px;
  grid-column: span 2;
}
.studio__stage {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  padding: 20px;
  border: 1px dashed rgba(120, 90, 50, 0.2);
  border-radius: var(--radius);
  background: var(--bg);
}
.studio__h3 {
  margin: 18px 0 8px;
  font-size: 15px;
  color: var(--text);
}
.studio__code {
  margin: 0 0 16px;
  padding: 14px;
  border-radius: var(--radius);
  background: #2c2620;
  color: #f0e6d6;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-x: auto;
}

@media (max-width: 820px) {
  .studio__work {
    grid-template-columns: 1fr;
  }
}
</style>
