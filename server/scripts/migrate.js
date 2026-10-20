import { pool } from '../src/database/client.js'
import { runMigrations } from '../src/database/migration-runner.js'

try {
  await runMigrations(pool)
  process.stdout.write('CIMACH database migrations are up to date.\n')
} catch (error) {
  process.stderr.write(`Migration stopped: ${error.message}\n`)
  process.exitCode = 1
} finally {
  await pool.end()
}
