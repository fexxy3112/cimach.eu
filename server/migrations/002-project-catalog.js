export const projectCatalogSchema = Object.freeze({
  projects: {
    columns: {
      id: { type: 'bigint unsigned', nullable: 'NO', defaultValue: null, extra: 'auto_increment', collation: null },
      source_key: { type: 'varchar(80)', nullable: 'YES', defaultValue: null, extra: '', collation: 'utf8mb4_unicode_ci' },
      display_number: { type: 'varchar(12)', nullable: 'NO', defaultValue: null, extra: '', collation: 'utf8mb4_unicode_ci' },
      slug: { type: 'varchar(160)', nullable: 'YES', defaultValue: null, extra: '', collation: 'utf8mb4_unicode_ci' },
      project_url: { type: 'varchar(2048)', nullable: 'NO', defaultValue: null, extra: '', collation: 'utf8mb4_unicode_ci' },
      main_image_url: { type: 'varchar(2048)', nullable: 'YES', defaultValue: null, extra: '', collation: 'utf8mb4_unicode_ci' },
      status: { type: "enum('draft','published')", nullable: 'NO', defaultValue: 'draft', extra: '', collation: 'utf8mb4_unicode_ci' },
      sort_order: { type: 'int', nullable: 'NO', defaultValue: '0', extra: '', collation: null },
      published_at: { type: 'datetime(3)', nullable: 'YES', defaultValue: null, extra: '', collation: null },
      created_at: { type: 'datetime(3)', nullable: 'NO', defaultValue: 'current_timestamp(3)', extra: '', collation: null },
      updated_at: { type: 'datetime(3)', nullable: 'NO', defaultValue: 'current_timestamp(3)', extra: 'on update current_timestamp(3)', collation: null },
    },
    indexes: {
      PRIMARY: { unique: true, columns: ['id'] },
      projects_source_key_unique: { unique: true, columns: ['source_key'] },
      projects_slug_unique: { unique: true, columns: ['slug'] },
      projects_public_order: { unique: false, columns: ['status', 'sort_order', 'id'] },
    },
    foreignKeys: {},
  },
  project_translations: {
    columns: {
      project_id: { type: 'bigint unsigned', nullable: 'NO', defaultValue: null, extra: '', collation: null },
      locale: { type: 'char(2)', nullable: 'NO', defaultValue: null, extra: '', collation: 'ascii_bin' },
      title: { type: 'varchar(255)', nullable: 'NO', defaultValue: null, extra: '', collation: 'utf8mb4_unicode_ci' },
      category: { type: 'varchar(255)', nullable: 'NO', defaultValue: null, extra: '', collation: 'utf8mb4_unicode_ci' },
      description: { type: 'text', nullable: 'NO', defaultValue: null, extra: '', collation: 'utf8mb4_unicode_ci' },
      seo_title: { type: 'varchar(255)', nullable: 'YES', defaultValue: null, extra: '', collation: 'utf8mb4_unicode_ci' },
      seo_description: { type: 'text', nullable: 'YES', defaultValue: null, extra: '', collation: 'utf8mb4_unicode_ci' },
    },
    indexes: {
      PRIMARY: { unique: true, columns: ['project_id', 'locale'] },
    },
    foreignKeys: {
      project_translations_project_fk: {
        columns: ['project_id'], referencedTable: 'projects', referencedColumns: ['id'], onDelete: 'CASCADE',
      },
    },
  },
  project_technologies: {
    columns: {
      project_id: { type: 'bigint unsigned', nullable: 'NO', defaultValue: null, extra: '', collation: null },
      locale: { type: 'char(2)', nullable: 'NO', defaultValue: null, extra: '', collation: 'ascii_bin' },
      sort_order: { type: 'int', nullable: 'NO', defaultValue: null, extra: '', collation: null },
      label: { type: 'varchar(100)', nullable: 'NO', defaultValue: null, extra: '', collation: 'utf8mb4_unicode_ci' },
    },
    indexes: {
      PRIMARY: { unique: true, columns: ['project_id', 'locale', 'sort_order'] },
    },
    foreignKeys: {
      project_technologies_translation_fk: {
        columns: ['project_id', 'locale'], referencedTable: 'project_translations',
        referencedColumns: ['project_id', 'locale'], onDelete: 'CASCADE',
      },
    },
  },
  project_images: {
    columns: {
      id: { type: 'bigint unsigned', nullable: 'NO', defaultValue: null, extra: 'auto_increment', collation: null },
      project_id: { type: 'bigint unsigned', nullable: 'NO', defaultValue: null, extra: '', collation: null },
      source_url: { type: 'varchar(2048)', nullable: 'NO', defaultValue: null, extra: '', collation: 'utf8mb4_unicode_ci' },
      alt_pl: { type: 'varchar(512)', nullable: 'NO', defaultValue: null, extra: '', collation: 'utf8mb4_unicode_ci' },
      alt_en: { type: 'varchar(512)', nullable: 'NO', defaultValue: null, extra: '', collation: 'utf8mb4_unicode_ci' },
      sort_order: { type: 'int', nullable: 'NO', defaultValue: '0', extra: '', collation: null },
      created_at: { type: 'datetime(3)', nullable: 'NO', defaultValue: 'current_timestamp(3)', extra: '', collation: null },
    },
    indexes: {
      PRIMARY: { unique: true, columns: ['id'] },
      project_images_order_unique: { unique: true, columns: ['project_id', 'sort_order'] },
    },
    foreignKeys: {
      project_images_project_fk: {
        columns: ['project_id'], referencedTable: 'projects', referencedColumns: ['id'], onDelete: 'CASCADE',
      },
    },
  },
})

