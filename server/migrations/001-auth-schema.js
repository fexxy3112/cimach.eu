const userColumns = ['id', 'email', 'password_hash', 'role', 'is_active']

async function tableExists(connection, name) {
  const [rows] = await connection.execute(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [name],
  )
  return rows.length > 0
}

async function inspectUsers(connection) {
  const [columns] = await connection.execute(
    `SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, COLUMN_KEY AS keyType,
            IS_NULLABLE AS nullable, COLUMN_DEFAULT AS defaultValue, EXTRA AS extra
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'users'`,
  )
  return columns
}

function assertUsersCompatible(columns) {
  const byName = new Map(columns.map((column) => [column.name, column]))
  const missing = userColumns.filter((name) => !byName.has(name))
  if (missing.length) {
    throw new Error(`Existing users table is incompatible; missing columns: ${missing.join(', ')}. No users table was changed.`)
  }

  const id = byName.get('id')
  if (!/^(bigint|int|mediumint|smallint|tinyint)(?:\(\d+\))?( unsigned)?$/i.test(id.type) || id.keyType !== 'PRI' || !id.extra.includes('auto_increment')) {
    throw new Error('Existing users.id must be an auto-increment integer primary key. No users table was changed.')
  }
  if (!/^varchar\(254\)$/i.test(byName.get('email').type) || !/^varchar\(60\)$/i.test(byName.get('password_hash').type)) {
    throw new Error('Existing users.email and users.password_hash must be VARCHAR(254) and VARCHAR(60). No users table was changed.')
  }
  if (!/^(tinyint\(1\)|tinyint|boolean|bool)$/i.test(byName.get('is_active').type)) {
    throw new Error('Existing users.is_active must be a boolean or tinyint column. No users table was changed.')
  }

  const role = byName.get('role')
  if (!/^(varchar\(\d+\)|enum\()/i.test(role.type)) {
    throw new Error('Existing users.role must be a VARCHAR or ENUM column. No users table was changed.')
  }
  const capacity = role.type.match(/^varchar\((\d+)\)$/i)
  if ((capacity && Number(capacity[1]) < 5) || (/^enum\(/i.test(role.type) && !role.type.includes("'admin'"))) {
    throw new Error("Existing users.role must allow 'admin'. No users table was changed.")
  }
  for (const name of ['email', 'password_hash', 'role', 'is_active']) {
    if (byName.get(name).nullable !== 'NO') throw new Error(`Existing users.${name} must be NOT NULL. No users table was changed.`)
  }
  if (String(role.defaultValue).toLowerCase() === 'admin') {
    throw new Error("Existing users.role must not default to 'admin'. No users table was changed.")
  }

  const requiredNoDefault = columns.filter((column) =>
    column.nullable === 'NO' && column.defaultValue === null && !column.extra.includes('auto_increment') && !userColumns.includes(column.name),
  )
  if (requiredNoDefault.length) {
    throw new Error(`Existing users table has required extra columns the admin setup cannot populate: ${requiredNoDefault.map(({ name }) => name).join(', ')}. No users table was changed.`)
  }
  return { idType: id.type, byName }
}

async function assertUniqueEmailIndex(connection) {
  const [indexes] = await connection.execute(
    `SELECT INDEX_NAME AS name, COUNT(*) AS columnCount,
            MAX(CASE WHEN COLUMN_NAME = 'email' THEN 1 ELSE 0 END) AS hasEmail
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'users' AND NON_UNIQUE = 0
     GROUP BY INDEX_NAME`,
  )
  if (!indexes.some((index) => Number(index.columnCount) === 1 && Number(index.hasEmail) === 1)) {
    throw new Error('Existing users.email must have a unique index. No users table was changed.')
  }
}

async function ensureUserTimestamps(connection, byName) {
  if (!byName.has('created_at')) {
    await connection.query('ALTER TABLE users ADD COLUMN created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)')
  } else if (!/^datetime(?:\(3\))?$/i.test(byName.get('created_at').type)) {
    throw new Error('Existing users.created_at must be DATETIME. No users table was changed.')
  }

  if (!byName.has('updated_at')) {
    await connection.query('ALTER TABLE users ADD COLUMN updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)')
  } else if (!/^datetime(?:\(3\))?$/i.test(byName.get('updated_at').type)) {
    throw new Error('Existing users.updated_at must be DATETIME. No users table was changed.')
  }
}

async function ensureSessions(connection, idType) {
  if (!await tableExists(connection, 'auth_sessions')) {
    await connection.query(`
      CREATE TABLE auth_sessions (
        id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        user_id ${idType} NOT NULL,
        expires_at DATETIME(3) NOT NULL,
        revoked_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL,
        PRIMARY KEY (id),
        KEY auth_sessions_user_expiry (user_id, expires_at),
        CONSTRAINT auth_sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    return
  }

  const [columns] = await connection.execute(
    `SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, COLUMN_KEY AS keyType, IS_NULLABLE AS nullable
     FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'auth_sessions'`,
  )
  const byName = new Map(columns.map((column) => [column.name, column]))
  const required = ['id', 'user_id', 'expires_at', 'revoked_at', 'created_at']
  const missing = required.filter((name) => !byName.has(name))
  if (missing.length) throw new Error(`Existing auth_sessions table is incompatible; missing: ${missing.join(', ')}.`)
  if (!/^char\(36\)$/i.test(byName.get('id').type) || byName.get('id').keyType !== 'PRI') {
    throw new Error('Existing auth_sessions.id must be a CHAR(36) primary key.')
  }
  if (byName.get('user_id').type.toLowerCase() !== idType.toLowerCase()) {
    throw new Error('Existing auth_sessions.user_id must match users.id type.')
  }
  if (byName.get('user_id').nullable !== 'NO' || byName.get('revoked_at').nullable !== 'YES') {
    throw new Error('Existing auth_sessions.user_id must be NOT NULL and revoked_at nullable.')
  }
  for (const name of ['expires_at', 'revoked_at', 'created_at']) {
    if (!/^datetime(?:\(3\))?$/i.test(byName.get(name).type)) throw new Error(`Existing auth_sessions.${name} must be DATETIME.`)
  }
}

export async function up(connection) {
  if (await tableExists(connection, 'users')) {
    const compatibility = assertUsersCompatible(await inspectUsers(connection))
    await assertUniqueEmailIndex(connection)
    await ensureUserTimestamps(connection, compatibility.byName)
    await ensureSessions(connection, compatibility.idType)
    return
  }

  if (await tableExists(connection, 'auth_sessions')) {
    throw new Error('auth_sessions exists without users. Resolve the existing schema before applying this migration.')
  }

  await connection.query(`
    CREATE TABLE users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      email VARCHAR(254) NOT NULL,
      password_hash VARCHAR(60) NOT NULL,
      role VARCHAR(32) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY users_email_unique (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await ensureSessions(connection, 'bigint unsigned')
}
