// 示例游戏 engine：千羽爬树（回合/数值类）
// 这是「每游戏唯一要写的后端文件」。框架只认下面这组约定字段，不感知游戏细节。
//
// 游戏设定（仅用于说明 state/result 形状，前端视图自行实现）：
//   每点一次「攀爬」height += 随机 1~5，stamina -= 1，climbs += 1；
//   stamina 耗尽即结束，result = { height, climbs }。
export default {
  key: 'climb',
  name: '千羽爬树',
  order: 'desc', // 排行榜方向：desc 高分在前
  scoreLabel: '高度', // 榜单主列中文名（D8）

  // 校验前端上报的「进行中状态」是否自洽（防坏存档 / 防篡改）
  validateState(state) {
    if (!state || typeof state !== 'object') return false
    const { height, stamina, climbs } = state
    return (
      Number.isInteger(height) &&
      height >= 0 &&
      Number.isInteger(stamina) &&
      stamina >= 0 &&
      stamina <= 10 &&
      Number.isInteger(climbs) &&
      climbs >= 0
    )
  },

  // 校验「结束结果元组」是否自洽（防作弊核心）
  validateResult(result) {
    if (!result || typeof result !== 'object') return false
    const { height, climbs } = result
    return (
      Number.isInteger(height) &&
      height >= 0 &&
      Number.isInteger(climbs) &&
      climbs >= 0 &&
      climbs <= 1000
    )
  },

  // 由结果算官方排序分（前端仅显示，最终以服务端为准）
  score(result) {
    return result.height
  },

  // 把 detail(JSON) 转成榜单/历史要展示的字段数组 [{ label, value }]
  formatDetail(detail) {
    return [
      { label: '高度', value: detail?.height ?? '-' },
      { label: '攀爬次数', value: detail?.climbs ?? '-' },
    ]
  },
}
