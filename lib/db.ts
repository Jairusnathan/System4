import Database from 'better-sqlite3';
import path from 'path';

const db = new Database('database.sqlite');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    opening_time TEXT NOT NULL,
    closing_time TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS branch_inventory (
    branch_id INTEGER,
    product_id TEXT,
    stock INTEGER DEFAULT 0,
    PRIMARY KEY (branch_id, product_id),
    FOREIGN KEY (branch_id) REFERENCES branches(id)
  );
`);

// Seed branches if empty
const branchCount = db.prepare('SELECT COUNT(*) as count FROM branches').get() as { count: number };
if (branchCount.count === 0) {
  const insertBranch = db.prepare('INSERT INTO branches (name, address, phone, opening_time, closing_time) VALUES (?, ?, ?, ?, ?)');
  insertBranch.run('Main Branch (Makati)', '123 Ayala Avenue, Makati City', '+63281234567', '08:00', '22:00');
  insertBranch.run('BGC Branch (Late Night)', 'High Street, BGC, Taguig City', '+63287654321', '14:00', '02:00');
  insertBranch.run('Quezon City Branch (Early)', 'Trinoma Mall, Quezon City', '+63289876543', '06:00', '18:00');

  // Seed inventory (varied products per branch)
  const branches = db.prepare('SELECT id FROM branches').all() as { id: number }[];
  const insertInventory = db.prepare('INSERT INTO branch_inventory (branch_id, product_id, stock) VALUES (?, ?, ?)');
  
  // Branch 1: Products 1-22
  for (let i = 1; i <= 22; i++) {
    insertInventory.run(branches[0].id, i.toString(), Math.floor(Math.random() * 100) + 10);
  }
  
  // Branch 2: Products 10-38
  for (let i = 10; i <= 38; i++) {
    insertInventory.run(branches[1].id, i.toString(), Math.floor(Math.random() * 100) + 10);
  }
  
  // Branch 3: Products 5-15 and 20-38
  for (let i = 5; i <= 15; i++) {
    insertInventory.run(branches[2].id, i.toString(), Math.floor(Math.random() * 100) + 10);
  }
  for (let i = 20; i <= 38; i++) {
    insertInventory.run(branches[2].id, i.toString(), Math.floor(Math.random() * 100) + 10);
  }
}

// Seed admin user
import bcrypt from 'bcrypt';
const adminEmail = 'admin@gmail.com';
const adminUser = db.prepare('SELECT id FROM customers WHERE email = ?').get(adminEmail);
if (!adminUser) {
  const hashedPassword = bcrypt.hashSync('password123', 10);
  db.prepare('INSERT INTO customers (full_name, email, phone, password) VALUES (?, ?, ?, ?)').run('Admin User', adminEmail, '+639000000000', hashedPassword);
}

export default db;
