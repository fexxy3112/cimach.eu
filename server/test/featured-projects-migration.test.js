import assert from 'node:assert/strict'
import { test } from 'node:test'
import { up } from '../migrations/003-featured-projects.js'

function fakeConnection({ columns = {}, indexes = [] } = {}) {
  const alterations = []
  const executions = []
  return {
    alterations,
    executions,
    async execute(sql, values = []) {
      executions.push({ sql, values })
      if (sql.includes('information_schema.tables')) return [[{ exists: 1 }], []]
      if (sql.includes('information_schema.columns')) {
        const column = columns[values[0]]
        return [column ? [column] : [], []]
      }
      if (sql.includes('information_schema.statistics')) return [indexes, []]
      if (sql.includes("SELECT id FROM projects WHERE status = 'published'")) return [[{ id: 20 }, { id: 4 }], []]
      return [{ affectedRows: 1 }, []]
    },
    async query(sql) { alterations.push(sql); return [{}, []] },
  }
}

test('featured migration adds independent feature state without changing existing rows', async () => {
  const connection = fakeConnection()
  await up(connection)
  assert.deepEqual(connection.alterations, [
    'ALTER TABLE projects ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0',
    'ALTER TABLE projects ADD COLUMN featured_order INT NULL DEFAULT NULL',
    'ALTER TABLE projects ADD UNIQUE INDEX projects_featured_order (is_featured, featured_order)',
  ])
  assert.ok(connection.executions.some(({ sql }) => sql === 'UPDATE projects SET is_featured = 0, featured_order = NULL'))
  assert.deepEqual(connection.executions.filter(({ sql }) => sql.includes('UPDATE projects SET is_featured = 1')).map(({ values }) => values), [[1, 20], [2, 4]])
})

test('featured migration resumes when one valid column already exists', async () => {
  const connection = fakeConnection({
    columns: {
      is_featured: { type: 'tinyint(1)', nullable: 'NO', defaultValue: '0' },
    },
  })
  await up(connection)
  assert.deepEqual(connection.alterations, [
    'ALTER TABLE projects ADD COLUMN featured_order INT NULL DEFAULT NULL',
    'ALTER TABLE projects ADD UNIQUE INDEX projects_featured_order (is_featured, featured_order)',
  ])
})

test('featured migration refuses an incompatible pre-existing column', async () => {
  const connection = fakeConnection({
    columns: {
      is_featured: { type: 'varchar(5)', nullable: 'NO', defaultValue: '0' },
    },
  })
  await assert.rejects(up(connection), /projects\.is_featured/)
  assert.deepEqual(connection.alterations, [])
})
