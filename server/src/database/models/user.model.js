export function createUserModel(pool) {
  return {
    async findByEmail(email) {
      const [rows] = await pool.execute(
        `SELECT id, email, password_hash, role, is_active, created_at, updated_at
         FROM users WHERE email = ? LIMIT 1`,
        [email],
      )
      return rows[0] || null
    },

    async countAdmins(connection = pool) {
      const [rows] = await connection.execute("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'")
      return Number(rows[0].count)
    },

    async createAdmin({ email, passwordHash }, connection = pool) {
      const [result] = await connection.execute(
        `INSERT INTO users (email, password_hash, role, is_active)
         VALUES (?, ?, 'admin', 1)`,
        [email, passwordHash],
      )
      return result.insertId
    },
  }
}
