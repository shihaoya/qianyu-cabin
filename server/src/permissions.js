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
  [ROLE.ADMIN]: '管理员',
  [ROLE.OWNER]: '开发管理员',
}

// 能力枚举（key 为语义常量，value 为 can() 判定时使用的字符串）
export const CAP = {
  MANAGE_USERS: 'manageUsers', // 查看 / 修改用户
  DELETE_USERS: 'deleteUsers', // 删除用户：开发管理员可删管理员与用户，管理员只能删用户
  SET_OWNER: 'setOwner', // 将他人设为开发管理员
  OWNER_TOOLS: 'ownerTools', // 仅开发管理员可见的开发工具（后端当前无对应路由）
  MANAGE_BENEFITS: 'manageBenefits', // 福利管理：福利类型与粉丝的卡
}

// 能力 → 所需最低角色（role 的 rank 大于等于该值即可）
export const CAP_ROLE = {
  [CAP.MANAGE_USERS]: ROLE.ADMIN,
  // 与改角色同级：管理员只能动用户，开发管理员可动管理员与用户
  [CAP.DELETE_USERS]: ROLE.ADMIN,
  [CAP.SET_OWNER]: ROLE.OWNER,
  // 福利管理与用户管理同级：管理员与开发管理员均可维护
  [CAP.MANAGE_BENEFITS]: ROLE.ADMIN,
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

// actor 能否删除 target 账号：① 不能删自己 ② 开发管理员账号不可删除 ③ 自身层级须高于目标角色层级。
// 与 canSetRole 的「>=」不同，这里是「>」：管理员（rank2）只能删用户（rank1），删不了管理员；
// 开发管理员（rank3）可删管理员与用户。
export function canDeleteUser(actor, target) {
  if (!actor || !target) return false
  if (actor.id === target.id) return false
  if (target.role === ROLE.OWNER) return false
  return rankOf(actor.role) > rankOf(target.role)
}
