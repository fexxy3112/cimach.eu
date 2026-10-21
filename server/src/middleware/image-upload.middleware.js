import multer from 'multer'

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  fileFilter(_req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) return callback(new Error('unsupported_image_type'))
    return callback(null, true)
  },
}).single('image')

export function receiveImageUpload(req, res, next) {
  upload(req, res, (error) => {
    if (!error) {
      if (!req.file) return res.status(422).json({ error: 'image_required' })
      return next()
    }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'image_too_large' })
    }
    if (error.message === 'unsupported_image_type') return res.status(415).json({ error: 'unsupported_image_type' })
    return res.status(400).json({ error: 'invalid_upload' })
  })
}
