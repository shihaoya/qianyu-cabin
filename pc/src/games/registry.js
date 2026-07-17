import { buildGameRegistry } from '@cabin/games'
import ClimbGame from '../views/games/ClimbGame.vue'
import FlyGame from '../views/games/FlyGame.vue'

// 游戏注册表（前端单一真源）：新增游戏 → 在 @cabin/games 登记元信息，
// 并在此把平台专属 Vue 组件注入即可。
const { GAMES, getGame } = buildGameRegistry({ climb: ClimbGame, fly: FlyGame })

export { GAMES, getGame }
