function normalizeDefault(value) {
  if (value === null || value === undefined || String(value).trim().toLowerCase() === 'null') return null
  return String(value).trim().toLowerCase().replace(/^'(.*)'$/, '$1')
}

async function ensureColumn(connection, name, definition, expected) {
  const [rows] = await connection.execute(
    `SELECT COLUMN_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS defaultValue
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'projects' AND column_name = ? LIMIT 1`,
    [name],
  )
  if (!rows.length) {
    await connection.query(`ALTER TABLE projects ADD COLUMN ${name} ${definition}`)
    return
  }
  const column = rows[0]
  if (String(column.type).toLowerCase() !== expected.type ||
      column.nullable !== expected.nullable || normalizeDefault(column.defaultValue) !== expected.defaultValue) {
    throw new Error(`Existing featured-project schema is incompatible: projects.${name}.`)
  }
}

export async function up(connection) {
  const [tableRows] = await connection.execute(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'projects' LIMIT 1`,
  )
  if (!tableRows.length) throw new Error('Cannot add featured fields: projects table is missing.')

  await ensureColumn(connection, 'is_featured', 'TINYINT(1) NOT NULL DEFAULT 0', {
    type: 'tinyint(1)', nullable: 'NO', defaultValue: '0',
  })
  await ensureColumn(connection, 'featured_order', 'INT NULL DEFAULT NULL', {
    type: 'int', nullable: 'YES', defaultValue: null,
  })

  // Preserve the current homepage on first migration, selecting up to three
  // published rows by the existing public order without pinning IDs or slugs.
  await connection.execute('UPDATE projects SET is_featured = 0, featured_order = NULL')
  const [initialProjects] = await connection.execute(
    `SELECT id FROM projects WHERE status = 'published'
     ORDER BY sort_order ASC, id ASC LIMIT 3`,
  )
  for (const [index, project] of initialProjects.entries()) {
    await connection.execute(
      `UPDATE projects SET is_featured = 1, featured_order = ? WHERE id = ?`,
      [index + 1, project.id],
    )
  }

  const [indexRows] = await connection.execute(
    `SELECT SEQ_IN_INDEX AS sequenceNumber, COLUMN_NAME AS columnName, NON_UNIQUE AS nonUnique
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'projects' AND index_name = 'projects_featured_order'
     ORDER BY SEQ_IN_INDEX`,
  )
  if (!indexRows.length) {
    await connection.query('ALTER TABLE projects ADD UNIQUE INDEX projects_featured_order (is_featured, featured_order)')
    return
  }
  const actualColumns = indexRows.map(({ columnName }) => columnName)
  if (actualColumns.join(',') !== 'is_featured,featured_order' || indexRows.some(({ nonUnique }) => Number(nonUnique) !== 0)) {
    throw new Error('Existing featured-project schema is incompatible: projects_featured_order index.')
  }
}
