import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// The function now accepts the filename
export async function setupDatabase(filename) { 
  const db = await open({
    filename, // Use the passed filename
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

  console.log(`Database setup complete. Using file: ${filename}`);
  return db;
}