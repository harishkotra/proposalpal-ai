import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'local'}` });

// Determine whether to use SQLite or PostgreSQL based on environment
const usePostgres = process.env.DATABASE_URL !== undefined;

// Create a pool of connections only if using PostgreSQL
let pool;
if (usePostgres) {
    pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        // SSL is required for production (Neon), but not for local Docker DB
        // The 'pg' library is smart enough to handle this if the connection string includes sslmode.
        // For Render, we can set PGSSLMODE='no-verify' in the environment if needed.
    });
}


async function setupDatabaseSQLite(filename) {
  const db = await open({
    filename,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT NOT NULL,
      cip_number TEXT NOT NULL,
      vote_choice TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(wallet_address, cip_number)
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      wallet_address TEXT PRIMARY KEY,
      credits_remaining INTEGER NOT NULL DEFAULT 500,
      credits_purchased INTEGER NOT NULL DEFAULT 0
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS claimed_transactions (
      tx_hash TEXT PRIMARY KEY
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS summaries_cache (
      cip_number TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT NOT NULL,
      cip_number TEXT NOT NULL,
      was_cached BOOLEAN NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS translations_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_text_hash TEXT NOT NULL,
      target_language TEXT NOT NULL,
      translated_text TEXT NOT NULL,
      cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(original_text_hash, target_language)
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS community_insights_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cip_hash TEXT NOT NULL UNIQUE,
      cip_number TEXT NOT NULL,
      insights TEXT NOT NULL,
      cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT NOT NULL,
      badge_id TEXT NOT NULL,
      earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(wallet_address, badge_id)
    );
  `);

  console.log(`Database setup complete. Using SQLite file: ${filename}`);

  // Create a wrapper to provide PostgreSQL-compatible query interface
  const wrapper = {
    async query(sql, params = []) {
      // Convert PostgreSQL parameterized queries ($1, $2) to SQLite (?, ?)
      let sqliteSql = sql.replace(/\$(\d+)/g, '?');

      // Remove PostgreSQL-specific type casting (::int, ::text, etc.)
      sqliteSql = sqliteSql.replace(/::(int|text|varchar|timestamp|timestamptz|boolean)/gi, '');

      // Determine query type
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        const rows = await db.all(sqliteSql, params);
        return { rows };
      } else if (sql.trim().toUpperCase().startsWith('INSERT')) {
        const result = await db.run(sqliteSql, params);
        // For RETURNING clause compatibility, return the inserted row
        if (sql.toUpperCase().includes('RETURNING')) {
          return { rows: [{ id: result.lastID }] };
        }
        return { rows: [] };
      } else if (sql.trim().toUpperCase().startsWith('UPDATE') || sql.trim().toUpperCase().startsWith('DELETE')) {
        await db.run(sqliteSql, params);
        return { rows: [] };
      }
      // Default fallback
      await db.run(sqliteSql, params);
      return { rows: [] };
    }
  };

  return wrapper;
}

async function setupDatabasePostgres() {
    const client = await pool.connect();
    try {
        console.log('Connecting to PostgreSQL and checking schema...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
              wallet_address TEXT PRIMARY KEY,
              credits_remaining INTEGER NOT NULL DEFAULT 500,
              credits_purchased INTEGER NOT NULL DEFAULT 0
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS votes (
              id SERIAL PRIMARY KEY,
              wallet_address TEXT NOT NULL,
              cip_number TEXT NOT NULL,
              vote_choice TEXT NOT NULL,
              timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(wallet_address, cip_number)
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS claimed_transactions (
              tx_hash TEXT PRIMARY KEY
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS summaries_cache (
              cip_number TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              summary TEXT NOT NULL,
              cached_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS activity_log (
              id SERIAL PRIMARY KEY,
              wallet_address TEXT NOT NULL,
              cip_number TEXT NOT NULL,
              was_cached BOOLEAN NOT NULL,
              timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS translations_cache (
              id SERIAL PRIMARY KEY,
              original_text_hash TEXT NOT NULL,
              target_language TEXT NOT NULL,
              translated_text TEXT NOT NULL,
              cached_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(original_text_hash, target_language)
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS community_insights_cache (
              id SERIAL PRIMARY KEY,
              cip_hash TEXT NOT NULL,
              cip_number TEXT NOT NULL,
              insights TEXT NOT NULL,
              cached_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(cip_hash)
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS user_badges (
              id SERIAL PRIMARY KEY,
              wallet_address TEXT NOT NULL,
              badge_id TEXT NOT NULL,
              earned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(wallet_address, badge_id)
            );
        `);

        console.log('PostgreSQL schema checked/initialized successfully.');
    } catch (err) {
        console.error('Error during database setup:', err);
        throw err;
    } finally {
        client.release();
    }
    return pool;
}

export async function setupDatabase() {
    if (usePostgres) {
        console.log('Using PostgreSQL database');
        return await setupDatabasePostgres();
    } else {
        console.log('Using SQLite database');
        const filename = process.env.DATABASE_FILENAME || './database.local.db';
        return await setupDatabaseSQLite(filename);
    }
}