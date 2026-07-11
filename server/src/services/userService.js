import bcrypt from 'bcryptjs'
import { prisma } from '../db/index.js'
import { ERR } from '../utils/errors.js'

export async function register(nickname, password) {
  const existing = await prisma.user.findUnique({ where: { nickname } })
  if (existing) throw ERR.NICKNAME_TAKEN()

  const passwordHash = await bcrypt.hash(password, 10)
  return prisma.user.create({ data: { nickname, passwordHash } })
}

export async function verifyCredentials(nickname, password) {
  const user = await prisma.user.findUnique({ where: { nickname } })
  if (!user) throw ERR.BAD_CREDENTIALS()

  const matched = await bcrypt.compare(password, user.passwordHash)
  if (!matched) throw ERR.BAD_CREDENTIALS()

  return user
}

export async function getUserById(id) {
  return prisma.user.findUnique({ where: { id } })
}
