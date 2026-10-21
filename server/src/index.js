import { createApp } from './app.js'
import { config } from './config/env.js'
import { pool } from './database/client.js'
import { createUploadService } from './services/upload.service.js'

async function start() {
  try {
    await pool.query('SELECT 1')
    const app = await createApp({ pool, config })
    const uploads = createUploadService({ pool, config })
    const cleanup = () => uploads.cleanup().catch(() => {
      process.stderr.write('Upload cleanup failed; will retry on the next scheduled run.\n')
    })
    await cleanup()
    const cleanupTimer = setInterval(cleanup, 60 * 60 * 1000)
    cleanupTimer.unref()
    app.listen(config.port, '127.0.0.1', () => {
      process.stdout.write(`CIMACH API listening on 127.0.0.1:${config.port}\n`)
    })
  } catch (error) {
    process.stderr.write(`API startup failed (${error?.name || 'Error'}). Check server configuration and database availability.\n`)
    await pool.end()
    process.exitCode = 1
  }
}

start()
