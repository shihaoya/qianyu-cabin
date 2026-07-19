// 像素鸟 · 服务端 engine（实时动作类）。这是「每游戏唯一要写的后端文件」。
// 前端上报「结束结果元组」，这里只负责校验自洽 + 算官方分；计分规则以本文件为准（防作弊单一真源）。
//
// 状态（存档）形状（平台无关 JSON，随 HTTP 存/读，跨端续玩）：
//   标量：{ birdXFrac, birdY, vy, score, pipesPassed, timeSurvived, startedAt }
//   动态数组：pipes[]（场上管道，含 x/gapTop/gapBottom/scored）
// 结果（结束上报）形状：{ score, pipesPassed, timeSurvived, startedAt }
//   score 与 pipesPassed 在合法游戏中恒相等（每过一根管道 +1 分），故校验要求两者一致。
export default {
  key: 'fly',
  name: '像素鸟',
  order: 'desc', // 排行榜方向：desc 高分在前
  scoreLabel: '得分', // 榜单主列中文名

  // 校验前端上报的「进行中状态」是否自洽（防坏存档 / 防篡改）
  validateState(state) {
    if (!state || typeof state !== 'object') return false
    const { birdY, vy, score, pipesPassed, timeSurvived } = state
    // 位置/速度可为任意有限数：vy 拍翅向上时为负，birdY 在屏幕内（可能贴顶为 0）
    if (![birdY, vy].every((v) => Number.isFinite(v))) return false
    // 累计计数不得为负（负值为损坏 / 篡改）
    if (![score, pipesPassed, timeSurvived].every((v) => Number.isFinite(v) && v >= 0)) return false
    if (!Array.isArray(state.pipes)) return false
    for (const p of state.pipes) {
      if (!p || typeof p !== 'object') return false
      if (!Number.isFinite(p.x) || !Number.isFinite(p.gapTop) || !Number.isFinite(p.gapBottom))
        return false
    }
    return true
  },

  // 校验「结束结果元组」是否自洽。娱乐向小游戏，只拦明显非法的脏数据：
  //   - 必须是个对象；
  //   - score / pipesPassed / timeSurvived 都必须是非负整数；
  //   - score 必须 == pipesPassed（游戏内二者恒等，不一致即异常/篡改）。
  validateResult(result) {
    if (!result || typeof result !== 'object') return false
    const { score, pipesPassed, timeSurvived } = result
    if (![score, pipesPassed, timeSurvived].every((v) => Number.isInteger(v) && v >= 0)) return false
    if (score !== pipesPassed) return false
    return true
  },

  // 由结果算官方排序分（前端仅显示，最终以服务端为准）
  score(result) {
    return result.score | 0
  },

  // 把 detail(JSON) 转成榜单/历史要展示的字段数组 [{ label, value }]
  formatDetail(detail) {
    return [
      { label: '飞过管道', value: detail?.pipesPassed != null ? `${detail.pipesPassed} 根` : '-' },
      { label: '时长', value: detail?.timeSurvived != null ? `${detail.timeSurvived}s` : '-' },
    ]
  },
}
