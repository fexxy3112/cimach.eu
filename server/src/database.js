import mysql from 'mysql2/promise'
import { config } from './config.js'

export const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  queueLimit: 20,
  enableKeepAlive: true,
  timezone: 'Z',
  charset: 'utf8mb4',
})