function normalizeType(value) {
  return String(value).toLowerCase().replace(/\b(bigint|int|smallint|mediumint|tinyint)\(\d+\)/g, '$1')
}

function normalizeDefault(value) {
  if (value === null || value === undefined) return null
  const raw = String(value).trim()
  if (raw.toLowerCase() === 'null') return null
  return raw.toLowerCase().replace(/^'(.*)'$/, '$1').replace(/\s+/g, ' ').trim()
}

function assertEqual(actual, expected, description) {
  if (actual !== expected) throw new Error(`Existing project catalog schema is incompatible: ${description}; expected ${expected}, found ${actual}.`)
}

export async function validateProjectCatalogTable(connection, table) {
  const expected = projectCatalogSchema[table]
  if (!expected) throw new Error(`Unknown project catalog table: ${table}.`)

  const [tableRows] = await connection.execute(
    `SELECT ENGINE AS engine, TABLE_COLLATION AS collationName
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [table],
  )
  if (!tableRows.length) throw new Error(`Project catalog table ${table} was not created.`)
  assertEqual(String(tableRows[0].engine).toLowerCase(), 'innodb', `${table} engine`)
  assertEqual(String(tableRows[0].collationName).toLowerCase(), 'utf8mb4_unicode_ci', `${table} collation`)

  const [columnRows] = await connection.execute(
    `SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable,
            COLUMN_DEFAULT AS defaultValue, EXTRA AS extra, COLLATION_NAME AS collationName
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [table],
  )
  const columns = new Map(columnRows.map((column) => [column.name, column]))
  const unexpectedColumns = [...columns.keys()].filter((name) => !expected.columns[name])
  if (unexpectedColumns.length) {
    throw new Error(`Existing project catalog schema is incompatible: ${table} has unexpected columns ${unexpectedColumns.join(', ')}.`)
  }
  for (const [name, definition] of Object.entries(expected.columns)) {
    const column = columns.get(name)
    if (!column) throw new Error(`Existing project catalog schema is incompatible: ${table}.${name} is missing.`)
    assertEqual(normalizeType(column.type), definition.type, `${table}.${name} type`)
    assertEqual(column.nullable, definition.nullable, `${table}.${name} NULL constraint`)
    assertEqual(normalizeDefault(column.defaultValue), definition.defaultValue, `${table}.${name} default`)
    const actualExtra = String(column.extra || '').toLowerCase().replace(/\s+/g, ' ').trim()
    assertEqual(actualExtra, definition.extra, `${table}.${name} extra attributes`)
    if (definition.collation) assertEqual(String(column.collationName).toLowerCase(), definition.collation, `${table}.${name} collation`)
  }

  const [indexRows] = await connection.execute(
    `SELECT INDEX_NAME AS name, NON_UNIQUE AS nonUnique, SEQ_IN_INDEX AS sequenceNumber, COLUMN_NAME AS columnName
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ?
     ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
    [table],
  )
  const indexes = new Map()
  for (const row of indexRows) {
    const index = indexes.get(row.name) || { unique: Number(row.nonUnique) === 0, columns: [] }
    index.columns.push(row.columnName)
    indexes.set(row.name, index)
  }
  for (const [name, definition] of Object.entries(expected.indexes)) {
    const actual = indexes.get(name)
    if (!actual) throw new Error(`Existing project catalog schema is incompatible: ${table} index ${name} is missing.`)
    assertEqual(actual.unique, definition.unique, `${table} index ${name} uniqueness`)
    assertEqual(JSON.stringify(actual.columns), JSON.stringify(definition.columns), `${table} index ${name} columns`)
  }
  for (const [name, index] of indexes) {
    if (!expected.indexes[name] && index.unique) {
      throw new Error(`Existing project catalog schema is incompatible: unexpected unique index ${table}.${name}.`)
    }
  }

  const [foreignKeyRows] = await connection.execute(
    `SELECT k.CONSTRAINT_NAME AS name, k.COLUMN_NAME AS columnName,
            k.REFERENCED_TABLE_NAME AS referencedTable, k.REFERENCED_COLUMN_NAME AS referencedColumn,
            k.ORDINAL_POSITION AS sequenceNumber, r.DELETE_RULE AS deleteRule
     FROM information_schema.key_column_usage k
     INNER JOIN information_schema.referential_constraints r
       ON r.constraint_schema = k.constraint_schema AND r.constraint_name = k.constraint_name
      AND r.table_name = k.table_name
     WHERE k.table_schema = DATABASE() AND k.table_name = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL
     ORDER BY k.CONSTRAINT_NAME, k.ORDINAL_POSITION`,
    [table],
  )
  const foreignKeys = new Map()
  for (const row of foreignKeyRows) {
    const key = foreignKeys.get(row.name) || {
      columns: [], referencedTable: row.referencedTable, referencedColumns: [], onDelete: row.deleteRule,
    }
    key.columns.push(row.columnName)
    key.referencedColumns.push(row.referencedColumn)
    foreignKeys.set(row.name, key)
  }
  for (const [name, definition] of Object.entries(expected.foreignKeys)) {
    const actual = foreignKeys.get(name)
    if (!actual) throw new Error(`Existing project catalog schema is incompatible: ${table} foreign key ${name} is missing.`)
    assertEqual(JSON.stringify(actual.columns), JSON.stringify(definition.columns), `${table} foreign key ${name} columns`)
    assertEqual(actual.referencedTable, definition.referencedTable, `${table} foreign key ${name} referenced table`)
    assertEqual(JSON.stringify(actual.referencedColumns), JSON.stringify(definition.referencedColumns), `${table} foreign key ${name} referenced columns`)
    assertEqual(String(actual.onDelete).toUpperCase(), definition.onDelete, `${table} foreign key ${name} delete rule`)
  }
  for (const name of foreignKeys.keys()) {
    if (!expected.foreignKeys[name]) throw new Error(`Existing project catalog schema is incompatible: unexpected foreign key ${table}.${name}.`)
  }
}

export async function up(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      source_key VARCHAR(80) NULL,
      display_number VARCHAR(12) NOT NULL,
      slug VARCHAR(160) NULL,
      project_url VARCHAR(2048) NOT NULL,
      main_image_url VARCHAR(2048) NULL,
      status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
      sort_order INT NOT NULL DEFAULT 0,
      published_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY projects_source_key_unique (source_key),
      UNIQUE KEY projects_slug_unique (slug),
      KEY projects_public_order (status, sort_order, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await validateProjectCatalogTable(connection, 'projects')

  await connection.query(`
    CREATE TABLE IF NOT EXISTS project_translations (
      project_id BIGINT UNSIGNED NOT NULL,
      locale CHAR(2) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      seo_title VARCHAR(255) NULL,
      seo_description TEXT NULL,
      PRIMARY KEY (project_id, locale),
      CONSTRAINT project_translations_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await validateProjectCatalogTable(connection, 'project_translations')

  await connection.query(`
    CREATE TABLE IF NOT EXISTS project_technologies (
      project_id BIGINT UNSIGNED NOT NULL,
      locale CHAR(2) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      sort_order INT NOT NULL,
      label VARCHAR(100) NOT NULL,
      PRIMARY KEY (project_id, locale, sort_order),
      CONSTRAINT project_technologies_translation_fk
        FOREIGN KEY (project_id, locale) REFERENCES project_translations(project_id, locale) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await validateProjectCatalogTable(connection, 'project_technologies')

  await connection.query(`
    CREATE TABLE IF NOT EXISTS project_images (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      project_id BIGINT UNSIGNED NOT NULL,
      source_url VARCHAR(2048) NOT NULL,
      alt_pl VARCHAR(512) NOT NULL,
      alt_en VARCHAR(512) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY project_images_order_unique (project_id, sort_order),
      CONSTRAINT project_images_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await validateProjectCatalogTable(connection, 'project_images')
}
