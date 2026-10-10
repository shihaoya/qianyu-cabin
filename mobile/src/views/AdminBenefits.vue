<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  listBenefitTypes,
  createBenefitType,
  updateBenefitType,
  deleteBenefitType,
  listFans,
  createFan,
  updateFan,
  deleteFan,
  adjustFanCard,
  getFanLogs,
  listReasons,
  createReason,
  updateReason,
  deleteReason,
} from '../api/benefits.js'
import { listUsers } from '../api/admin.js'
import AppHeader from '../components/base/AppHeader.vue'
import BaseButton from '../components/base/BaseButton.vue'
import BaseInput from '../components/base/BaseInput.vue'
import BaseModal from '../components/base/BaseModal.vue'
import { confirm } from '../composables/useConfirm.js'

// ---------- 列表 ----------
const fans = ref([])
const total = ref(0)
const keyword = ref('')
const loading = ref(false)
const error = ref('')

// ---------- 福利类型 ----------
const types = ref([])
const showTypes = ref(false)
const typeDraft = ref({ name: '', description: '' })
const editingTypeId = ref(null)
const editingTypeDraft = ref({ name: '', description: '' })
const typeSaving = ref(false)
const typeError = ref('')

// ---------- 粉丝编辑 ----------
const accountOptions = ref([])
const fanEditor = ref(null) // { id?, nickname, userId, douyinAccount, remark }
const fanSaving = ref(false)
const fanError = ref('')
const fanNicknameTouched = ref(false)

// ---------- 常用理由 ----------
// type：common 公共（增减都可选）/ add 仅增加 / sub 仅减少，取值与服务端一致
const REASON_TYPE_OPTIONS = [
  { value: 'common', label: '公共理由' },
  { value: 'add', label: '增加理由' },
  { value: 'sub', label: '减少理由' },
]
const REASON_TYPE_LABEL = { common: '公共', add: '增加', sub: '减少' }
const reasons = ref([])
const showReasons = ref(false)
const reasonDraft = ref({ text: '', type: 'common' })
const editingReasonId = ref(null)
const editingReasonDraft = ref({ text: '', type: 'common' })
const reasonSaving = ref(false)
const reasonError = ref('')

// ---------- 详情面板（点粉丝卡片进入，替代 PC 的左列 + 右详情） ----------
const selectedId = ref(null)
const detailLogs = ref([]) // 选中粉丝的全部记录（所有类型）
const logsLoading = ref(false)
const logsTruncated = ref(false)

// ---------- 增减面板（增加 / 减少各自独立） ----------
const adjustTarget = ref(null) // { fanId, nickname, typeId, typeName, amount, direction }
const adjustDraft = ref({ amount: '1', reason: '' })
const adjusting = ref(false)
const adjustError = ref('')

// ---------- 记录面板（只看该粉丝这一张卡） ----------
const logsTarget = ref(null) // { fanId, nickname, typeId, typeName }
const logs = ref([])
const logsError = ref('')
const logsListLoading = ref(false)

const PAGE_SIZE = 50
// 记录最多展示多少条；超出只取最近这些，防止一次性拉爆
const MAX_LOGS = 300

const currentFan = computed(() => fans.value.find((f) => f.id === selectedId.value) || null)

