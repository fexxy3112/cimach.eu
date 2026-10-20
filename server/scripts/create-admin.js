import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { StringDecoder } from 'node:string_decoder'
import bcrypt from 'bcryptjs'
import { pool } from '../src/database/client.js'
import { runMigrations } from '../src/database/migration-runner.js'
import { createUserModel } from '../src/database/models/user.model.js'

function promptHidden(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Use an interactive terminal to enter the administrator password safely.')
  }
  stdout.write(prompt)
  stdin.setRawMode(true)
  stdin.resume()

  return new Promise((resolve, reject) => {
    let value = ''
    const decoder = new StringDecoder('utf8')
    const finish = (error) => {
      stdin.removeListener('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
      stdout.write('\n')
      error ? reject(error) : resolve(value)
    }
    const onData = (buffer) => {
      for (const character of decoder.write(buffer)) {
        if (character === '\u0003' || character === '\u0004') return finish(new Error('Cancelled.'))
        if (character === '\r' || character === '\n') return finish()
        if (character === '\b' || character === '\u007f') {
          if (value.length) {
            value = Array.from(value).slice(0, -1).join('')
            stdout.write('\b \b')
          }
          continue
        }
        if (character >= ' ') {
          value += character
          stdout.write('*')
        }
      }
    }
    stdin.on('data', onData)
  })
}

let prompt
try {
  await runMigrations(pool)
  const rl = createInterface({ input: stdin, output: stdout })
  prompt = rl
  const email = (await rl.question('Administrator email: ')).trim().toLowerCase()
  rl.close()
  prompt = undefined

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('Enter a valid email address (up to 254 characters).')
  }

  const connection = await pool.getConnection()
  try {
    const [lockRows] = await connection.execute('SELECT GET_LOCK(?, 10) AS acquired', ['cimach-first-admin'])
    if (Number(lockRows[0].acquired) !== 1) throw new Error('Could not acquire administrator setup lock.')

    const users = createUserModel(pool)
    if (await users.countAdmins(connection) > 0) {
      throw new Error('An administrator already exists. This command only creates the first administrator.')
    }

    const password = await promptHidden('Administrator password (minimum 8 characters): ')
    const confirmation = await promptHidden('Repeat password: ')
    if (password !== confirmation) throw new Error('Passwords do not match.')
    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new Error('Password must be at least 8 characters and no more than 72 UTF-8 bytes.')
    }

    const passwordHash = await bcrypt.hash(password, 12)
    await users.createAdmin({ email, passwordHash }, connection)
  } finally {
    try { await connection.execute('SELECT RELEASE_LOCK(?)', ['cimach-first-admin']) } catch { /* connection cleanup below */ }
    connection.release()
  }
  stdout.write('Administrator created. Only the password hash was stored.\n')
} catch (error) {
  if (prompt) prompt.close()
  process.stderr.write(`Administrator setup failed: ${error.message}\n`)
  process.exitCode = 1
} finally {
  await pool.end()
}
