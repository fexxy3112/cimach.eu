const requiredUserColumns = ['id', 'email', 'password_hash', 'role', 'is_active']

async function tableExists(connection, name) {
  const [rows] = await connection.execute(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [name],
  )
  return rows.length > 0
}

async function assertCompatibleUsersTable(connection) {
  const [columns] = await connection.execute(
    `SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, COLUMN_KEY AS keyType,
            IS_NULLABLE AS nullable, COLUMN_DEFAULT AS defaultValue, EXTRA AS extra
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'users'`,
  )
  const byName = new Map(columns.map((column) => [column.name, column]))
  const missing = requiredUserColumns.filter((name) => !byName.has(name))
  if (missing.length) {
    throw new Error(`Existing users table is not compatible with CIMACH auth; missing columns: ${missing.join(', ')}. No users table was changed.`)
  }

  const idType = byName.get('id').type
  if (!/^(bigint|int|mediumint|smallint|tinyint)(?:\(\d+\))?( unsigned)?$/i.test(idType)) {
    throw new Error('Existing users.id must be an integer column. No users table was changed.')
  }
  if (byName.get('id').keyType !== 'PRI' || !byName.get('id').extra.includes('auto_increment')) {
    throw new Error('Existing users.id must be an auto-increment primary key. No users table was changed.')
  }
  if (!/^varchar\(254\)$/i.test(byName.get('email').type)) {
    throw new Error('Existing users.email must be VARCHAR(254). No users table was changed.')
  }
  if (!/^varchar\(60\)$/i.test(byName.get('password_hash').type)) {
    throw new Error('Existing users.password_hash must be VARCHAR(60). No users table was changed.')
  }
  if (!/^(tinyint\(1\)|tinyint|boolean|bool)$/i.test(byName.get('is_active').type)) {
    throw new Error('Existing users.is_active must be a boolean or tinyint column. No users table was changed.')
  }
  const roleType = byName.get('role').type
  if (!/^(varchar\(\d+\)|enum\()/i.test(roleType)) {
    throw new Error('Existing users.role must be a VARCHAR or ENUM column. No users table was changed.')
  }
  const roleCapacity = roleType.match(/^varchar\((\d+)\)$/i)
  if (roleCapacity && Number(roleCapacity[1]) < 5) {
    throw new Error("Existing users.role must be able to store 'admin'. No users table was changed.")
  }
  for (const name of ['email', 'password_hash', 'role', 'is_active']) {
    if (byName.get(name).nullable !== 'NO') {
      throw new Error(`Existing users.${name} must be NOT NULL. No users table was changed.`)
    }
  }
  if (/^enum\(/i.test(byName.get('role').type) && !byName.get('role').type.includes("'admin'")) {
    throw new Error("Existing users.role enum must allow 'admin'. No users table was changed.")
  }
  if (String(byName.get('role').defaultValue).toLowerCase() === 'admin') {
    throw new Error("Existing users.role must not default to 'admin'. No users table was changed.")
  }

  const [emailIndexes] = await connection.execute(
    `SELECT INDEX_NAME AS name, COUNT(*) AS columnCount,
            MAX(CASE WHEN COLUMN_NAME = 'email' THEN 1 ELSE 0 END) AS hasEmail
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'users' AND NON_UNIQUE = 0
     GROUP BY INDEX_NAME`,
  )
  if (!emailIndexes.some((index) => Number(index.columnCount) === 1 && Number(index.hasEmail) === 1)) {
    throw new Error('Existing users.email must have a unique index. No users table was changed.')
  }

  const requiredNoDefault = columns.filter((column) =>
    column.nullable === 'NO' && column.defaultValue === null && !column.extra.includes('auto_increment') && !requiredUserColumns.includes(column.name),
  )
  if (requiredNoDefault.length) {
    throw new Error(`Existing users table has required extra columns that bootstrap cannot populate: ${requiredNoDefault.map(({ name }) => name).join(', ')}. No users table was changed.`)
  }
  return idType
}

export async function ensureAuthSchema(pool) {
  const connection = await pool.getConnection()
  try {
    let idType
    const usersExists = await tableExists(connection, 'users')
    const sessionsExist = await tableExists(connection, 'auth_sessions')
    if (!usersExists && sessionsExist) {
      throw new Error('auth_sessions exists without users. Resolve the existing schema before applying this migration.')
    }

    if (usersExists) {
      idType = await assertCompatibleUsersTable(connection)
    } else {
      await connection.query(`
        CREATE TABLE users (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          email VARCHAR(254) NOT NULL,
          password_hash VARCHAR(60) NOT NULL,
          role VARCHAR(32) NOT NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 0,
          PRIMARY KEY (id),
          UNIQUE KEY users_email_unique (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      idType = 'bigint unsigned'
    }

    if (!sessionsExist) {
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
    } else {
      const [columns] = await connection.execute(
        `SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, COLUMN_KEY AS keyType,
                IS_NULLABLE AS nullable
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'auth_sessions'`,
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
        throw new Error('Existing auth_sessions.user_id must be NOT NULL and revoked_at must be nullable.')
      }
      for (const name of ['expires_at', 'revoked_at', 'created_at']) {
        if (!/^datetime(?:\(3\))?$/i.test(byName.get(name).type)) {
          throw new Error(`Existing auth_sessions.${name} must be DATETIME.`)
        }
      }
    }
  } finally {
    connection.release()
  }
}
