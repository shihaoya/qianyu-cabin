// 千羽爬树 · 移动端配置（仅平台差异项；公共参数与图片见 @cabin/games/climb）
// 图片统一放在 shared/assets/game/climb/，通过 @cabin alias 引入，PC/移动共用一份。
import sprite from '@cabin/assets/game/climb/user.png'
import bugYt from '@cabin/assets/game/climb/bug/熬夜.png'
import bugJb from '@cabin/assets/game/climb/bug/加班.png'
import bugHot from '@cabin/assets/game/climb/bug/热水.png'
import ice from '@cabin/assets/game/climb/fall/冰块.png'
import bag from '@cabin/assets/game/climb/fall/钱袋.png'
import { buildClimbConfig } from './config.base.js'

const assets = { sprite, bugYt, bugJb, bugHot, ice, bag }

// 仅写区别于公共配置的项；其余继承 @cabin 默认值（移动端虫子生成更快、整体更秀气）
export default buildClimbConfig(assets, {
  // 手机屏较窄：树干更细、角色/虫子更贴树，画面更紧凑，树间留白更大
  world: {
    trunkWidth: 20, // 树干宽度
    sideOffset: 24, // 角色/虫子相对树中心的偏移
    treeEdgeRatio: 0.18, // 树两侧留白占比（越小树越靠边、树间空隙越大）
  },
  // 角色缩放（手机屏更秀气）
  character: {
    scale: 0.3,
  },
  // 掉落物大小
  items: {
    size: 24,
  },
  // 虫子半径（radius 同时决定碰撞与贴图大小，缩小后手感一致）
  bugs: {
    types: [
      { key: 'jiaban', name: '加班虫', color: '#7bbf6a', radius: 16, killable: true, score: 5, touch: '我想下班~', image: assets.bugJb, weight: 0.4,
        desc: '可下滑攻击击落，击落 +5 分' },
      { key: 'yeqian', name: '熬夜虫', color: '#8e7cc3', radius: 16, killable: true, score: 3, touch: '十一点准时开播！', image: assets.bugYt, weight: 0.4,
        desc: '可下滑攻击击落，击落 +3 分' },
      { key: 'reshui', name: '热水虫', color: '#9a8c98', radius: 19, killable: false, touch: '水里有味儿~', image: assets.bugHot, weight: 0.2,
        desc: '热水会烫到，只能换位置躲开' },
    ],
  },
})
