import { randomBytes } from 'node:crypto'
import sharp from 'sharp'

export function createImageUploadController(uploads) {
  return {
    async upload(req, res, next) {
      try {
        const source = sharp(req.file.buffer, { limitInputPixels: 40_000_000, failOn: 'error' })
        let metadata
        let optimized
        let outputMetadata
        try {
          metadata = await source.metadata()
          if (!['jpeg', 'png', 'webp'].includes(metadata.format || '')) {
            return res.status(415).json({ error: 'unsupported_image_type' })
          }
          optimized = await source.rotate()
            .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 82, effort: 5 })
            .toBuffer()
          outputMetadata = await sharp(optimized).metadata()
        } catch {
          return res.status(422).json({ error: 'invalid_image' })
        }
        const filename = `${randomBytes(20).toString('hex')}.webp`
        await uploads.store(filename, optimized, req.auth.userId)

        return res.status(201).json({
          url: `/api/uploads/${filename}`,
          contentType: 'image/webp',
          size: optimized.length,
          width: outputMetadata.width || null,
          height: outputMetadata.height || null,
        })
      } catch (error) {
        return next(error)
      }
    },

    serve(req, res, next) {
      const { filename } = req.params
      if (!/^[a-f0-9]{40}\.webp$/.test(filename)) return res.status(404).json({ error: 'not_found' })
      res.type('image/webp')
      res.set('Cache-Control', 'public, max-age=31536000, immutable')
      return res.sendFile(filename, { root: uploads.directory }, (error) => {
        if (error && !res.headersSent) {
          if (error.statusCode === 404) return res.status(404).json({ error: 'not_found' })
          return next(error)
        }
      })
    },

    async discard(req, res, next) {
      const urls = req.body?.urls
      if (!Array.isArray(urls) || urls.length > 51 || urls.some((url) => typeof url !== 'string' || url.length > 2048)) {
        return res.status(422).json({ error: 'invalid_uploads' })
      }
      try {
        return res.json(await uploads.discard(urls, req.auth.userId))
      } catch (error) { return next(error) }
    },
  }
}
