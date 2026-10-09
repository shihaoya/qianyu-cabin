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
            <table
              v-if="data.logs.length"
              class="mb-table"
            >
              <thead>
                <tr>
                  <th>时间</th>
                  <th>类型</th>
                  <th>变动</th>
                  <th>余额</th>
                  <th>理由</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="log in data.logs"
                  :key="log.id"
                >
                  <td>{{ fmtTime(log.createdAt) }}</td>
                  <td>{{ log.typeName }}</td>
                  <td :class="log.delta > 0 ? 'is-add' : 'is-sub'">
                    {{ log.delta > 0 ? `+${log.delta}` : log.delta }}
                  </td>
                  <td>{{ log.balance }}</td>
                  <td>{{ log.reason }}</td>
                </tr>
              </tbody>
            </table>
            <p
              v-else
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
  max-width: 900px;
  margin: 0 auto;
  padding: 28px 20px 48px;
}
.mb-title {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: 30px;
  color: var(--text);
}
.mb-sub {
  margin: 0 0 16px;
  color: var(--muted);
  font-size: 14px;
}
.mb-error {
  margin: 0 0 14px;
  color: #c0392b;
  font-size: 14px;
}
.mb-empty {
  margin: 16px 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.8;
}
.mb-empty--inline {
  margin: 10px 0;
}

.mb-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 26px;
}
.mb-card {
  padding: 14px 16px;
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
  gap: 10px;
}
.mb-card__name {
  font-weight: 600;
  font-size: 16px;
  color: var(--text);
}
.mb-card__amount b {
  font-family: var(--font-display);
  font-size: 24px;
  color: var(--primary);
}
.mb-card.is-zero .mb-card__amount b {
  color: var(--muted);
}
.mb-card__desc {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}

.mb-logs__title {
  margin: 0 0 10px;
  color: var(--text);
  font-size: 16px;
}
/* 记录区定高滚动：记录多也不会把页面拉得很长 */
.mb-logs {
  max-height: 300px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid rgba(120, 90, 50, 0.12);
  border-radius: 12px;
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 90, 50, 0.28) transparent;
}
.mb-logs::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.mb-logs::-webkit-scrollbar-track {
  background: transparent;
}
.mb-logs::-webkit-scrollbar-thumb {
  background: rgba(120, 90, 50, 0.28);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.mb-logs::-webkit-scrollbar-thumb:hover {
  background: rgba(120, 90, 50, 0.45);
  background-clip: content-box;
}
.mb-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.mb-table th,
.mb-table td {
  padding: 9px 10px;
  text-align: left;
  border-bottom: 1px solid rgba(120, 90, 50, 0.12);
  color: var(--text);
}
.mb-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--surface);
  box-shadow: inset 0 -1px 0 rgba(120, 90, 50, 0.18);
  color: var(--muted);
  font-weight: 600;
}
.mb-table tr:last-child td {
  border-bottom: none;
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
