import { buildGameRegistry } from '@cabin/games'
import ClimbGame from '../views/games/ClimbGame.vue'
import FlyGame from '../views/games/FlyGame.vue'
import SlapGame from '../views/games/SlapGame.vue'

// 游戏注册表（移动端）：元信息与 PC 共用 @cabin/games，仅注入移动端组件。
const { GAMES, getGame } = buildGameRegistry({ climb: ClimbGame, fly: FlyGame, slap: SlapGame })

export { GAMES, getGame }
