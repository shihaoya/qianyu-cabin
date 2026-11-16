// 抽奖相关配置的单一真源
// PC / Mobile 共用，修改默认图标等配置时，只需改这里，所有引用处自动同步

// 奖品无图片时的默认占位图标
export const PRIZE_FALLBACK_EMOJI = '🎁'

// 奖品无图片时用名称第一个字做图标，方便区分不同奖品
export function prizeIconText(name) {
  const n = (name || '').trim()
  return n ? n[0] : PRIZE_FALLBACK_EMOJI
}

// 快捷抽数选项
export const QUICK_DRAW_COUNTS = [1, 5, 10, 20, 50]

// 单次抽奖次数上限（防止一次抽太多导致超时/内存问题）
export const MAX_BATCH_COUNT = 999
