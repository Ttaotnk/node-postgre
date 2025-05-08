import express from 'express';
import { Pool } from 'pg';
import bodyParser from 'body-parser';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// PostgreSQL Connection (ใช้วิธีที่ 1 หรือ 2 ข้างต้น)
const pool = new Pool({
  user: 'taonakha',
  host: 'dpg-d0de0iadbo4c738et160-a.oregon-postgres.render.com',
  database: 'testpostgre_db',
  password: 'MGqbs8Q4g6GOH69gTQ9qKaSqhdc32L7B',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

// เช็คการเชื่อมต่อ
pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection failed:', err.stack);
    return;
  }
  console.log('Connected to PostgreSQL database.');
  release();
});

// สร้างตาราง users ถ้ายังไม่มี
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

pool.query(createTableQuery, (err) => {
  if (err) throw err;
  console.log('Users table ready');
});

// Register endpoint
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    const checkUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *',
      [name, email, hashedPassword]
    );
    
    res.json({ success: true, message: 'User registered successfully', user: newUser.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      'your_jwt_secret',
      { expiresIn: '1h' }
    );
    
    res.json({ 
      success: true, 
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});