import { pool } from '../db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_fallback_dev';

export class AuthService {
  async login(email: string, passwordPlain: string) {
    const { rows } = await pool.query(
      `SELECT p.*, ur.role, ur.company_id 
       FROM profiles p 
       LEFT JOIN user_roles ur ON p.id = ur.user_id 
       WHERE p.email = $1`, 
      [email]
    );
    const user = rows[0];

    if (!user) throw new Error('Credenciais inválidas');
    if (!user.password_hash) throw new Error('Usuário sem senha definida');

    const isValid = await bcrypt.compare(passwordPlain, user.password_hash);
    if (!isValid) throw new Error('Credenciais inválidas');

    const token = jwt.sign(
      { userId: user.id, role: user.role, companyId: user.company_id }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name,
        role: user.role,
        tenantId: user.company_id
      }
    };
  }

  async getMe(userId: string) {
    const { rows } = await pool.query(`
      SELECT p.id, p.full_name, p.email, ur.role, ur.company_id, c.name as company_name
      FROM profiles p
      LEFT JOIN user_roles ur ON p.id = ur.user_id
      LEFT JOIN companies c ON ur.company_id = c.id
      WHERE p.id = $1
    `, [userId]);
    
    return rows[0];
  }
}