// 游戏 engine 注册表：新增游戏在此登记一行即可，路由/服务不感知具体游戏。
// 注意：校验与计分以服务端 engine 为唯一真源；前端只渲染并上报结果元组。
// 纯娱乐、不产生成绩记录的小游戏（如 slap）无需在此登记，也不应调用成绩相关接口。
import climb from './climb.js'
import fly from './fly.js'
import circle from './circle.js'

const registry = {
  [climb.key]: climb,
  [fly.key]: fly,
  [circle.key]: circle,
}

export function getEngine(key) {
  return registry[key] || null
}

export function listEngines() {
  return Object.values(registry)
}
