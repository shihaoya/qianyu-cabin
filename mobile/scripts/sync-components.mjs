// 自动生成 docs/COMPONENTS.md：扫描 src/components 下所有 .vue 顶部的 @doc 注释块。
// 运行：node scripts/sync-components.mjs  （或 pnpm docs:components）
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const componentsDir = join(projectRoot, 'src', 'components')
const outFile = join(projectRoot, 'docs', 'COMPONENTS.md')

function walk(dir) {
  if (!existsSync(dir)) return []
  const files = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) files.push(...walk(p))
    else if (p.endsWith('.vue')) files.push(p)
  }
  return files
}

function parseDoc(src) {
  const m = src.match(/<!--\s*@doc([\s\S]*?)-->/)
  if (!m) return null
  const doc = {}
  for (const raw of m[1].split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const val = line.slice(idx + 1).trim()
    if (key) doc[key] = val
  }
  return doc.name ? doc : null
}

const docs = walk(componentsDir)
  .map((f) => parseDoc(readFileSync(f, 'utf8')))
  .filter(Boolean)

const base = docs.filter((d) => (d.category || 'business') === 'base')
const business = docs.filter((d) => (d.category || 'business') === 'business')

function renderEntry(d) {
  let s = `### ${d.name}\n`
  s += `- 路径：${d.path || '（未填）'}\n`
  if (d.purpose) s += `- 用途：${d.purpose}\n`
  if (d.appliesTo) s += `- 适用端：${d.appliesTo}\n`
  if (d.props) s += `- props：${d.props}\n`
  if (d.events) s += `- events：${d.events}\n`
  if (d.example) s += `- 示例：${d.example}\n`
  return s + '\n'
}

let out = ''
out += '# 移动端组件清单（自动生成，请勿手改）\n\n'
out += '> 本文件由 `scripts/sync-components.mjs` 自动生成。组件说明的**唯一来源**是每个 `.vue` 文件顶部的 `@doc` 注释块。\n'
out += '> 增加或改动组件后，运行 `pnpm docs:components`（或 `node scripts/sync-components.mjs`）重新生成本文件。请勿手动编辑本文件。\n\n'
out += '## @doc 块格式（写在 .vue 顶部）\n\n'
out += '```\n<!--\n@doc\nname: 组件名\npath: 相对路径\ncategory: base|business\npurpose: 一句话用途\nappliesTo: 通用|PC|移动\nprops: prop:类型=默认 — 说明\nevents: event:payload — 说明\nexample: <Xxx />\n-->\n```\n\n'
out += '## 基础组件\n\n'
out += base.length
  ? base.map(renderEntry).join('')
  : '（暂无，添加带 `@doc` 且 `category: base` 的组件后运行脚本生成）\n\n'
out += '## 业务组件\n\n'
out += business.length
  ? business.map(renderEntry).join('')
  : '（暂无，添加带 `@doc` 且 `category: business` 的组件后运行脚本生成）\n'

writeFileSync(outFile, out)
console.log(`已生成 ${outFile}，共 ${docs.length} 个组件`)
