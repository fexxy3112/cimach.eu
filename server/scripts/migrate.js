import { pool } from '../src/database.js'
import { ensureAuthSchema } from '../src/migrate.js'

try {
  await ensureAuthSchema(pool)
  process.stdout.write('CIMACH authentication schema is ready.\n')
} catch (error) {
  process.stderr.write(`Migration stopped: ${error.message}\n`)
  process.exitCode = 1
} finally {
  await pool.end()
}
