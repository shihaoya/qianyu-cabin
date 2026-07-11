# 移动端组件清单（自动生成，请勿手改）

> 本文件由 `scripts/sync-components.mjs` 自动生成。组件说明的**唯一来源**是每个 `.vue` 文件顶部的 `@doc` 注释块。
> 增加或改动组件后，运行 `pnpm docs:components`（或 `node scripts/sync-components.mjs`）重新生成本文件。请勿手动编辑本文件。

## @doc 块格式（写在 .vue 顶部）

```
<!--
@doc
name: 组件名
path: 相对路径
category: base|business
purpose: 一句话用途
appliesTo: 通用|PC|移动
props: prop:类型=默认 — 说明
events: event:payload — 说明
example: <Xxx />
-->
```

## 基础组件

### BaseButton
- 路径：src/components/base/BaseButton.vue
- 用途：统一按钮样式与交互（移动端默认更大触控区）
- 适用端：通用
- props：type:'primary'|'default'|'text'=default; loading:Boolean=false; disabled:Boolean=false; size:'md'|'lg'='md'
- events：click
- 示例：<BaseButton type="primary" size="lg" :loading="submitting" @click="onSubmit">登录</BaseButton>

### BaseCard
- 路径：src/components/base/BaseCard.vue
- 用途：卡片容器，统一圆角/阴影/内边距（移动端全宽流式）
- 适用端：通用
- props：title:String=''; hoverable:Boolean=false
- events：无
- 示例：<BaseCard title="游戏区"><GameArea /></BaseCard>

### BaseInput
- 路径：src/components/base/BaseInput.vue
- 用途：带标签/错误态的文本输入（移动端全宽）
- 适用端：通用
- props：modelValue:String=''; label:String=''; error:String=''; type:String='text'
- events：update:modelValue
- 示例：<BaseInput v-model="nick" label="昵称" :error="errMsg" />

### CabinLogo
- 路径：src/components/base/CabinLogo.vue
- 用途：小屋 logo / 站点标识 SVG
- 适用端：通用
- props：size:Number=32
- events：无
- 示例：<CabinLogo :size="36" />

### FeatherIcon
- 路径：src/components/base/FeatherIcon.vue
- 用途：羽毛内联 SVG 图标（不引图标库）
- 适用端：通用
- props：size:Number=20
- events：无
- 示例：<FeatherIcon :size="28" />

### GameIcon
- 路径：src/components/base/GameIcon.vue
- 用途：按 type 渲染游戏图标（内联 SVG，便于扩展新游戏）
- 适用端：移动
- props：type(String, 必填), size(Number=56)
- events：无
- 示例：<GameIcon type="climb" :size="56" />

## 业务组件

### BottomNav
- 路径：src/components/BottomNav.vue
- 用途：移动端底部 Tab 导航栏
- 适用端：移动
- props：active:String=''
- events：无
- 示例：<BottomNav :active="route.name" />

### GameArea
- 路径：src/components/GameArea.vue
- 用途：主页游戏区网格容器，展示多个游戏入口（当前含千羽爬树），后续加游戏只需在 games 数组追加
- 适用端：移动
- props：games(Array)
- events：select(game)
- 示例：<GameArea :games="games" @select="onPlay" />

