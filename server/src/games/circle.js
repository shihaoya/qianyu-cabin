// 千羽画圈圈 · 服务端 engine（实时动作类）。这是「每游戏唯一要写的后端文件」。
// 前端上报「结束结果元组」，这里只负责校验自洽 + 算官方分；计分规则以本文件为准（防作弊单一真源）。
//
// 状态（存档）形状（整体为平台无关 JSON，随 HTTP 存/读，跨端续玩）：
//   标量：{ phase, angle, jumpTimer, dropTimer, paintedTotal, timeSurvived, startedAt,
//           monsterCount, monsterSpeed, runSpeed }
//   动态数组：painted[]（已合并的涂色区间）、monsters[]（{ angle, typeKey, wobble }）
//   —— 校验只读取上面的标量做自洽检查，painted/monsters 会随 JSON 无损存储与还原，不影响校验。
// 结果（结束上报）形状：{ score, paintPercent, timeSurvived, monsterCount, monsterSpeed, runSpeed, won, startedAt }
export default {
  key: 'circle',
  name: '千羽画圈圈',
  order: 'desc', // 排行榜方向：desc 高分在前
  scoreLabel: '涂色%', // 榜单主列中文名

  // 校验前端上报的「进行中状态」是否自洽（防坏存档 / 防篡改）
  validateState(state) {
    if (!state || typeof state !== 'object') return false
    const { angle, jumpTimer, dropTimer, paintedTotal, timeSurvived, monsterCount, monsterSpeed, runSpeed } = state
    if (![angle, jumpTimer, dropTimer, paintedTotal, timeSurvived, monsterCount, monsterSpeed, runSpeed].every(
      (v) => Number.isFinite(v) && v >= 0,
    ))
      return false
    if (!Number.isInteger(monsterCount) || monsterCount < 1 || monsterCount > 8) return false
    return true
  },

  // 校验「结束结果元组」是否自洽。
  // 娱乐向小游戏，不做严格的防作弊校验（能改客户端的人提交时也能改回合法值，限制无意义），
  // 只拦明显非法的脏数据：
  //   - 必须是个对象；
  //   - 分值字段必须是非负整数（防止浮点/字符串/缺失导致入库异常）；
  //   - 难度字段必须是 0.5~2 之间的有限数。
  validateResult(result) {
    if (!result || typeof result !== 'object') return false
    const { score, paintPercent, timeSurvived, monsterCount } = result
    const ints = [score, paintPercent, timeSurvived, monsterCount]
    if (!ints.every((v) => Number.isInteger(v) && v >= 0)) return false
    const nums = [result.monsterSpeed, result.runSpeed]
    if (!nums.every((v) => Number.isFinite(v) && v >= 0.5 && v <= 2)) return false
    return true
  },

  // 由结果算官方排序分（前端仅显示，最终以服务端为准）
  // 计分 = 涂色百分比（0~100），已在前端按 paintedTotal/2π 累计并经 validateResult 校验
  score(result) {
    return result.paintPercent | 0
  },

  // 把 detail(JSON) 转成榜单/历史要展示的字段数组 [{ label, value }]
  formatDetail(detail) {
    return [
      { label: '涂色', value: detail?.paintPercent != null ? `${detail.paintPercent}%` : '-' },
      { label: '时长', value: detail?.timeSurvived != null ? `${detail.timeSurvived}s` : '-' },
      { label: '怪物', value: detail?.monsterCount ?? '-' },
    ]
  },
}
