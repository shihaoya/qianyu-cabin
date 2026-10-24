import { buildGameRegistry } from '@cabin/games'
import ClimbGame from '../views/games/ClimbGame.vue'
import FlyGame from '../views/games/FlyGame.vue'
import SlapGame from '../views/games/SlapGame.vue'
import CircleGame from '../views/games/CircleGame.vue'

// 游戏注册表（前端单一真源）：新增游戏 → 在 @cabin/games 登记元信息，
// 并在此把平台专属 Vue 组件注入即可。
const { GAMES, getGame } = buildGameRegistry({ climb: ClimbGame, fly: FlyGame, slap: SlapGame, circle: CircleGame })

export { GAMES, getGame }
