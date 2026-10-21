import { pool } from '../src/database/client.js'
import { config } from '../src/config/env.js'
import { createUploadService } from '../src/services/upload.service.js'

try {
  const result = await createUploadService({ pool, config }).cleanup()
  console.log(`Upload cleanup: removed ${result.removed} unused images.`)
} catch {
  console.error('Upload cleanup failed. Check database access and upload directory permissions.')
  process.exitCode = 1
} finally { await pool.end() }
