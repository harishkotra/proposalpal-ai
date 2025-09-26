import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// The function now accepts the filename
export async function setupDatabase(filename) { 
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
  
  console.log(`Database setup complete. Using file: ${filename}`);
  return db;
}