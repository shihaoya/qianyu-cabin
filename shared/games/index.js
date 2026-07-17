// 游戏注册「元信息」单一真源（与平台无关）。
// 各端通过 buildGameRegistry({ climb: ClimbGame }) 注入平台专属的 Vue 组件，得到可使用的 GAMES。
// 注意：scoreLabel / formatDetail 仅用于榜单展示，计分与校验以服务端 engine 为唯一真源。

export const GAME_DEFS = [
  {
    key: 'climb',
    name: '千羽爬树',
    icon: 'climb',
    scoreLabel: '得分',
    formatDetail: (detail) => [
      { label: '击虫', value: detail?.bugsKilled ?? '-' },
      { label: '时长', value: detail?.timeSurvived != null ? `${detail.timeSurvived}s` : '-' },
      { label: '剩心', value: detail?.hpLeft ?? '-' },
    ],
  },
  {
    key: 'fly',
    name: '飞扬的千羽',
    icon: 'fly',
    scoreLabel: '得分',
    formatDetail: (detail) => [
      { label: '飞过管道', value: detail?.pipesPassed != null ? `${detail.pipesPassed} 根` : '-' },
      { label: '时长', value: detail?.timeSurvived != null ? `${detail.timeSurvived}s` : '-' },
    ],
  },
]

// 注入平台专属组件，构建最终注册表（component 由各端提供，元信息只写一份）
export function buildGameRegistry(components) {
  const GAMES = GAME_DEFS.map((def) => ({
    ...def,
    component: components[def.key] || null,
  }))
  function getGame(key) {
    return GAMES.find((g) => g.key === key) || null
  }
  return { GAMES, getGame }
}
