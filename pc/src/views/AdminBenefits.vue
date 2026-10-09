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
  getFanCards,
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

// ---------- 常用理由（增减卡时一键带入） ----------
const reasons = ref([])
const showReasons = ref(false)
const reasonDraft = ref('')
const editingReasonId = ref(null)
const editingReasonDraft = ref('')
const reasonSaving = ref(false)
const reasonError = ref('')

// ---------- 增减卡（点某一行福利打开） ----------
const benefitTarget = ref(null) // { fanId, nickname, typeId, typeName }
const benefitCards = ref([])
const benefitLogs = ref([])
const benefitLoading = ref(false)
const draft = ref({ amount: '1', reason: '' })
const adjusting = ref(false)
const benefitError = ref('')

const PAGE_SIZE = 50

async function loadFans() {
  loading.value = true
  error.value = ''
  try {
    const data = await listFans({ page: 1, pageSize: PAGE_SIZE, keyword: keyword.value })
    fans.value = data.list || []
    total.value = data.total || 0
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

// 卡片内的福利行：以福利类型为准，未持有的类型显示为 0 张
function benefitRows(fan) {
  const held = new Map((fan.cards || []).map((c) => [c.typeId, c.amount]))
  return types.value.map((t) => ({
    typeId: t.id,
    typeName: t.name,
    amount: held.get(t.id) || 0,
  }))
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
  reasonDraft.value = ''
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
  const text = reasonDraft.value.trim()
  if (!text) {
    reasonError.value = '理由内容不能为空'
    return
  }
  reasonSaving.value = true
  reasonError.value = ''
  try {
    await createReason({ text })
    reasonDraft.value = ''
    await loadReasons()
  } catch (e) {
    reasonError.value = e.message || '新增失败'
  } finally {
    reasonSaving.value = false
  }
}

function startEditReason(r) {
  editingReasonId.value = r.id
  editingReasonDraft.value = r.text
  reasonError.value = ''
}

async function saveEditReason() {
  if (reasonSaving.value || editingReasonId.value === null) return
  const text = editingReasonDraft.value.trim()
  if (!text) {
    reasonError.value = '理由内容不能为空'
    return
  }
  reasonSaving.value = true
  reasonError.value = ''
  try {
    await updateReason(editingReasonId.value, { text })
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

// 点一下带入理由，再点一下取消（避免误选后要手动清空）
function pickReason(text) {
  draft.value.reason = draft.value.reason === text ? '' : text
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
    await loadFans()
  } catch (e) {
    error.value = e.message || '删除失败'
  }
}

// ---------- 增减卡 ----------
async function openBenefits(fan, row) {
  benefitTarget.value = { fanId: fan.id, nickname: fan.nickname, typeId: row.typeId, typeName: row.typeName }
  benefitError.value = ''
  benefitCards.value = []
  benefitLogs.value = []
  draft.value = { amount: '1', reason: '' }
  adjusting.value = false
  benefitLoading.value = true
  try {
    const [cards, logs] = await Promise.all([getFanCards(fan.id), getFanLogs(fan.id, { pageSize: 30 })])
    benefitCards.value = cards.cards || []
    benefitLogs.value = logs.list || []
  } catch (e) {
    benefitError.value = e.message || '加载失败'
  } finally {
    benefitLoading.value = false
  }
}

const activeCard = computed(() => {
  if (!benefitTarget.value) return null
  return benefitCards.value.find((c) => c.typeId === benefitTarget.value.typeId) || null
})

// 选中某个类型时只看这个类型的流水，不掺杂其它类型
const activeLogs = computed(() => {
  if (!benefitTarget.value) return []
  return benefitLogs.value.filter((log) => log.typeId === benefitTarget.value.typeId)
})

async function adjust(direction) {
  const card = activeCard.value
  if (!card || adjusting.value) return
  const amount = Number(draft.value.amount)
  if (!Number.isInteger(amount) || amount <= 0) {
    benefitError.value = '数量必须是大于 0 的整数'
    return
  }
  adjusting.value = true
  benefitError.value = ''
  try {
    const delta = direction === 'add' ? amount : -amount
    await adjustFanCard(benefitTarget.value.fanId, {
      typeId: card.typeId,
      delta,
      reason: draft.value.reason,
    })
    draft.value = { amount: '1', reason: '' }
    const [cards, logs] = await Promise.all([
      getFanCards(benefitTarget.value.fanId),
      getFanLogs(benefitTarget.value.fanId, { pageSize: 30 }),
    ])
    benefitCards.value = cards.cards || []
    benefitLogs.value = logs.list || []
    await loadFans()
  } catch (e) {
    benefitError.value = e.message || '调整失败'
  } finally {
    adjusting.value = false
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

        <div class="ab-toolbar">
          <div class="ab-search">
            <input
              v-model="keyword"
              class="ab-search__input"
              placeholder="搜索昵称 / 抖音号 / 系统内账号"
              @keyup.enter="loadFans"
            >
            <BaseButton
              type="default"
              @click="loadFans"
            >
              搜索
            </BaseButton>
          </div>
          <div class="ab-actions">
            <BaseButton
              type="default"
              @click="openTypes"
            >
              管理福利类型
            </BaseButton>
            <BaseButton
              type="default"
              @click="openReasons"
            >
              管理常用理由
            </BaseButton>
            <BaseButton
              type="primary"
              @click="openCreateFan"
            >
              新增粉丝
            </BaseButton>
          </div>
        </div>

        <div class="ab-list">
          <p
            v-if="loading"
            class="ab-empty"
          >
            正在加载…
          </p>
          <template v-else-if="fans.length">
            <div
              v-for="fan in fans"
              :key="fan.id"
              class="ab-item"
            >
              <!-- 编辑 / 删除固定在卡片右上角，正文为它们留出位置 -->
              <div class="ab-item__head">
                <span
                  class="ab-item__name"
                  :title="fan.nickname"
                >{{ fan.nickname }}</span>
              </div>
              <div
                v-if="fan.systemAccount || fan.douyinAccount"
                class="ab-item__tags"
              >
                <span
                  v-if="fan.systemAccount"
                  class="ab-item__tag"
                  :title="fan.systemAccount"
                >站内 {{ fan.systemAccount }}</span>
                <span
                  v-if="fan.douyinAccount"
                  class="ab-item__tag"
                  :title="fan.douyinAccount"
                >抖音 {{ fan.douyinAccount }}</span>
              </div>
              <p
                v-if="fan.remark"
                class="ab-item__remark"
                :title="fan.remark"
              >
                {{ fan.remark }}
              </p>

              <!-- 每个粉丝一张卡片，卡片内一行一个福利：左名字、右数量，点这一行即可增减 -->
              <div class="ab-benefits">
                <button
                  v-for="row in benefitRows(fan)"
                  :key="row.typeId"
                  type="button"
                  class="ab-benefit"
                  @click="openBenefits(fan, row)"
                >
                  <span class="ab-benefit__name">{{ row.typeName }}</span>
                  <span
                    class="ab-benefit__amount"
                    :class="{ 'is-zero': row.amount === 0 }"
                  >
                    {{ row.amount }} 张
                  </span>
                  <span
                    class="ab-benefit__arrow"
                    aria-hidden="true"
                  >›</span>
                </button>
                <p
                  v-if="!benefitRows(fan).length"
                  class="ab-empty ab-empty--inline"
                >
                  还没有福利类型，先去「管理福利类型」添加一个
                </p>
              </div>

              <div class="ab-item__ops">
                <button
                  class="ab-icon-btn"
                  type="button"
                  title="编辑资料"
                  aria-label="编辑资料"
                  @click="openEditFan(fan)"
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
                  @click="removeFan(fan)"
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
              </div>
            </div>
          </template>
          <p
            v-else
            class="ab-empty"
          >
            {{ keyword ? '没有匹配的粉丝' : '还没有粉丝，点右上角「新增粉丝」开始吧' }}
          </p>
        </div>
      </section>
    </main>

    <!-- 福利类型管理 -->
    <transition name="ab-fade">
      <BaseModal
        v-if="showTypes"
        title="福利类型管理"
        width="560px"
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
    <transition name="ab-fade">
      <BaseModal
        v-if="fanEditor"
        :title="fanEditor.id ? '编辑粉丝' : '新增粉丝'"
        width="520px"
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
    <transition name="ab-fade">
      <BaseModal
        v-if="showReasons"
        title="常用理由管理"
        width="520px"
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
                  v-model="editingReasonDraft"
                  type="text"
                  placeholder="理由内容，如：直播抽奖中奖"
                />
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
            v-model="reasonDraft"
            type="text"
            placeholder="新的常用理由，如：活动奖励"
          />
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
          删除常用理由只影响快捷选择，已经写入增减记录的理由文本不受影响。
        </p>
      </BaseModal>
    </transition>

    <!-- 增减某一张卡 -->
    <transition name="ab-fade">
      <BaseModal
        v-if="benefitTarget"
        :title="`${benefitTarget.typeName} · ${benefitTarget.nickname}`"
        width="620px"
        @close="benefitTarget = null"
      >
        <p
          v-if="benefitError"
          class="ab-error"
        >
          {{ benefitError }}
        </p>
        <p
          v-if="benefitLoading"
          class="ab-empty"
        >
          正在加载…
        </p>
        <template v-else-if="activeCard">
          <div class="ab-adjust">
            <div class="ab-adjust__head">
              <span class="ab-adjust__name">{{ activeCard.typeName }}</span>
              <span class="ab-adjust__amount">现有 {{ activeCard.amount }} 张</span>
            </div>
            <div class="ab-adjust__fields">
              <input
                v-model="draft.amount"
                class="ab-num"
                type="number"
                min="1"
                step="1"
                aria-label="增减数量"
              >
              <input
                v-model="draft.reason"
                class="ab-reason"
                type="text"
                placeholder="增减理由（必填），如：直播抽奖中奖"
              >
            </div>
            <!-- 常用理由：点一下带入输入框，再点一下取消 -->
            <div
              v-if="reasons.length"
              class="ab-chips"
            >
              <button
                v-for="r in reasons"
                :key="r.id"
                type="button"
                class="ab-chip"
                :class="{ 'is-active': draft.reason === r.text }"
                @click="pickReason(r.text)"
              >
                {{ r.text }}
              </button>
            </div>
            <div class="ab-adjust__ops">
              <BaseButton
                type="default"
                :loading="adjusting"
                :disabled="adjusting"
                @click="adjust('add')"
              >
                增加
              </BaseButton>
              <BaseButton
                type="text"
                :loading="adjusting"
                :disabled="adjusting || activeCard.amount <= 0"
                @click="adjust('sub')"
              >
                减少
              </BaseButton>
            </div>
          </div>

          <h4 class="ab-logs__title">
            「{{ activeCard.typeName }}」增减记录
          </h4>
          <div class="ab-logs">
            <table
              v-if="activeLogs.length"
              class="ab-table"
            >
              <thead>
                <tr>
                  <th>时间</th>
                  <th>变动</th>
                  <th>余额</th>
                  <th>理由</th>
                  <th>操作人</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="log in activeLogs"
                  :key="log.id"
                >
                  <td>{{ fmtTime(log.createdAt) }}</td>
                  <td :class="log.delta > 0 ? 'is-add' : 'is-sub'">
                    {{ log.delta > 0 ? `+${log.delta}` : log.delta }}
                  </td>
                  <td>{{ log.balance }}</td>
                  <td>{{ log.reason }}</td>
                  <td>{{ log.operatorName || '—' }}</td>
                </tr>
              </tbody>
            </table>
            <p
              v-else
              class="ab-empty ab-empty--inline"
            >
              该类型还没有增减记录
            </p>
          </div>
        </template>
        <p
          v-else
          class="ab-empty"
        >
          该福利类型已不存在，请返回重试
        </p>
      </BaseModal>
    </transition>
  </div>
</template>

<style scoped>
.page__main {
  /* 卡片网格，一行排 4~5 个粉丝 */
  max-width: 1240px;
  margin: 0 auto;
  padding: 28px 20px 48px;
}
.ab-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 28px;
  color: var(--text);
}
.ab-sub {
  margin: 4px 0 20px;
  color: var(--muted);
  font-size: 14px;
}
.ab-error {
  margin: 0 0 14px;
  color: #d9534f;
  font-size: 13px;
}
.ab-hint {
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 12px;
}
.ab-empty {
  margin: 8px 0;
  color: var(--muted);
  font-size: 14px;
}
.ab-empty--inline {
  margin: 10px 0;
}

.ab-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.ab-search {
  display: flex;
  gap: 8px;
  flex: 1;
  min-width: 260px;
}
.ab-search__input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--primary-soft);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font: inherit;
}
.ab-actions {
  display: flex;
  gap: 8px;
}

/* 响应式网格：宽屏一行 4~5 张卡片，窄屏自动减少列数 */
.ab-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  align-items: start;
}
/* 加载 / 空态提示占满整行 */
.ab-list > .ab-empty {
  grid-column: 1 / -1;
}
/* 网格里的粉丝卡片：不用 BaseCard（内边距过大），自行实现紧凑卡片外观 */
.ab-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px 8px;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
.ab-item__head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-right: 58px;
}
.ab-item__name {
  font-weight: 600;
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ab-item__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ab-item__tag {
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--primary-soft);
  color: var(--text);
  font-size: 11px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ab-item__remark {
  margin: 0;
  color: var(--muted);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 编辑 / 删除固定在卡片右上角，不占正文高度 */
.ab-item__ops {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 2px;
}
.ab-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.ab-icon-btn:hover {
  background: rgba(201, 116, 59, 0.12);
  color: var(--primary);
}
.ab-icon-btn:active {
  background: rgba(201, 116, 59, 0.2);
}
.ab-icon-btn.is-danger:hover {
  background: rgba(217, 83, 79, 0.12);
  color: #d9534f;
}
.ab-icon-btn:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}

/* 卡片内的福利列表：一行一个福利，左名字右数量，整行可点 */
.ab-benefits {
  margin-top: 8px;
  border-top: 1px solid rgba(120, 90, 50, 0.1);
}
.ab-benefit {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 7px 6px;
  border: none;
  border-bottom: 1px dashed rgba(120, 90, 50, 0.14);
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;
}
.ab-benefit:last-child {
  border-bottom: none;
}
.ab-benefit:hover {
  background: rgba(201, 116, 59, 0.07);
}
.ab-benefit:active {
  background: rgba(201, 116, 59, 0.12);
}
.ab-benefit:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}
.ab-benefit__name {
  font-weight: 600;
}
.ab-benefit__amount {
  margin-left: auto;
  color: var(--accent);
  font-weight: 600;
}
.ab-benefit__amount.is-zero {
  color: var(--muted);
  font-weight: 400;
}
.ab-benefit__arrow {
  color: var(--muted);
  font-size: 20px;
  line-height: 1;
}

