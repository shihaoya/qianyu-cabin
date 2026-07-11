// 游戏注册表（移动端，与 PC 结构一致，组件各自 lazy import）。
// 注意：scoreLabel / formatDetail 仅用于榜单展示，计分与校验以服务端 engine 为唯一真源。
export const GAMES = [
  {
    key: 'climb',
    name: '千羽爬树',
    icon: 'climb',
    scoreLabel: '高度',
    formatDetail: (detail) => [
      { label: '高度', value: detail?.height ?? '-' },
      { label: '攀爬', value: detail?.climbs ?? '-' },
    ],
    component: () => import('../views/games/ClimbGame.vue'),
  },
]

export function getGame(key) {
  return GAMES.find((g) => g.key === key) || null
}
