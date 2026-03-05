#!/usr/bin/env tsx
/**
 * 用户管理脚本 — 私有化部署时用
 *
 * 用法:
 *   npx tsx scripts/manage-users.ts list
 *   npx tsx scripts/manage-users.ts create <username> <password> [role]
 *   npx tsx scripts/manage-users.ts reset-password <username> <newPassword>
 *   npx tsx scripts/manage-users.ts set-role <username> <admin|trader>
 *   npx tsx scripts/manage-users.ts disable <username>
 *   npx tsx scripts/manage-users.ts enable <username>
 *   npx tsx scripts/manage-users.ts delete <username>
 */
import '../src/config'
import { getDb } from '../src/db'
import {
  listUsers, createUser, updateUser, deleteUser,
  getUserByUsername, type UserRole,
} from '../src/services/userStore'

// 确保 DB 初始化
getDb()

const [,, cmd, ...args] = process.argv

async function main() {
  switch (cmd) {
    case 'list': {
      const users = listUsers()
      console.log('\n用户列表:')
      console.log('─'.repeat(80))
      console.log(
        'ID'.padEnd(38) + 'Username'.padEnd(16) + 'Role'.padEnd(10) +
        'Status'.padEnd(10) + 'DisplayName'
      )
      console.log('─'.repeat(80))
      for (const u of users) {
        console.log(
          u.id.padEnd(38) + u.username.padEnd(16) + u.role.padEnd(10) +
          u.status.padEnd(10) + u.displayName
        )
      }
      console.log(`\n共 ${users.length} 个用户\n`)
      break
    }
    case 'create': {
      const [username, password, role = 'trader'] = args
      if (!username || !password) { console.error('用法: create <username> <password> [admin|trader]'); process.exit(1) }
      const user = await createUser({ username, password, role: role as UserRole, displayName: username })
      console.log(`✓ 用户创建成功: ${user.username} (${user.role})`)
      break
    }
    case 'reset-password': {
      const [username, newPwd] = args
      if (!username || !newPwd) { console.error('用法: reset-password <username> <newPassword>'); process.exit(1) }
      const u = getUserByUsername(username)
      if (!u) { console.error(`用户 "${username}" 不存在`); process.exit(1) }
      await updateUser(u.id, { password: newPwd })
      console.log(`✓ 密码已重置: ${username}`)
      break
    }
    case 'set-role': {
      const [username, newRole] = args
      if (!username || !['admin', 'trader'].includes(newRole)) {
        console.error('用法: set-role <username> <admin|trader>'); process.exit(1)
      }
      const u = getUserByUsername(username)
      if (!u) { console.error(`用户 "${username}" 不存在`); process.exit(1) }
      await updateUser(u.id, { role: newRole as UserRole })
      console.log(`✓ 角色已更新: ${username} → ${newRole}`)
      break
    }
    case 'disable': {
      const [username] = args
      if (!username) { console.error('用法: disable <username>'); process.exit(1) }
      const u = getUserByUsername(username)
      if (!u) { console.error(`用户 "${username}" 不存在`); process.exit(1) }
      await updateUser(u.id, { status: 'disabled' })
      console.log(`✓ 用户已禁用: ${username}`)
      break
    }
    case 'enable': {
      const [username] = args
      if (!username) { console.error('用法: enable <username>'); process.exit(1) }
      const u = getUserByUsername(username)
      if (!u) { console.error(`用户 "${username}" 不存在`); process.exit(1) }
      await updateUser(u.id, { status: 'active' })
      console.log(`✓ 用户已启用: ${username}`)
      break
    }
    case 'delete': {
      const [username] = args
      if (!username) { console.error('用法: delete <username>'); process.exit(1) }
      const u = getUserByUsername(username)
      if (!u) { console.error(`用户 "${username}" 不存在`); process.exit(1) }
      deleteUser(u.id)
      console.log(`✓ 用户已删除: ${username}`)
      break
    }
    default:
      console.log(`
用户管理脚本

用法:
  npx tsx scripts/manage-users.ts <command> [args...]

命令:
  list                              列出所有用户
  create <user> <pwd> [role]        创建用户 (role: admin|trader, 默认 trader)
  reset-password <user> <newPwd>    重置密码
  set-role <user> <admin|trader>    修改角色
  disable <user>                    禁用用户
  enable <user>                     启用用户
  delete <user>                     删除用户
`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
