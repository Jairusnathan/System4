import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

// Initialize SQLite database
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
const adminEmail = 'admin@gmail.com';
const adminUser = db.prepare('SELECT id FROM customers WHERE email = ?').get(adminEmail);
if (!adminUser) {
  const hashedPassword = bcrypt.hashSync('password123', 10);
  db.prepare('INSERT INTO customers (full_name, email, phone, password) VALUES (?, ?, ?, ?)').run('Admin User', adminEmail, '+639000000000', hashedPassword);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { fullName, email, phone, password } = req.body;

      // Validation
      if (!fullName || !email || !phone || !password) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }

      const phoneRegex = /^\+63\d{10}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ error: 'Phone number must be in +63XXXXXXXXXX format' });
      }

      // Check if email exists
      const existingUser = db.prepare('SELECT id FROM customers WHERE email = ?').get(email);
      if (existingUser) {
        return res.status(400).json({ error: 'Email is already registered' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert customer
      const stmt = db.prepare('INSERT INTO customers (full_name, email, phone, password) VALUES (?, ?, ?, ?)');
      const info = stmt.run(fullName, email, phone, hashedPassword);

      // Generate JWT
      const token = jwt.sign({ userId: info.lastInsertRowid, email, fullName }, JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({
        message: 'Registration successful',
        token,
        user: { id: info.lastInsertRowid, fullName, email, phone }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = db.prepare('SELECT * FROM customers WHERE email = ?').get(email) as any;
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = jwt.sign({ userId: user.id, email: user.email, fullName: user.full_name }, JWT_SECRET, { expiresIn: '7d' });

      res.json({
        message: 'Login successful',
        token,
        user: { id: user.id, fullName: user.full_name, email: user.email, phone: user.phone }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Branch API
  app.get('/api/branches', (req, res) => {
    try {
      const branches = db.prepare('SELECT * FROM branches WHERE is_active = 1').all();
      res.json(branches);
    } catch (error) {
      console.error('Error fetching branches:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/branches/:id/inventory', (req, res) => {
    try {
      const branchId = req.params.id;
      const inventory = db.prepare('SELECT product_id, stock FROM branch_inventory WHERE branch_id = ?').all(branchId);
      res.json(inventory);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
