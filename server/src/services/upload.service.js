import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const filenamePattern = /^[a-f0-9]{40}\.webp$/
const pendingLifetime = 24 * 60 * 60 * 1000
const lockName = 'cimach-upload-lifecycle'

function uploadError(code) {
  return Object.assign(new Error(code), { code })
}

export function createUploadService({ pool, config, now = Date.now }) {
  const directory = config.uploadDir || fileURLToPath(new URL('../../uploads/', import.meta.url))
  const metadataDirectory = join(directory, '.metadata')
  const origin = new URL(config.frontendOrigin).origin

  function filenameFromUrl(value) {
    if (typeof value !== 'string' || !value) return null
    let url
    try { url = new URL(value, origin) } catch { return null }
    if (url.origin !== origin) return null
    let pathname
    try { pathname = decodeURIComponent(url.pathname) } catch { throw uploadError('INVALID_UPLOAD') }
    if (!pathname.startsWith('/api/uploads/')) return null
    const filename = pathname.slice('/api/uploads/'.length)
    if (!filenamePattern.test(filename)) throw uploadError('INVALID_UPLOAD')
    return filename
  }

  async function readMetadata(filename) {
    try {
      const metadata = JSON.parse(await readFile(join(metadataDirectory, `${filename}.json`), 'utf8'))
      if (typeof metadata.owner !== 'string' || !Number.isFinite(metadata.createdAt) ||
          !['pending', 'committed'].includes(metadata.state)) throw uploadError('INVALID_UPLOAD_METADATA')
      return metadata
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  }

  async function writeMetadata(filename, metadata) {
    await mkdir(metadataDirectory, { recursive: true })
    const target = join(metadataDirectory, `${filename}.json`)
    const temporary = `${target}.tmp`
    await writeFile(temporary, JSON.stringify(metadata), { mode: 0o600 })
    await rename(temporary, target)
  }

  async function isReferenced(connection, filename) {
    const relative = `/api/uploads/${filename}`
    const absolute = `${origin}${relative}`
    const [rows] = await connection.execute(
      `SELECT id FROM projects WHERE main_image_url IN (?, ?)
       UNION ALL SELECT project_id AS id FROM project_images WHERE source_url IN (?, ?) LIMIT 1`,
      [relative, absolute, relative, absolute],
    )
    return rows.length > 0
  }

  async function locked(action) {
    const connection = await pool.getConnection()
    let acquired = false
    try {
      const [rows] = await connection.execute('SELECT GET_LOCK(?, 15) AS acquired', [lockName])
      acquired = Number(rows[0]?.acquired) === 1
      if (!acquired) throw uploadError('UPLOAD_BUSY')
      return await action(connection)
    } finally {
      if (acquired) {
        try { await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]) } catch { connection.destroy?.() }
      }
      connection.release()
    }
  }

  async function remove(filename) {
    // Both paths use generated names only. Keep metadata until file removal succeeds.
    await unlink(join(directory, filename)).catch((error) => { if (error.code !== 'ENOENT') throw error })
    await unlink(join(metadataDirectory, `${filename}.json`)).catch((error) => { if (error.code !== 'ENOENT') throw error })
  }

  async function sweepLocked(connection) {
    let entries
    try { entries = await readdir(metadataDirectory) } catch (error) {
      if (error.code === 'ENOENT') return { removed: 0 }
      throw error
    }
    let removed = 0
    for (const entry of entries) {
      const filename = entry.endsWith('.json') ? entry.slice(0, -5) : ''
      if (!filenamePattern.test(filename)) continue
      const metadata = await readMetadata(filename)
      if (!metadata) continue
      if (metadata.state === 'pending' && now() - metadata.createdAt < pendingLifetime) continue
      if (await isReferenced(connection, filename)) {
        if (metadata.state !== 'committed') await writeMetadata(filename, { ...metadata, state: 'committed' })
        continue
      }
      await remove(filename)
      removed++
    }
    return { removed }
  }

  return {
    directory: resolve(directory),
    filenameFromUrl,

    async store(filename, bytes, userId) {
      if (!filenamePattern.test(filename)) throw uploadError('INVALID_UPLOAD')
      return locked(async () => {
        await mkdir(directory, { recursive: true })
        // Record before writing bytes so a crash never leaves an untracked image.
        await writeMetadata(filename, { owner: String(userId), createdAt: now(), state: 'pending' })
        await writeFile(join(directory, filename), bytes, { flag: 'wx', mode: 0o644 })
      })
    },

    async discard(urls, userId) {
      return locked(async (connection) => {
        let removed = 0
        for (const url of urls) {
          const filename = filenameFromUrl(url)
          if (!filename) continue
          const metadata = await readMetadata(filename)
          if (!metadata || metadata.state !== 'pending' || metadata.owner !== String(userId)) continue
          if (await isReferenced(connection, filename)) continue
          await remove(filename)
          removed++
        }
        return { removed }
      })
    },

    async saveProject(project, userId, save) {
      return locked(async (connection) => {
        const filenames = new Set()
        const normalize = async (url) => {
          const filename = filenameFromUrl(url)
          if (!filename) return url
          const metadata = await readMetadata(filename)
          const referenced = await isReferenced(connection, filename)
          if ((!metadata && !referenced) || (metadata?.state === 'pending' && metadata.owner !== String(userId))) {
            throw uploadError('INVALID_UPLOAD')
          }
          try { await stat(join(directory, filename)) } catch { throw uploadError('INVALID_UPLOAD') }
          filenames.add(filename)
          return `/api/uploads/${filename}`
        }
        const normalized = {
          ...project,
          mainImageUrl: await normalize(project.mainImageUrl),
          gallery: await Promise.all(project.gallery.map(async (image) => ({ ...image, src: await normalize(image.src) }))),
        }
        const result = await save(normalized, connection)
        if (!result) return result
        // SQL references are authoritative even if filesystem housekeeping fails after commit.
        try {
          for (const filename of filenames) {
            const metadata = await readMetadata(filename)
            await writeMetadata(filename, { owner: metadata?.owner || String(userId), createdAt: metadata?.createdAt ?? now(), state: 'committed' })
          }
          await sweepLocked(connection)
        } catch {
          console.error('Upload housekeeping failed after project save; scheduled cleanup will retry.')
        }
        return result
      })
    },

    async cleanup() { return locked(sweepLocked) },
  }
}
