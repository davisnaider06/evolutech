import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db'; // Usa o client Prisma
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
    
    // Busca usuário com as roles e empresa
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        roles: { include: { company: true } }
      }
    });

    if (!user) {
       res.status(403).json({ error: 'Usuário não encontrado' });
       return;
    }

    // Pega a role ativa (ou a primeira)
    const activeRole = user.roles[0];

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      createdAt: user.createdAt,
      role: (activeRole?.role as AppRole) || 'SUPER_ADMIN_EVOLUTECH',
      companyId: activeRole?.companyId || null,
      companyName: activeRole?.company?.name || null
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