/* 福利类型弹窗 */
/* 定高滚动区：类型多了不会把弹窗撑满屏，滚动条只在这一小块里 */
.ab-typelist {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 2px;
  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 90, 50, 0.28) transparent;
}
.ab-typelist::-webkit-scrollbar {
  width: 8px;
}
.ab-typelist::-webkit-scrollbar-track {
  background: transparent;
}
.ab-typelist::-webkit-scrollbar-thumb {
  background: rgba(120, 90, 50, 0.28);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.ab-typelist::-webkit-scrollbar-thumb:hover {
  background: rgba(120, 90, 50, 0.45);
  background-clip: content-box;
}
.ab-typerow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(120, 90, 50, 0.12);
  border-radius: 12px;
}
.ab-typerow__main {
  display: flex;
  flex-direction: column;
}
.ab-typerow__name {
  font-weight: 600;
}
.ab-typerow__meta {
  color: var(--muted);
  font-size: 12px;
}
.ab-typerow__edit {
  display: flex;
  gap: 8px;
  flex: 1;
}
.ab-typerow__ops {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.ab-typecreate {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed rgba(120, 90, 50, 0.18);
}
.ab-typecreate :deep(.base-input),
.ab-typerow__edit :deep(.base-input) {
  flex: 1;
  min-width: 0;
}

/* 粉丝表单 */
.ab-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
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
.ab-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--primary-soft);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font: inherit;
}

