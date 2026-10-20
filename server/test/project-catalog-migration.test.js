import test from 'node:test'
import assert from 'node:assert/strict'
import { projectCatalogSchema, up, validateProjectCatalogTable } from '../migrations/002-project-catalog.js'
import { isProjectStatus } from '../src/validators/project.validator.js'
import { createProjectModel } from '../src/database/models/project.model.js'

function clone(value) {
  return structuredClone(value)
}

class SchemaConnection {
  constructor(initial = {}) {
    this.tables = clone(initial)
    this.createdSql = []
  }

  async query(sql) {
    this.createdSql.push(sql)
    const match = sql.match(/CREATE TABLE IF NOT EXISTS\s+(\w+)/i)
    if (match && !this.tables[match[1]]) this.tables[match[1]] = clone(projectCatalogSchema[match[1]])
    return [[], []]
  }

  async execute(sql, [table] = []) {
    if (sql.includes('information_schema.tables')) {
      const schema = this.tables[table]
      return [schema ? [{ engine: schema.engine || 'InnoDB', collationName: schema.tableCollation || 'utf8mb4_unicode_ci' }] : [], []]
    }
    const schema = this.tables[table]
    if (!schema) return [[], []]
    if (sql.includes('information_schema.columns')) {
      return [Object.entries(schema.columns).map(([name, value]) => ({
        name, type: value.type, nullable: value.nullable,
        defaultValue: value.defaultValue === null && value.nullable === 'YES'
          ? 'NULL'
          : value.defaultValue === 'draft' ? "'draft'" : value.defaultValue,
        extra: value.extra, collationName: value.collation,
      })), []]
    }
    if (sql.includes('information_schema.statistics')) {
      return [Object.entries(schema.indexes).flatMap(([name, value]) => value.columns.map((columnName, index) => ({
        name, nonUnique: value.unique ? 0 : 1, sequenceNumber: index + 1, columnName,
      }))), []]
    }
    if (sql.includes('information_schema.key_column_usage')) {
      return [Object.entries(schema.foreignKeys).flatMap(([name, value]) => value.columns.map((columnName, index) => ({
        name, columnName, referencedTable: value.referencedTable,
        referencedColumn: value.referencedColumns[index], sequenceNumber: index + 1,
        deleteRule: value.onDelete,
      }))), []]
    }
    throw new Error(`Unexpected schema query: ${sql}`)
  }
}

test('project catalog migration creates and validates an empty schema', async () => {
  const connection = new SchemaConnection()
  await up(connection)

  assert.deepEqual(Object.keys(connection.tables).sort(), Object.keys(projectCatalogSchema).sort())
  assert.equal(connection.createdSql.length, 4)
  assert.match(connection.createdSql[0], /status ENUM\('draft', 'published'\) NOT NULL/)
  assert.match(connection.createdSql[2], /FOREIGN KEY \(project_id, locale\) REFERENCES project_translations\(project_id, locale\)/)
})

test('project catalog migration rejects an incompatible existing schema', async () => {
  const projects = clone(projectCatalogSchema.projects)
  projects.columns.slug.type = 'varchar(80)'
  const connection = new SchemaConnection({ projects })

  await assert.rejects(up(connection), /projects\.slug type; expected varchar\(160\), found varchar\(80\)/)
  assert.equal(connection.createdSql.length, 1)
  assert.equal(connection.tables.project_translations, undefined)
})

test('project catalog migration resumes after projects was created with MariaDB NULL metadata', async () => {
  const projects = clone(projectCatalogSchema.projects)
  for (const column of Object.values(projects.columns)) {
    if (column.nullable === 'YES' && column.defaultValue === null) column.defaultValue = 'NULL'
    if (column.defaultValue === 'draft') column.defaultValue = "'draft'"
  }
  const originalProjects = clone(projects)
  const connection = new SchemaConnection({ projects })

  await up(connection)

  assert.deepEqual(connection.tables.projects, originalProjects)
  assert.deepEqual(Object.keys(connection.tables).sort(), Object.keys(projectCatalogSchema).sort())
  assert.equal(connection.createdSql.length, 4)
})

test('default validation keeps quoted NULL distinct from SQL NULL', async () => {
  const projects = clone(projectCatalogSchema.projects)
  projects.columns.source_key.defaultValue = "'NULL'"
  const connection = new SchemaConnection({ projects })

  await assert.rejects(validateProjectCatalogTable(connection, 'projects'), /projects\.source_key default; expected null, found null/)
})

test('schema validation checks indexes, foreign keys, storage engine, and collation', async (t) => {
  for (const [label, change, error] of [
    ['index', (schema) => delete schema.indexes.projects_public_order, /index projects_public_order is missing/],
    ['foreign key', (schema) => delete schema.foreignKeys.project_translations_project_fk, /foreign key project_translations_project_fk is missing/],
    ['engine', (schema) => { schema.engine = 'MyISAM' }, /projects engine; expected innodb, found myisam/],
    ['collation', (schema) => { schema.tableCollation = 'utf8mb4_general_ci' }, /projects collation; expected utf8mb4_unicode_ci, found utf8mb4_general_ci/],
  ]) {
    await t.test(label, async () => {
      const schema = clone(label === 'foreign key' ? projectCatalogSchema.project_translations : projectCatalogSchema.projects)
      change(schema)
      const tableName = label === 'foreign key' ? 'project_translations' : 'projects'
      const connection = new SchemaConnection({ [tableName]: schema })
      await assert.rejects(validateProjectCatalogTable(connection, tableName), error)
    })
  }
})

test('project status validation accepts only draft and published', () => {
  assert.equal(isProjectStatus('draft'), true)
  assert.equal(isProjectStatus('published'), true)
  assert.equal(isProjectStatus('deleted'), false)
  assert.equal(isProjectStatus(undefined), false)
})

test('legacy project insertion rejects invalid status before making a database call', async () => {
  const model = createProjectModel({ execute: async () => { throw new Error('unexpected database write') } })
  await assert.rejects(model.createLegacyProject({}, { execute() {} }, 'archived'), /Invalid project status/)
})
