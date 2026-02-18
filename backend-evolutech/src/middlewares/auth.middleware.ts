import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { AuthedRequest, AppRole } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_fallback_dev';

export const authenticateToken = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    
    const userQuery = `
      SELECT p.id, p.full_name, p.email, p.created_at,
             ur.role, ur.company_id, c.name as company_name
      FROM profiles p
      LEFT JOIN user_roles ur ON p.id = ur.user_id
      LEFT JOIN companies c ON c.id = ur.company_id
      WHERE p.id = $1
    `;
    
    const { rows } = await pool.query(userQuery, [decoded.userId]);
    const user = rows[0];

    if (!user) {
       res.status(403).json({ error: 'Usuário não encontrado' });
       return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      createdAt: user.created_at,
      role: user.role || 'SUPER_ADMIN_EVOLUTECH',
      companyId: user.company_id || null,
      companyName: user.company_name || null
    };

    next();
  } catch (error) {
    res.status(403).json({ error: 'Token inválido' });
  }
};

export const requireRoles = (roles: AppRole[]) => (req: AuthedRequest, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403).json({ error: 'Sem permissão' });
    return;
  }
  next();
};