// 千羽爬树 · 服务端 engine（实时动作类）。这是「每游戏唯一要写的后端文件」。
// 前端上报「结束结果元组」，这里只负责校验自洽 + 算官方分；计分规则以本文件为准（防作弊单一真源）。
//
// 状态（存档）形状：{ lane, h, hp, score, bugsKilled, timeSurvived, shieldRemainingMs }
//   lane：横向离散位置 0..5（3 棵树 × 左/右两侧）；h：沿树高度
// 结果（结束上报）形状：{ score, bugsKilled, timeSurvived, hpLeft }
export default {
  key: 'climb',
  name: '千羽爬树',
  order: 'desc', // 排行榜方向：desc 高分在前
  scoreLabel: '得分', // 榜单主列中文名

  // 校验前端上报的「进行中状态」是否自洽（防坏存档 / 防篡改）
  validateState(state) {
    if (!state || typeof state !== 'object') return false
    const { lane, h, hp, score, bugsKilled, timeSurvived, shieldRemainingMs } = state
    if (![lane, h, hp, score, bugsKilled, timeSurvived, shieldRemainingMs].every(
      (v) => Number.isFinite(v) && v >= 0,
    ))
      return false
    if (!Number.isInteger(lane) || lane < 0 || lane > 5) return false
    if (hp > 3 || score > 10_000_000) return false
    return true
  },

  // 校验「结束结果元组」是否自洽（防作弊核心）
  validateResult(result) {
    if (!result || typeof result !== 'object') return false
    const { score, bugsKilled, timeSurvived, hpLeft } = result
    const ints = [score, bugsKilled, timeSurvived, hpLeft]
    if (!ints.every((v) => Number.isInteger(v) && v >= 0)) return false
    if (hpLeft > 3) return false
    // 守恒校验：击虫累计分 = 加班(+5) / 熬夜(+3)，每只有 3~5 分；时间分 = 存活/2
    // 故总分应落在 [3*击虫 + 时间/2, 5*击虫 + 时间/2] 区间内（热水虫不可击落，不计入）
    const timeBonus = Math.floor(timeSurvived / 2)
    const lo = 3 * bugsKilled + timeBonus
    const hi = 5 * bugsKilled + timeBonus
    if (score < lo) return false
    if (score > hi + 50) return false // +50 容忍浮点/取整抖动
    if (timeSurvived > 86400) return false // 单局不超过 24h
    return true
  },

  // 由结果算官方排序分（前端仅显示，最终以服务端为准）
  // 计分已在前端按「虫种分 + 存活/2」累计并经 validateResult 校验，这里直接采用上报分
  score(result) {
    return result.score | 0
  },

  // 把 detail(JSON) 转成榜单/历史要展示的字段数组 [{ label, value }]
  formatDetail(detail) {
    return [
      { label: '击虫', value: detail?.bugsKilled ?? '-' },
      { label: '时长', value: detail?.timeSurvived != null ? `${detail.timeSurvived}s` : '-' },
      { label: '剩余心', value: detail?.hpLeft ?? '-' },
    ]
  },
}
