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
</style>
