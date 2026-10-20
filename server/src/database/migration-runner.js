import { readdir } from 'node:fs/promises'

const migrationDirectory = new URL('../../migrations/', import.meta.url)

export async function runMigrations(pool) {
  const connection = await pool.getConnection()
  let lockAcquired = false
  try {
    const [lockRows] = await connection.execute('SELECT GET_LOCK(?, 30) AS acquired', ['cimach-schema-migrations'])
    lockAcquired = Number(lockRows[0]?.acquired) === 1
    if (!lockAcquired) throw new Error('Could not acquire schema migration lock.')

    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(128) NOT NULL,
        applied_at DATETIME(3) NOT NULL,
        PRIMARY KEY (version)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    const filenames = (await readdir(migrationDirectory))
      .filter((name) => /^\d{3,}-[a-z0-9-]+\.js$/i.test(name))
      .sort()

    for (const filename of filenames) {
      const version = filename.slice(0, -3)
      const [applied] = await connection.execute('SELECT 1 FROM schema_migrations WHERE version = ? LIMIT 1', [version])
      if (applied.length) continue

      const migration = await import(new URL(filename, migrationDirectory).href)
      if (typeof migration.up !== 'function') throw new Error(`Migration ${version} must export an up(connection) function.`)
      await migration.up(connection)
      await connection.execute('INSERT INTO schema_migrations (version, applied_at) VALUES (?, UTC_TIMESTAMP(3))', [version])
      process.stdout.write(`Applied migration ${version}\n`)
    }
  } finally {
    if (lockAcquired) {
      try { await connection.execute('SELECT RELEASE_LOCK(?)', ['cimach-schema-migrations']) } catch { /* release on connection close */ }
    }
    connection.release()
  }
}
