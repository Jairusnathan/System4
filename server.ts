import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

// Seed admin user (Optional, can be done via Supabase dashboard or a one-time script)
// In a cloud environment, we typically don't seed in the main server start.


async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { fullName, email, phone, password, address, city, birthday, gender } = req.body;

      // Validation
      if (!fullName || !email || !phone || !password) {
        return res.status(400).json({ error: 'Full Name, Email, Phone, and Password are required' });
      }

      const normalizedEmail = email.toLowerCase().trim();

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert customer into Supabase
      const { data: userData, error: supabaseError } = await supabase
        .from('customers')
        .insert([
          { 
            full_name: fullName, 
            email: normalizedEmail, 
            phone: phone, 
            password: hashedPassword,
            address: address || null,
            city: city || null,
            birthday: birthday || null,
            gender: gender || null
          }
        ])
        .select()
        .single();

      if (supabaseError) {
        if (supabaseError.code === '23505') { // Unique constraint violation
          return res.status(400).json({ error: 'Email is already registered' });
        }
        throw supabaseError;
      }

      // Generate JWT
      const token = jwt.sign(
        { userId: userData.id, email: userData.email, fullName: userData.full_name }, 
        JWT_SECRET, 
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: 'Registration successful',
        token,
        user: { 
          id: userData.id, 
          fullName: userData.full_name, 
          email: userData.email, 
          phone: userData.phone,
          address: userData.address,
          city: userData.city,
          birthday: userData.birthday,
          gender: userData.gender
        }
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

      const normalizedEmail = email.toLowerCase().trim();

      const { data: user, error: supabaseError } = await supabase
        .from('customers')
        .select('*')
        .eq('email', normalizedEmail)
        .single();

      if (supabaseError || !user) {
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
        user: { 
          id: user.id, 
          fullName: user.full_name, 
          email: user.email, 
          phone: user.phone,
          address: user.address,
          city: user.city,
          birthday: user.birthday,
          gender: user.gender
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Branch API
  app.get('/api/branches', async (req, res) => {
    try {
      const { data: branches, error } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      res.json(branches);
    } catch (error) {
      console.error('Error fetching branches:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/branches/:id/inventory', async (req, res) => {
    try {
      const branchId = req.params.id;
      const { data: inventory, error } = await supabase
        .from('branch_inventory')
        .select('product_id, stock')
        .eq('branch_id', branchId);

      if (error) throw error;
      res.json(inventory);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Order API
  app.post('/api/orders', async (req, res) => {
    try {
      const { 
        customerId, 
        branchId, 
        deliveryAddress, 
        deliveryContactNumber, 
        customerNameAtOrder, 
        totalAmount, 
        items 
      } = req.body;

      if (!customerId || !branchId || !deliveryAddress || !items || items.length === 0) {
        return res.status(400).json({ error: 'Missing required order details' });
      }

      // 1. Create the order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          customer_id: customerId,
          branch_id: branchId,
          delivery_address: deliveryAddress,
          delivery_contact_number: deliveryContactNumber,
          customer_name_at_order: customerNameAtOrder,
          total_amount: totalAmount,
          payment_status: 'paid', // Assuming payment is handled before calling this
          order_status: 'preparing'
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Insert order items
      const orderItems = items.map((item: any) => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        price_at_purchase: item.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      res.status(201).json({
        message: 'Order placed successfully',
        orderId: order.id
      });
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });



  // Reset Password API (Forgot Password — no old password needed)
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { email, newPassword } = req.body;

      if (!email || !newPassword) {
        return res.status(400).json({ error: 'Email and new password are required' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check if the email exists
      const { data: customer, error: fetchError } = await supabase
        .from('customers')
        .select('id')
        .eq('email', normalizedEmail)
        .single();

      if (fetchError || !customer) {
        return res.status(404).json({ error: 'No account found with that email' });
      }

      // Hash and update
      const hashed = await bcrypt.hash(newPassword, 10);
      const { error: updateError } = await supabase
        .from('customers')
        .update({ password: hashed, updated_at: new Date().toISOString() })
        .eq('id', customer.id);

      if (updateError) throw updateError;

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Change Password API

  app.put('/api/auth/change-password', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = authHeader.split(' ')[1];
      let decoded: any;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new password are required' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
      }

      // Fetch current hashed password
      const { data: customer, error: fetchError } = await supabase
        .from('customers')
        .select('password')
        .eq('id', decoded.userId)
        .single();

      if (fetchError || !customer) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const passwordMatch = await bcrypt.compare(currentPassword, customer.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash and update new password
      const newHashedPassword = await bcrypt.hash(newPassword, 10);
      const { error: updateError } = await supabase
        .from('customers')
        .update({ password: newHashedPassword, updated_at: new Date().toISOString() })
        .eq('id', decoded.userId);

      if (updateError) throw updateError;

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Change password error:', error);
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
