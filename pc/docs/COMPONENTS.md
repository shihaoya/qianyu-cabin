# PC 端组件清单（自动生成，请勿手改）

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

### AppHeader
- 路径：src/components/base/AppHeader.vue
- 用途：全站顶部导航（毛玻璃吸顶）：品牌 + 导航（首页/留言板/用户管理[仅开发者]）+ 用户区
- 适用端：PC
- props：无
- events：无
- 示例：<AppHeader />

### BaseButton
- 路径：src/components/base/BaseButton.vue
- 用途：统一按钮样式与交互（主/次/文字、loading、禁用）
- 适用端：通用
- props：type:'primary'|'default'|'text'=default; loading:Boolean=false; disabled:Boolean=false
- events：click
- 示例：<BaseButton type="primary" :loading="submitting" @click="onSubmit">登录</BaseButton>

### BaseCard
- 路径：src/components/base/BaseCard.vue
- 用途：卡片容器，统一圆角/阴影/内边距
- 适用端：通用
- props：title:String=''; hoverable:Boolean=false
- events：无
- 示例：<BaseCard title="游戏区"><GameArea /></BaseCard>

### BaseInput
- 路径：src/components/base/BaseInput.vue
- 用途：带标签/错误态的文本输入
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

### CabinScene
- 路径：src/components/base/CabinScene.vue
- 用途：小屋场景装饰插画（山丘/木屋/树/太阳），用于首页 Hero 与登录页；纯主题色内联 SVG，宽度由父级控制
- 适用端：PC
- props：无
- events：无
- 示例：<CabinScene />

### EntryCard
- 路径：src/components/base/EntryCard.vue
- 用途：通用入口卡片：圆形手绘图标 + 标题 + 描述 + 箭头。有 to 时渲染 RouterLink，否则渲染 button 并 emit select。游戏区与互动区共用，保证风格一致
- 适用端：通用
- props：to([String,Object], 可选), icon(String, 必填), iconSize(Number=30), title(String, 必填), desc(String=''), arrow(Boolean=true)
- events：select
- 示例：<EntryCard icon="message" title="留言板" desc="写句话给小屋" :to="{ name: 'guestbook' }" />

### FeatherIcon
- 路径：src/components/base/FeatherIcon.vue
- 用途：羽毛内联 SVG 图标（不引图标库）
- 适用端：通用
- props：size:Number=20
- events：无
- 示例：<FeatherIcon :size="28" />

### GameIcon
- 路径：src/components/base/GameIcon.vue
- 用途：按 type 渲染手绘风图标（内联 SVG，暖色配色）：游戏 climb、留言板 message、用户管理 users，便于扩展
- 适用端：PC
- props：type(String, 必填), size(Number=56)
- events：无
- 示例：<GameIcon type="climb" :size="56" />

## 业务组件

### GameArea
- 路径：src/components/GameArea.vue
- 用途：主页游戏区入口列表，每条游戏用 EntryCard（图标+标题+描述+箭头）呈现；后续加游戏只需在 games 数组追加
- 适用端：PC
- props：games(Array)
- events：select(game)
- 示例：<GameArea :games="games" @select="onPlay" />

