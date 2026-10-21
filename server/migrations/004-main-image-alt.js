async function ensureColumn(connection, name) {
  const [rows] = await connection.execute(
    `SELECT COLUMN_TYPE AS type, IS_NULLABLE AS nullable,
            COLUMN_DEFAULT AS defaultValue, EXTRA AS extra, COLLATION_NAME AS collation
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'projects' AND column_name = ? LIMIT 1`,
    [name],
  )
  if (!rows.length) {
    await connection.query(`ALTER TABLE projects ADD COLUMN ${name} VARCHAR(512) NULL DEFAULT NULL`)
    return
  }
  const actual = rows[0]
  const defaultValue = actual.defaultValue === null || String(actual.defaultValue).trim().toLowerCase() === 'null'
    ? null
    : String(actual.defaultValue).trim()
  if (String(actual.type).toLowerCase() !== 'varchar(512)' || actual.nullable !== 'YES' ||
      defaultValue !== null || actual.extra !== '' || actual.collation !== 'utf8mb4_unicode_ci') {
    throw new Error(`Existing image-alt schema is incompatible: projects.${name}.`)
  }
}

export async function up(connection) {
  const [tableRows] = await connection.execute(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'projects' LIMIT 1`,
  )
  if (!tableRows.length) throw new Error('Cannot add main-image alt text: projects table is missing.')
  await ensureColumn(connection, 'main_image_alt_pl')
  await ensureColumn(connection, 'main_image_alt_en')
}
