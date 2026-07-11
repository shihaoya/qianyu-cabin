// 角色与权限的单一真源（前端 Mobile）
// 与 server/src/permissions.js 保持语义一致。判定一律走 can()，便于排查。
// 新增能力只需在此登记（CAP_ROLE），前后端即可复用同一套权限语言。
// 角色/能力字符串一律用 ROLE.* / CAP.* 枚举，禁止在业务代码里硬编码字面量。

// 角色枚举
export const ROLE = { USER: 'user', ADMIN: 'admin', OWNER: 'owner' }
export const ROLES = [ROLE.USER, ROLE.ADMIN, ROLE.OWNER]

// 角色层级（user < admin < owner）
export const ROLE_RANK = { [ROLE.USER]: 1, [ROLE.ADMIN]: 2, [ROLE.OWNER]: 3 }

// 角色中文名
export const ROLE_LABEL = {
  [ROLE.USER]: '用户',
  [ROLE.ADMIN]: '管理员（开发者）',
  [ROLE.OWNER]: '开发管理员（站长）',
}

// 能力枚举（key 为语义常量，value 为 can() 判定时使用的字符串）
export const CAP = {
  MANAGE_USERS: 'manageUsers', // 用户管理
  OWNER_TOOLS: 'ownerTools', // 仅开发管理员（站长）可见的开发工具（如图标工作室）
}

// 能力 → 所需最低角色
export const CAP_ROLE = {
  [CAP.MANAGE_USERS]: ROLE.ADMIN,
  [CAP.OWNER_TOOLS]: ROLE.OWNER,
}

export const rankOf = (role) => ROLE_RANK[role] ?? 0

// 判断 user 是否拥有某项能力。所有权限判断的唯一入口。
export function can(user, cap) {
  const need = CAP_ROLE[cap]
  if (!need) return false
  return rankOf(user?.role) >= rankOf(need)
}

export function roleLabel(role) {
  return ROLE_LABEL[role] ?? role
}

// 当前用户能否把他人设为 targetRole（只看自身层级，与目标无关）。
// 新增角色后无需改动此处，按 ROLE_RANK 自动判定。
export function canAssignRole(user, targetRole) {
  return rankOf(user?.role) >= rankOf(targetRole)
}

// 完整校验：actor 能否把 target 改为 newRole。
// 规则：① 不能改自己 ② 不能动开发管理员账号（仅开发管理员可）③ 自身层级须 >= 目标角色层级。
// 新增角色后无需改动此处，①②③ 的层级部分全部由 ROLE_RANK 派生。
export function canSetRole(actor, target, newRole) {
  if (!actor || !target) return false
  if (actor.id === target.id) return false
  if (target.role === ROLE.OWNER && actor.role !== ROLE.OWNER) return false
  return canAssignRole(actor, newRole)
}
