// 游戏 engine 注册表：新增游戏在此登记一行即可，路由/服务不感知具体游戏。
// 注意：校验与计分以服务端 engine 为唯一真源；前端只渲染并上报结果元组。
import climb from './climb.js'
import fly from './fly.js'

const registry = {
  [climb.key]: climb,
  [fly.key]: fly,
}

export function getEngine(key) {
  return registry[key] || null
}

export function listEngines() {
  return Object.values(registry)
}