/* 单张卡的增减面板 */
.ab-adjust {
  padding: 12px;
  border: 1px solid rgba(120, 90, 50, 0.12);
  border-radius: 12px;
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
.ab-adjust__fields {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.ab-num {
  width: 88px;
  flex-shrink: 0;
  padding: 8px 10px;
  border: 1px solid var(--primary-soft);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
}
.ab-reason {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--primary-soft);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
}
.ab-adjust__ops {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
/* 常用理由快捷带入 */
.ab-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.ab-chip {
  padding: 4px 10px;
  border: 1px solid var(--primary-soft);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.ab-chip:hover {
  background: rgba(201, 116, 59, 0.1);
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

/* 增减记录：定高滚动区，记录再多也不会把弹窗撑高；表头吸顶 */
.ab-logs__title {
  margin: 20px 0 8px;
  color: var(--text);
  font-size: 15px;
}
.ab-logs {
  max-height: 240px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid rgba(120, 90, 50, 0.12);
  border-radius: 12px;
  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 90, 50, 0.28) transparent;
}
.ab-logs::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.ab-logs::-webkit-scrollbar-track {
  background: transparent;
}
.ab-logs::-webkit-scrollbar-thumb {
  background: rgba(120, 90, 50, 0.28);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.ab-logs::-webkit-scrollbar-thumb:hover {
  background: rgba(120, 90, 50, 0.45);
  background-clip: content-box;
}
.ab-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
/* 表头吸顶：滚动时始终知道每列是什么 */
.ab-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--surface);
  /* border-collapse 下不会跟着吸顶，用 inset 阴影补表头下边线 */
  box-shadow: inset 0 -1px 0 rgba(120, 90, 50, 0.18);
}
.ab-table th,
.ab-table td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid rgba(120, 90, 50, 0.12);
}
.ab-table th {
  color: var(--muted);
  font-weight: 500;
}
.is-add {
  color: var(--accent);
}
.is-sub {
  color: #d9534f;
}

.ab-fade-enter-active,
.ab-fade-leave-active {
  transition: opacity 0.18s ease;
}
.ab-fade-enter-from,
.ab-fade-leave-to {
  opacity: 0;
}
</style>
