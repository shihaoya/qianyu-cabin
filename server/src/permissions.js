// 角色与权限的单一真源（后端）
// 任何「某角色能做什么」的判定都必须经过 can()，便于集中排查与统一维护。
// 新增能力：在 CAP_ROLE 登记，前后端即可复用同一套权限语言。
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
  MANAGE_USERS: 'manageUsers', // 查看 / 修改用户
  SET_OWNER: 'setOwner', // 将他人设为开发管理员（站长）
  OWNER_TOOLS: 'ownerTools', // 仅开发管理员（站长）可见的开发工具（后端当前无对应路由）
}

// 能力 → 所需最低角色（role 的 rank 大于等于该值即可）
export const CAP_ROLE = {
  [CAP.MANAGE_USERS]: ROLE.ADMIN,
  [CAP.SET_OWNER]: ROLE.OWNER,
}

export const rankOf = (role) => ROLE_RANK[role] ?? 0

// 判断 user 是否拥有某项能力。所有权限判断的唯一入口。
export function can(user, cap) {
  const need = CAP_ROLE[cap]
  if (!need) return false
  return rankOf(user?.role) >= rankOf(need)
}

export function isValidRole(role) {
  return ROLES.includes(role)
}

export function roleLabel(role) {
  return ROLE_LABEL[role] ?? role
}
