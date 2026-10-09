<script setup>
import { ref, computed, onMounted } from 'vue'
import AppHeader from '../components/base/AppHeader.vue'
import { getMyBenefits } from '../api/benefits.js'

// 我的福利：按当前登录账号反查绑定的粉丝档案，只读展示自己的卡与记录
const loading = ref(true)
const error = ref('')
const data = ref({ bound: false, nickname: null, cards: [], logs: [] })

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await getMyBenefits()
    data.value = res || { bound: false, nickname: null, cards: [], logs: [] }
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function fmtTime(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const heldCount = computed(() => (data.value.cards || []).filter((c) => c.amount > 0).length)

onMounted(load)
</script>

<template>
  <div class="page">
    <AppHeader />
    <main class="page__main">
      <section class="qy-rise">
        <h1 class="mb-title">
          我的福利
        </h1>
        <p class="mb-sub">
          管理员发放给你的卡，都会出现在这里
        </p>
        <p
          v-if="error"
          class="mb-error"
        >
          {{ error }}
        </p>
        <p
          v-else-if="loading"
          class="mb-empty"
        >
          正在加载…
        </p>

        <!-- 账号未绑定粉丝档案：不算错误，给友好提示 -->
        <template v-else-if="!data.bound">
          <p class="mb-empty">
            你的账号还未维护福利。
          </p>
        </template>

        <template v-else>
          <p class="mb-sub">
            已持有 {{ heldCount }} 种福利
          </p>

          <div class="mb-cards">
            <article
              v-for="card in data.cards"
              :key="card.typeId"
              class="mb-card"
              :class="{ 'is-zero': card.amount === 0 }"
            >
              <div class="mb-card__head">
                <span class="mb-card__name">{{ card.typeName }}</span>
                <span class="mb-card__amount">
                  <b>{{ card.amount }}</b> 张
                </span>
              </div>
              <p
                v-if="card.description"
                class="mb-card__desc"
              >
                {{ card.description }}
              </p>
            </article>
            <p
              v-if="!data.cards.length"
              class="mb-empty"
            >
              还没有任何福利类型，等管理员添加后这里会显示。
            </p>
          </div>

          <h2 class="mb-logs__title">
            发放记录
          </h2>
          <div class="mb-logs">
            <div
              v-for="log in data.logs"
              :key="log.id"
              class="mb-log"
            >
              <div class="mb-log__head">
                <span class="mb-log__type">{{ log.typeName }}</span>
                <span
                  class="mb-log__delta"
                  :class="log.delta > 0 ? 'is-add' : 'is-sub'"
                >
                  {{ log.delta > 0 ? `+${log.delta}` : log.delta }}
                </span>
                <span class="mb-log__balance">余 {{ log.balance }}</span>
              </div>
              <div class="mb-log__meta">
                {{ fmtTime(log.createdAt) }} · {{ log.reason }}
              </div>
            </div>
            <p
              v-if="!data.logs.length"
              class="mb-empty mb-empty--inline"
            >
              还没有发放记录
            </p>
          </div>
        </template>
      </section>
    </main>
  </div>
</template>

<style scoped>
.page__main {
  padding: 18px 16px calc(28px + env(safe-area-inset-bottom));
}
.mb-title {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: 24px;
  color: var(--text);
}
.mb-sub {
  margin: 0 0 14px;
  color: var(--muted);
  font-size: 13px;
}
.mb-error {
  margin: 0 0 12px;
  color: #c0392b;
  font-size: 13px;
}
.mb-empty {
  margin: 14px 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.8;
}
.mb-empty--inline {
  margin: 10px 0;
}

.mb-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  margin-bottom: 22px;
}
.mb-card {
  padding: 12px 14px;
  background: var(--surface);
  border: 1px solid transparent;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
.mb-card.is-zero {
  background: var(--bg);
  box-shadow: none;
  border-color: rgba(120, 90, 50, 0.12);
  opacity: 0.75;
}
.mb-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.mb-card__name {
  font-weight: 600;
  font-size: 15px;
  color: var(--text);
}
.mb-card__amount b {
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--primary);
}
.mb-card.is-zero .mb-card__amount b {
  color: var(--muted);
}
.mb-card__desc {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}

.mb-logs__title {
  margin: 0 0 10px;
  color: var(--text);
  font-size: 15px;
}
/* 记录区定高滚动：记录多也不会把页面拉得很长 */
.mb-logs {
  max-height: 40vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 2px;
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 90, 50, 0.28) transparent;
}
.mb-logs::-webkit-scrollbar {
  width: 6px;
}
.mb-logs::-webkit-scrollbar-track {
  background: transparent;
}
.mb-logs::-webkit-scrollbar-thumb {
  background: rgba(120, 90, 50, 0.3);
  border-radius: 999px;
}
.mb-log {
  padding: 10px 12px;
  margin-bottom: 8px;
  border-radius: 12px;
  background: var(--bg);
}
.mb-log__head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.mb-log__type {
  font-weight: 600;
  font-size: 14px;
}
.mb-log__balance {
  margin-left: auto;
  color: var(--muted);
  font-size: 12px;
}
.mb-log__meta {
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
}
.is-add {
  color: var(--accent);
  font-weight: 600;
}
.is-sub {
  color: #d9534f;
  font-weight: 600;
}
</style>
