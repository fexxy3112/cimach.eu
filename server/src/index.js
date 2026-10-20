import { createApp } from './app.js'
import { config } from './config.js'
import { pool } from './database.js'

try {
  await pool.query('SELECT 1')
  const app = await createApp({ pool, config })
  app.listen(config.port, '127.0.0.1', () => {
    process.stdout.write(`CIMACH API listening on 127.0.0.1:${config.port}\n`)
  })
} catch (error) {
  process.stderr.write(`API startup failed (${error?.name || 'Error'}). Check server configuration and database availability.\n`)
  await pool.end()
  process.exitCode = 1
}
