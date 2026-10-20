export function createSessionModel(pool) {
  return {
    async create({ id, userId, expiresAt }) {
      await pool.execute(
        `INSERT INTO auth_sessions (id, user_id, expires_at, created_at)
         VALUES (?, ?, ?, UTC_TIMESTAMP(3))`,
        [id, userId, expiresAt],
      )
    },

    async findActive({ id, userId }) {
      const [rows] = await pool.execute(
        `SELECT u.id, u.email, u.role
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = ? AND s.user_id = ? AND s.revoked_at IS NULL
           AND s.expires_at > UTC_TIMESTAMP(3) AND u.is_active = 1
         LIMIT 1`,
        [id, userId],
      )
      return rows[0] || null
    },

    async revoke({ id, userId }) {
      await pool.execute(
        `UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP(3)
         WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
        [id, userId],
      )
    },
  }
}