async function loadFans() {
  loading.value = true
  error.value = ''
  try {
    const data = await listFans({ page: 1, pageSize: PAGE_SIZE, keyword: keyword.value })
    fans.value = data.list || []
    total.value = data.total || 0
    // 选中的人被搜掉/删掉时收起详情回到列表；不默认展开第一位
    if (!fans.value.some((f) => f.id === selectedId.value)) {
      selectedId.value = null
      detailLogs.value = []
    }
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function loadTypes() {
  const data = await listBenefitTypes()
  types.value = data.list || []
}

async function loadAccounts() {
  const data = await listUsers({ page: 1, pageSize: 200 })
  accountOptions.value = data.list || []
}

async function loadReasons() {
  const data = await listReasons()
  reasons.value = data.list || []
}

onMounted(async () => {
  await loadAccounts()
  await Promise.all([loadFans(), loadTypes(), loadReasons()])
})

// 某粉丝某一福利类型的剩余张数（未持有就是 0）
function amountOf(fan, typeId) {
  const card = (fan.cards || []).find((c) => c.typeId === typeId)
  return card ? card.amount : 0
}

// 行数据（沿用 openAdjust / openLogs 的入参形状）
function rowOf(fan, t) {
  return { typeId: t.id, typeName: t.name, amount: amountOf(fan, t.id) }
}

// 头像取昵称最后一个字符（中文取尾字、英文名取首字母习惯上用首字，这里统一按需求取尾字）
function lastChar(name) {
  const s = (name || '').trim()
  return s ? [...s].slice(-1)[0] : '?'
}

function accountText(fan) {
  return [fan.systemAccount && `站内 ${fan.systemAccount}`, fan.douyinAccount && `抖音 ${fan.douyinAccount}`]
    .filter(Boolean)
    .join(' · ')
}

// 卡片尾部显示「几种有卡」
function heldKinds(fan) {
  return (fan.cards || []).filter((c) => (c.amount || 0) > 0).length
}

// 切换选中粉丝：详情面板跟着换，并拉取其全部记录
function selectFan(fan) {
  selectedId.value = fan ? fan.id : null
  detailLogs.value = []
  logsTruncated.value = false
  if (fan) loadFanLogs(fan.id)
}

function backToList() {
  selectedId.value = null
  detailLogs.value = []
}

// 接口每页最多 50 条，翻到拿完（或到 MAX_LOGS 上限）为止，保证看到的是全部记录
async function loadFanLogs(fanId) {
  logsLoading.value = true
  try {
    let page = 1
    let collected = []
    let serverTotal = 0
    for (;;) {
      const data = await getFanLogs(fanId, { page, pageSize: 50 })
      serverTotal = data.total || 0
      collected = collected.concat(data.list || [])
      if (collected.length >= Math.min(serverTotal, MAX_LOGS)) break
      if (!(data.list || []).length) break
      page += 1
    }
    detailLogs.value = collected.slice(0, MAX_LOGS)
    logsTruncated.value = serverTotal > MAX_LOGS
  } catch {
    detailLogs.value = []
  } finally {
    logsLoading.value = false
  }
}

// ---------- 福利类型弹窗 ----------
async function openTypes() {
  typeError.value = ''
  typeDraft.value = { name: '', description: '' }
  editingTypeId.value = null
  showTypes.value = true
  try {
    await loadTypes()
  } catch (e) {
    typeError.value = e.message || '加载失败'
  }
}

async function submitType() {
  if (typeSaving.value) return
  const name = typeDraft.value.name.trim()
  if (!name) {
    typeError.value = '类型名称不能为空'
    return
  }
  typeSaving.value = true
  typeError.value = ''
  try {
    await createBenefitType({ name, description: typeDraft.value.description })
    typeDraft.value = { name: '', description: '' }
    await loadTypes()
  } catch (e) {
    typeError.value = e.message || '新增失败'
  } finally {
    typeSaving.value = false
  }
}

function startEditType(t) {
  editingTypeId.value = t.id
  editingTypeDraft.value = { name: t.name, description: t.description || '' }
  typeError.value = ''
}

async function saveEditType() {
  if (typeSaving.value || editingTypeId.value === null) return
  const name = editingTypeDraft.value.name.trim()
  if (!name) {
    typeError.value = '类型名称不能为空'
    return
  }
  typeSaving.value = true
  typeError.value = ''
  try {
    await updateBenefitType(editingTypeId.value, {
      name,
      description: editingTypeDraft.value.description,
    })
    editingTypeId.value = null
    await Promise.all([loadTypes(), loadFans()])
  } catch (e) {
    typeError.value = e.message || '保存失败'
  } finally {
    typeSaving.value = false
  }
}

async function removeType(t) {
  if (t.holderCount > 0) return
  const ok = await confirm({
    title: '删除福利类型',
    message: `确定删除「${t.name}」吗？该操作不可撤销。`,
  })
  if (!ok) return
  typeError.value = ''
  try {
    await deleteBenefitType(t.id)
    await loadTypes()
  } catch (e) {
    typeError.value = e.message || '删除失败'
  }
}

// ---------- 常用理由弹窗 ----------
async function openReasons() {
  reasonError.value = ''
  reasonDraft.value = { text: '', type: 'common' }
  editingReasonId.value = null
  showReasons.value = true
  try {
    await loadReasons()
  } catch (e) {
    reasonError.value = e.message || '加载失败'
  }
}

async function submitReason() {
  if (reasonSaving.value) return
  const text = reasonDraft.value.text.trim()
  if (!text) {
    reasonError.value = '理由内容不能为空'
    return
  }
  reasonSaving.value = true
  reasonError.value = ''
  try {
    await createReason({ text, type: reasonDraft.value.type })
    reasonDraft.value = { text: '', type: reasonDraft.value.type }
    await loadReasons()
  } catch (e) {
    reasonError.value = e.message || '新增失败'
  } finally {
    reasonSaving.value = false
  }
}

function startEditReason(r) {
  editingReasonId.value = r.id
  editingReasonDraft.value = { text: r.text, type: r.type || 'common' }
  reasonError.value = ''
}

async function saveEditReason() {
  if (reasonSaving.value || editingReasonId.value === null) return
  const text = editingReasonDraft.value.text.trim()
  if (!text) {
    reasonError.value = '理由内容不能为空'
    return
  }
  reasonSaving.value = true
  reasonError.value = ''
  try {
    await updateReason(editingReasonId.value, {
      text,
      type: editingReasonDraft.value.type,
    })
    editingReasonId.value = null
    await loadReasons()
  } catch (e) {
    reasonError.value = e.message || '保存失败'
  } finally {
    reasonSaving.value = false
  }
}

async function removeReason(r) {
  const ok = await confirm({
    title: '删除常用理由',
    message: `确定删除「${r.text}」吗？已写入增减记录的理由不受影响。`,
  })
  if (!ok) return
  reasonError.value = ''
  try {
    await deleteReason(r.id)
    await loadReasons()
  } catch (e) {
    reasonError.value = e.message || '删除失败'
  }
}

// ---------- 粉丝编辑 ----------
function openCreateFan() {
  fanError.value = ''
  fanNicknameTouched.value = false
  fanEditor.value = { nickname: '', userId: '', douyinAccount: '', remark: '' }
}

function openEditFan(fan) {
  fanError.value = ''
  fanNicknameTouched.value = false
  fanEditor.value = {
    id: fan.id,
    nickname: fan.nickname,
    userId: fan.userId === null || fan.userId === undefined ? '' : fan.userId,
    douyinAccount: fan.douyinAccount || '',
    remark: fan.remark || '',
  }
}

const nicknameError = computed(() => {
  if (!fanNicknameTouched.value || !fanEditor.value) return ''
  return fanEditor.value.nickname.trim() ? '' : '昵称必填'
})

async function saveFan() {
  fanNicknameTouched.value = true
  if (!fanEditor.value || !fanEditor.value.nickname.trim()) return
  const editor = fanEditor.value
  fanSaving.value = true
  fanError.value = ''
  try {
    const payload = {
      nickname: editor.nickname.trim(),
      userId: editor.userId === '' ? null : editor.userId,
      douyinAccount: editor.douyinAccount,
      remark: editor.remark,
    }
    if (editor.id) await updateFan(editor.id, payload)
    else await createFan(payload)
    fanEditor.value = null
    await loadFans()
  } catch (e) {
    fanError.value = e.message || '保存失败'
  } finally {
    fanSaving.value = false
  }
}

async function removeFan(fan) {
  const ok = await confirm({
    title: '删除粉丝',
    message: `确定删除「${fan.nickname}」吗？其持有的卡会被清空，增减记录保留。`,
  })
  if (!ok) return
  error.value = ''
  try {
    await deleteFan(fan.id)
    // 从详情面板删除时先退回列表，避免详情区指向已删除的人
    if (selectedId.value === fan.id) selectedId.value = null
    await loadFans()
  } catch (e) {
    error.value = e.message || '删除失败'
  }
}

// ---------- 增减面板（点福利块上的 ＋ / － 打开） ----------
function openAdjust(fan, row, direction) {
  if (direction === 'sub' && row.amount <= 0) return
  adjustError.value = ''
  adjustDraft.value = { amount: '1', reason: '' }
  adjustTarget.value = {
    fanId: fan.id,
    nickname: fan.nickname,
    typeId: row.typeId,
    typeName: row.typeName,
    amount: row.amount,
    direction,
  }
}

// 当前方向可选的常用理由：公共理由 + 该方向专用理由
const adjustReasons = computed(() => {
  if (!adjustTarget.value) return []
  const dir = adjustTarget.value.direction
  return reasons.value.filter((r) => (r.type || 'common') === 'common' || (r.type || 'common') === dir)
})

// 点一下带入理由，再点一下取消（避免误选后要手动清空）
function pickReason(text) {
  adjustDraft.value.reason = adjustDraft.value.reason === text ? '' : text
}

async function submitAdjust() {
  const target = adjustTarget.value
  if (!target || adjusting.value) return
  const amount = Number(adjustDraft.value.amount)
  if (!Number.isInteger(amount) || amount <= 0) {
    adjustError.value = '数量必须是大于 0 的整数'
    return
  }
  const note = adjustDraft.value.reason.trim()
  if (!note) {
    adjustError.value = '请填写理由'
    return
  }
  adjusting.value = true
  adjustError.value = ''
  try {
    await adjustFanCard(target.fanId, {
      typeId: target.typeId,
      delta: target.direction === 'add' ? amount : -amount,
      reason: note,
    })
    adjustTarget.value = null
    await loadFans()
    // 详情面板的数量与记录跟着刷新
    if (selectedId.value) await loadFanLogs(target.fanId)
  } catch (e) {
    adjustError.value = e.message || '调整失败'
  } finally {
    adjusting.value = false
  }
}

// ---------- 记录面板（只看该粉丝这一张卡） ----------
async function openLogs(fan, row) {
  logsTarget.value = {
    fanId: fan.id,
    nickname: fan.nickname,
    typeId: row.typeId,
    typeName: row.typeName,
  }
  logs.value = []
  logsError.value = ''
  logsListLoading.value = true
  try {
    // 与详情面板一致：翻完所有页再按类型过滤，保证「记录」面板里也是全量
    let page = 1
    let collected = []
    for (;;) {
      const data = await getFanLogs(fan.id, { page, pageSize: 50 })
      collected = collected.concat(data.list || [])
      if (collected.length >= (data.total || 0)) break
      if (!(data.list || []).length) break
      page += 1
    }
    logs.value = collected.filter((log) => log.typeId === row.typeId)
  } catch (e) {
    logsError.value = e.message || '加载失败'
  } finally {
    logsListLoading.value = false
  }
}

function fmtTime(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <div class="page">
    <AppHeader />
    <main class="page__main">
      <section class="qy-rise">
        <h1 class="ab-title">
          福利管理
        </h1>
        <p class="ab-sub">
          共 {{ total }} 位粉丝 · 仅管理员与开发管理员可见
        </p>
        <p
          v-if="error"
          class="ab-error"
        >
          {{ error }}
        </p>

        <div class="ab-search">
          <input
            v-model="keyword"
            class="ab-search__input"
            placeholder="搜索昵称 / 抖音号 / 系统内账号"
            @keyup.enter="loadFans"
          >
          <BaseButton
            type="primary"
            @click="loadFans"
          >
            搜索
          </BaseButton>
        </div>

        <div class="ab-actions">
          <BaseButton
            type="default"
            title="管理福利类型"
            @click="openTypes"
          >
            福利类型
          </BaseButton>
          <BaseButton
            type="default"
            title="管理常用理由"
            @click="openReasons"
          >
            常用理由
          </BaseButton>
          <BaseButton
            type="primary"
            @click="openCreateFan"
          >
            + 新增粉丝
          </BaseButton>
        </div>

        <!-- 粉丝列表：点卡片进入详情面板（对应 PC 的左列表 + 右详情） -->
        <div
          v-if="!currentFan"
          class="ab-list-wrap"
        >
          <div class="ab-list">
            <p
              v-if="loading"
              class="ab-empty"
            >
              正在加载…
            </p>
            <template v-else-if="fans.length">
              <button
                v-for="fan in fans"
                :key="fan.id"
                type="button"
                class="ab-person"
                @click="selectFan(fan)"
              >
                <span class="ab-person__top">
                  <span class="ab-avatar">{{ lastChar(fan.nickname) }}</span>
                  <span class="ab-person__main">
                    <b class="ab-person__name">{{ fan.nickname }}</b>
                    <small class="ab-person__count">{{ heldKinds(fan) }} 种有卡</small>
                  </span>
                  <span
                    class="ab-person__arrow"
                    aria-hidden="true"
                  >›</span>
                </span>
                <small
                  v-if="accountText(fan)"
                  class="ab-person__accounts"
                >{{ accountText(fan) }}</small>
              </button>
            </template>
            <p
              v-else
              class="ab-empty"
            >
              {{ keyword ? '没有匹配的粉丝' : '还没有粉丝，点上面「新增粉丝」开始吧' }}
            </p>
          </div>
        </div>

        <!-- 详情面板：选中粉丝的福利与操作（对应 PC 右侧详情区） -->
        <div
          v-else
          class="ab-detail"
        >
          <div class="ab-detail__head">
            <button
              class="ab-back"
              type="button"
              aria-label="返回列表"
              @click="backToList"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M15 5l-7 7 7 7"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            <span class="ab-avatar">{{ lastChar(currentFan.nickname) }}</span>
            <span class="ab-detail__who">
              <b>{{ currentFan.nickname }}</b>
              <small>{{ accountText(currentFan) || '未关联账号' }}</small>
            </span>
            <span class="ab-detail__ops">
              <button
                class="ab-icon-btn"
                type="button"
                title="编辑资料"
                aria-label="编辑资料"
                @click="openEditFan(currentFan)"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 20h4L20 8a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20z"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M14.5 6.5 17.5 9.5"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
              <button
                class="ab-icon-btn is-danger"
                type="button"
                title="删除粉丝"
                aria-label="删除粉丝"
                @click="removeFan(currentFan)"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M5 7h14M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M6.5 7l1 12a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1l1-12"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M10.5 11v6M13.5 11v6"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </span>
          </div>

          <div class="ab-benefits">
            <template v-if="types.length">
              <div
                v-for="t in types"
                :key="t.id"
                class="ab-benefit"
                :class="{ 'is-zero': amountOf(currentFan, t.id) === 0 }"
              >
                <span class="ab-benefit__num">{{ amountOf(currentFan, t.id) }}</span>
                <span class="ab-benefit__meta">
                  <b>{{ t.name }}</b>
                  <small>{{ t.description || '暂无说明' }}</small>
                </span>
                <span class="ab-benefit__ops">
                  <button
                    class="ab-op"
                    type="button"
                    title="增加"
                    aria-label="增加"
                    @click="openAdjust(currentFan, rowOf(currentFan, t), 'add')"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M12 5v14M5 12h14"
                        stroke="currentColor"
                        stroke-width="2.4"
                        stroke-linecap="round"
                      />
                    </svg>
                  </button>
                  <button
                    class="ab-op"
                    type="button"
                    title="减少"
                    aria-label="减少"
                    :disabled="amountOf(currentFan, t.id) <= 0"
                    @click="openAdjust(currentFan, rowOf(currentFan, t), 'sub')"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M5 12h14"
                        stroke="currentColor"
                        stroke-width="2.4"
                        stroke-linecap="round"
                      />
                    </svg>
                  </button>
                  <button
                    class="ab-op"
                    type="button"
                    title="增减记录"
                    aria-label="增减记录"
                    @click="openLogs(currentFan, rowOf(currentFan, t))"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M8 6h12M8 12h12M8 18h12"
                        stroke="currentColor"
                        stroke-width="2.2"
                        stroke-linecap="round"
                      />
                      <circle
                        cx="4"
                        cy="6"
                        r="1.4"
                        fill="currentColor"
                      />
                      <circle
                        cx="4"
                        cy="12"
                        r="1.4"
                        fill="currentColor"
                      />
                      <circle
                        cx="4"
                        cy="18"
                        r="1.4"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </span>
              </div>
            </template>
            <p
              v-else
              class="ab-empty ab-empty--inline"
            >
              还没有福利类型，先去「管理福利类型」添加一个
            </p>
          </div>

          <div class="ab-recent">
            <h4 class="ab-recent__title">
              全部记录<template v-if="detailLogs.length">
                （{{ detailLogs.length }} 条）
              </template>
            </h4>
            <p
              v-if="logsLoading"
              class="ab-empty ab-empty--inline"
            >
              正在加载…
            </p>
            <div
              v-else-if="detailLogs.length"
              class="ab-logs"
            >
              <div
                v-for="log in detailLogs"
                :key="log.id"
                class="ab-log"
              >
                <div class="ab-log__head">
                  <span
                    class="ab-log__delta"
                    :class="log.delta > 0 ? 'is-add' : 'is-sub'"
                  >
                    {{ log.delta > 0 ? `+${log.delta}` : log.delta }}
                  </span>
                  <span class="ab-log__type">{{ log.typeName }}</span>
                  <span class="ab-log__balance">余 {{ log.balance }}</span>
                </div>
                <div class="ab-log__meta">
                  {{ fmtTime(log.createdAt) }} · {{ log.reason }} · {{ log.operatorName || '未知操作人' }}
                </div>
              </div>
            </div>
            <p
              v-else
              class="ab-empty ab-empty--inline"
            >
              还没有增减记录
            </p>
            <p
              v-if="logsTruncated"
              class="ab-hint"
            >
              记录过多，这里显示最近 {{ MAX_LOGS }} 条；更早的可用每个福利上的「记录」按钮查看。
            </p>
          </div>
        </div>
      </section>
    </main>

    <!-- 福利类型管理 -->
    <transition name="ab-slide">
      <BaseModal
        v-if="showTypes"
        title="福利类型管理"
        @close="showTypes = false"
      >
        <p
          v-if="typeError"
          class="ab-error"
        >
          {{ typeError }}
        </p>
        <div class="ab-typelist">
          <div
            v-for="t in types"
            :key="t.id"
            class="ab-typerow"
          >
            <template v-if="editingTypeId === t.id">
              <div class="ab-typerow__edit">
                <BaseInput
                  v-model="editingTypeDraft.name"
                  type="text"
                  placeholder="类型名称，如：加班卡"
                />
                <BaseInput
                  v-model="editingTypeDraft.description"
                  type="text"
                  placeholder="说明（选填），如：加班一次可用"
                />
              </div>
              <div class="ab-typerow__ops">
                <BaseButton
                  type="text"
                  @click="editingTypeId = null"
                >
                  取消
                </BaseButton>
                <BaseButton
                  type="primary"
                  :loading="typeSaving"
                  :disabled="typeSaving"
                  @click="saveEditType"
                >
                  保存
                </BaseButton>
              </div>
            </template>
            <template v-else>
              <div class="ab-typerow__main">
                <span class="ab-typerow__name">{{ t.name }}</span>
                <span class="ab-typerow__meta">
                  {{ t.description || '暂无说明' }} · {{ t.holderCount }} 位粉丝持有
                </span>
              </div>
              <div class="ab-typerow__ops">
                <BaseButton
                  type="text"
                  @click="startEditType(t)"
                >
                  编辑
                </BaseButton>
                <BaseButton
                  type="text"
                  :disabled="t.holderCount > 0"
                  @click="removeType(t)"
                >
                  删除
                </BaseButton>
              </div>
            </template>
          </div>
          <p
            v-if="!types.length"
            class="ab-empty ab-empty--inline"
          >
            还没有福利类型，在下面添加一个，比如「加班卡」
          </p>
        </div>

        <div class="ab-typecreate">
          <BaseInput
            v-model="typeDraft.name"
            type="text"
            placeholder="新类型名称，如：加班卡"
          />
          <BaseInput
            v-model="typeDraft.description"
            type="text"
            placeholder="说明（选填），如：加班一次可用"
          />
          <BaseButton
            type="primary"
            :loading="typeSaving"
            :disabled="typeSaving"
            @click="submitType"
          >
            添加
          </BaseButton>
        </div>
        <p class="ab-hint">
          已有粉丝持有该类型时不可删除，需先把他们的卡减到 0。
        </p>
      </BaseModal>
    </transition>

    <!-- 新增 / 编辑粉丝 -->
    <transition name="ab-slide">
      <BaseModal
        v-if="fanEditor"
        :title="fanEditor.id ? '编辑粉丝' : '新增粉丝'"
        @close="fanEditor = null"
      >
        <p
          v-if="fanError"
          class="ab-error"
        >
          {{ fanError }}
        </p>
        <div class="ab-form">
          <BaseInput
            v-model="fanEditor.nickname"
            label="昵称（必填）"
            type="text"
            placeholder="粉丝的昵称，例如：小羽"
            :error="nicknameError"
          />
          <label class="ab-field">
            <span class="ab-field__label">系统内账号（选填）</span>
            <select
              v-model="fanEditor.userId"
              class="ab-select"
            >
              <option value="">不关联</option>
              <option
                v-for="u in accountOptions"
                :key="u.id"
                :value="u.id"
              >
                {{ u.nickname }}
              </option>
            </select>
          </label>
          <BaseInput
            v-model="fanEditor.douyinAccount"
            label="抖音账号（选填）"
            type="text"
            placeholder="抖音号或抖音昵称"
          />
          <BaseInput
            v-model="fanEditor.remark"
            label="备注（选填）"
            type="text"
            placeholder="想记住的备注信息"
          />
        </div>
        <template #footer>
          <BaseButton
            type="text"
            @click="fanEditor = null"
          >
            取消
          </BaseButton>
          <BaseButton
            type="primary"
            :loading="fanSaving"
            :disabled="fanSaving"
            @click="saveFan"
          >
            保存
          </BaseButton>
        </template>
      </BaseModal>
    </transition>

    <!-- 常用理由管理 -->
    <transition name="ab-slide">
      <BaseModal
        v-if="showReasons"
        title="常用理由管理"
        @close="showReasons = false"
      >
        <p
          v-if="reasonError"
          class="ab-error"
        >
          {{ reasonError }}
        </p>
        <div class="ab-typelist">
          <div
            v-for="r in reasons"
            :key="r.id"
            class="ab-typerow"
          >
            <template v-if="editingReasonId === r.id">
              <div class="ab-typerow__edit">
                <BaseInput
                  v-model="editingReasonDraft.text"
                  type="text"
                  placeholder="理由内容，如：直播抽奖中奖"
                />
                <select
                  v-model="editingReasonDraft.type"
                  class="ab-select"
                  aria-label="理由类型"
                >
                  <option
                    v-for="opt in REASON_TYPE_OPTIONS"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </option>
                </select>
              </div>
              <div class="ab-typerow__ops">
                <BaseButton
                  type="text"
                  @click="editingReasonId = null"
                >
                  取消
                </BaseButton>
                <BaseButton
                  type="primary"
                  :loading="reasonSaving"
                  :disabled="reasonSaving"
                  @click="saveEditReason"
                >
                  保存
                </BaseButton>
              </div>
            </template>
            <template v-else>
              <div class="ab-typerow__main">
                <span class="ab-typerow__name">{{ r.text }}</span>
                <span
                  class="ab-reason-badge"
                  :class="`is-${r.type || 'common'}`"
                >{{ REASON_TYPE_LABEL[r.type || 'common'] }}</span>
              </div>
              <div class="ab-typerow__ops">
                <BaseButton
                  type="text"
                  @click="startEditReason(r)"
                >
                  编辑
                </BaseButton>
                <BaseButton
                  type="text"
                  @click="removeReason(r)"
                >
                  删除
                </BaseButton>
              </div>
            </template>
          </div>
          <p
            v-if="!reasons.length"
            class="ab-empty ab-empty--inline"
          >
            还没有常用理由，在下面添加一个，之后增减卡时点一下就能带入
          </p>
        </div>

        <div class="ab-typecreate">
          <BaseInput
            v-model="reasonDraft.text"
            type="text"
            placeholder="新的常用理由，如：活动奖励"
          />
          <select
            v-model="reasonDraft.type"
            class="ab-select"
            aria-label="新增理由类型"
          >
            <option
              v-for="opt in REASON_TYPE_OPTIONS"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
          <BaseButton
            type="primary"
            :loading="reasonSaving"
            :disabled="reasonSaving"
            @click="submitReason"
          >
            添加
          </BaseButton>
        </div>
        <p class="ab-hint">
          公共理由增加、减少时都能一键带入；增加理由只在点「＋」时出现，减少理由只在点「－」时出现。删除常用理由不影响已写入记录的理由文本。
        </p>
      </BaseModal>
    </transition>

    <!-- 增加 / 减少：只做这一件事 -->
    <transition name="ab-slide">
      <BaseModal
        v-if="adjustTarget"
        :title="(adjustTarget.direction === 'add' ? '增加 · ' : '减少 · ') + adjustTarget.typeName + ' · ' + adjustTarget.nickname"
        @close="adjustTarget = null"
      >
        <p
          v-if="adjustError"
          class="ab-error"
        >
          {{ adjustError }}
        </p>
        <div class="ab-adjust">
          <div class="ab-adjust__head">
            <span class="ab-adjust__name">{{ adjustTarget.typeName }}</span>
            <span class="ab-adjust__amount">现有 {{ adjustTarget.amount }} 张</span>
          </div>
          <label class="ab-field">
            <span class="ab-field__label">数量</span>
            <input
              v-model="adjustDraft.amount"
              class="ab-input"
              type="number"
              min="1"
              step="1"
            >
          </label>
          <BaseInput
            v-model="adjustDraft.reason"
            :label="adjustTarget.direction === 'add' ? '增加理由（必填）' : '减少理由（必填）'"
            type="text"
            placeholder="如：直播抽奖中奖"
          />
          <div
            v-if="adjustReasons.length"
            class="ab-chips"
          >
            <button
              v-for="r in adjustReasons"
              :key="r.id"
              type="button"
              class="ab-chip"
              :class="{ 'is-active': adjustDraft.reason === r.text }"
              :title="REASON_TYPE_LABEL[r.type || 'common'] + '理由'"
              @click="pickReason(r.text)"
            >
              {{ r.text }}
            </button>
          </div>
        </div>
        <template #footer>
          <BaseButton
            type="text"
            @click="adjustTarget = null"
          >
            取消
          </BaseButton>
          <BaseButton
            type="primary"
            :loading="adjusting"
            :disabled="adjusting"
            @click="submitAdjust"
          >
            {{ adjustTarget.direction === 'add' ? '增加' : '减少' }}
          </BaseButton>
        </template>
      </BaseModal>
    </transition>

    <!-- 记录：只看该粉丝这一张卡 -->
    <transition name="ab-slide">
      <BaseModal
        v-if="logsTarget"
        :title="`${logsTarget.typeName} · ${logsTarget.nickname} 记录`"
        @close="logsTarget = null"
      >
        <p
          v-if="logsError"
          class="ab-error"
        >
          {{ logsError }}
        </p>
        <p
          v-if="logsListLoading"
          class="ab-empty"
        >
          正在加载…
        </p>
        <div
          v-else-if="logs.length"
          class="ab-logs"
        >
          <div
            v-for="log in logs"
            :key="log.id"
            class="ab-log"
          >
            <div class="ab-log__head">
              <span
                class="ab-log__delta"
                :class="log.delta > 0 ? 'is-add' : 'is-sub'"
              >
                {{ log.delta > 0 ? `+${log.delta}` : log.delta }}
              </span>
              <span class="ab-log__balance">余 {{ log.balance }}</span>
            </div>
            <div class="ab-log__meta">
              {{ fmtTime(log.createdAt) }} · {{ log.reason }} · {{ log.operatorName || '未知操作人' }}
            </div>
          </div>
        </div>
        <p
          v-else
          class="ab-empty"
        >
          该类型还没有增减记录
        </p>
      </BaseModal>
    </transition>
  </div>
</template>

<style scoped>
.page__main {
  padding: 16px;
  display: flex;
  flex-direction: column;
  /* 减去顶部吸顶头（12px×2 + 36px + 1px 边框 = 61px），
     让列表精确占满 header 以下的剩余屏幕，整体不滚 */
  height: calc(100vh - 61px);
  box-sizing: border-box;
}
.page__main .qy-rise {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.ab-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 24px;
  color: var(--text);
}
.ab-sub {
  margin: 4px 0 14px;
  color: var(--muted);
  font-size: 13px;
}
.ab-error {
  margin: 0 0 12px;
  color: #d9534f;
  font-size: 13px;
}
.ab-hint {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}
.ab-empty {
  margin: 8px 0;
  color: var(--muted);
  font-size: 13px;
}
.ab-empty--inline {
  margin: 10px 0;
}

.ab-search {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.ab-search__input {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--primary-soft);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font: inherit;
}
/*
 * 操作按钮行：按钮按内容宽度收缩（之前 flex:1 三等分会把「管理福利类型」挤成两行，高矮不齐），
 * 文案缩短 + 不换行保证挤在一行；主操作「新增粉丝」靠右，次要管理入口在左。
 */
.ab-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.ab-actions :deep(.base-btn) {
  flex: 0 0 auto;
  padding: 8px 12px;
  min-height: 40px;
  font-size: 13px;
  white-space: nowrap;
}
.ab-actions :deep(.base-btn--primary) {
  margin-left: auto;
}

/* 粉丝列表：一列排开，点卡片进入详情面板；占满剩余屏幕高度 */
.ab-list-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 2px;
  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 90, 50, 0.28) transparent;
}
.ab-list-wrap::-webkit-scrollbar {
  width: 6px;
}
.ab-list-wrap::-webkit-scrollbar-track {
  background: transparent;
}
.ab-list-wrap::-webkit-scrollbar-thumb {
  background: rgba(120, 90, 50, 0.3);
  border-radius: 999px;
}
.ab-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ab-person {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 12px;
  border: 1px solid rgba(120, 90, 50, 0.12);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.ab-person:active {
  background: #fbf5ee;
}
.ab-person:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}
.ab-person__top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ab-person__main {
  flex: 1;
  min-width: 0;
}
.ab-person__name {
  display: block;
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ab-person__count {
  display: block;
  color: var(--muted);
  font-size: 12px;
}
.ab-person__arrow {
  flex: none;
  color: var(--muted);
  font-size: 20px;
  line-height: 1;
}
.ab-person__accounts {
  color: var(--muted);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 头像：昵称的最后一个字符 */
.ab-avatar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--primary-soft);
  color: var(--primary);
  font-family: var(--font-display);
  font-size: 18px;
  line-height: 1;
}

/* 详情面板（对应 PC 右侧详情区） */
.ab-detail {
  padding: 14px;
  background: var(--surface);
  border: 1px solid rgba(120, 90, 50, 0.12);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
.ab-detail__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(120, 90, 50, 0.12);
}
.ab-back {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}
.ab-back:active {
  background: rgba(201, 116, 59, 0.18);
  color: var(--primary);
}
.ab-back:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}
.ab-detail__who {
  flex: 1;
  min-width: 0;
}
.ab-detail__who b {
  display: block;
  font-size: 17px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ab-detail__who small {
  display: block;
  color: var(--muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ab-detail__ops {
  flex: none;
  display: flex;
  gap: 2px;
}
.ab-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}
.ab-icon-btn:active {
  background: rgba(201, 116, 59, 0.18);
  color: var(--primary);
}
.ab-icon-btn.is-danger:active {
  background: rgba(217, 83, 79, 0.16);
  color: #d9534f;
}
.ab-icon-btn:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}

/* 福利块：左边大号数量，右边三个操作 */
.ab-benefits {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
  max-height: 40vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 2px;
  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 90, 50, 0.28) transparent;
}
.ab-benefits::-webkit-scrollbar {
  width: 6px;
}
.ab-benefits::-webkit-scrollbar-track {
  background: transparent;
}
.ab-benefits::-webkit-scrollbar-thumb {
  background: rgba(120, 90, 50, 0.3);
  border-radius: 999px;
}
.ab-benefit {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(120, 90, 50, 0.1);
  border-radius: 12px;
  background: var(--bg);
}
.ab-benefit.is-zero {
  opacity: 0.6;
}
.ab-benefit__num {
  flex: none;
  min-width: 36px;
  text-align: center;
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
  color: var(--primary);
}
.ab-benefit.is-zero .ab-benefit__num {
  color: var(--muted);
  font-weight: 500;
}
.ab-benefit__meta {
  flex: 1;
  min-width: 0;
}
.ab-benefit__meta b {
  display: block;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ab-benefit__meta small {
  display: block;
  color: var(--muted);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ab-benefit__ops {
  flex: none;
  display: flex;
  gap: 4px;
}
/* 福利块里的加 / 减 / 记录 */
.ab-op {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
}
.ab-op:active:not(:disabled) {
  background: rgba(201, 116, 59, 0.16);
  color: var(--primary);
}
.ab-op:disabled {
  opacity: 0.3;
}
.ab-op:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}

/* 全部记录 */
.ab-recent {
  margin-top: 16px;
}
.ab-recent__title {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--text);
}
/* 记录区定高滚动：记录再多也只在这一小块里滚 */
.ab-logs {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 40vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 2px;
  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 90, 50, 0.28) transparent;
}
.ab-logs::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.ab-logs::-webkit-scrollbar-track {
  background: transparent;
}
.ab-logs::-webkit-scrollbar-thumb {
  background: rgba(120, 90, 50, 0.3);
  border-radius: 999px;
}
.ab-log {
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--bg);
}
.ab-log__head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ab-log__balance {
  margin-left: auto;
  color: var(--muted);
  font-size: 12px;
}
.ab-log__type {
  color: var(--text);
  font-size: 12px;
}
.ab-log__meta {
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

/* 福利类型 / 常用理由弹窗 */
/* 定高滚动区：条目多了不会把弹窗顶到满屏，滚动条只在这一小块里 */
.ab-typelist {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 40vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 2px;
  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 90, 50, 0.28) transparent;
}
.ab-typelist::-webkit-scrollbar {
  width: 6px;
}
.ab-typelist::-webkit-scrollbar-track {
  background: transparent;
}
.ab-typelist::-webkit-scrollbar-thumb {
  background: rgba(120, 90, 50, 0.3);
  border-radius: 999px;
}
.ab-typerow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(120, 90, 50, 0.12);
  border-radius: 12px;
}
.ab-typerow__main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.ab-typerow__name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ab-typerow__meta {
  color: var(--muted);
  font-size: 12px;
}
.ab-typerow__edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.ab-typerow__ops {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.ab-typecreate {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed rgba(120, 90, 50, 0.18);
}

/* 理由类型徽标 */
.ab-reason-badge {
  flex: none;
  align-self: flex-start;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 11px;
  background: var(--primary-soft);
  color: var(--text);
}
.ab-reason-badge.is-add {
  background: rgba(107, 165, 106, 0.22);
}
.ab-reason-badge.is-sub {
  background: rgba(217, 83, 79, 0.18);
}

/* 粉丝表单 */
.ab-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ab-field {
  display: block;
}
.ab-field__label {
  display: block;
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 14px;
}
.ab-select,
.ab-input {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--primary-soft);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  box-sizing: border-box;
}

/* 增减面板 */
.ab-adjust {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ab-adjust__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.ab-adjust__name {
  font-weight: 600;
  font-size: 15px;
}
.ab-adjust__amount {
  color: var(--accent);
  font-size: 13px;
}
/* 常用理由快捷带入 */
.ab-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ab-chip {
  padding: 6px 12px;
  min-height: 32px;
  border: 1px solid var(--primary-soft);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.ab-chip.is-active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.ab-chip:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* 底部弹层：整体淡入 + 轻微上移 */
.ab-slide-enter-active,
.ab-slide-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.ab-slide-enter-from,
.ab-slide-leave-to {
  opacity: 0;
  transform: translateY(6%);
}
</style>
