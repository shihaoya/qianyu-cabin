import ClimbGame from '../views/games/ClimbGame.vue'

// 游戏注册表（移动端，与 PC 结构一致）。
// 注意：scoreLabel / formatDetail 仅用于榜单展示，计分与校验以服务端 engine 为唯一真源。
export const GAMES = [
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
    component: ClimbGame,
  },
]

export function getGame(key) {
  return GAMES.find((g) => g.key === key) || null
}
