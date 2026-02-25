import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { AuthedRequest, AppRole } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_fallback_dev';
const AUTH_REQUIRE_DB_CHECK = process.env.AUTH_REQUIRE_DB_CHECK === 'true';

type JwtClaims = {
  userId: string;
  email?: string;
  fullName?: string;
  role?: AppRole;
  companyId?: string | null;
  companyName?: string | null;
  iat?: number;
  exp?: number;
};

export const authenticateToken = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtClaims;

    if (!decoded.userId) {
      res.status(403).json({ error: 'Token inválido' });
      return;
    }

    // Fast-path: usa claims do JWT para evitar query em toda request.
    // Se quiser validação forte por request, setar AUTH_REQUIRE_DB_CHECK=true.
    if (!AUTH_REQUIRE_DB_CHECK) {
      req.user = {
        id: decoded.userId,
        email: decoded.email || '',
        fullName: decoded.fullName || '',
        role: (decoded.role as AppRole) || 'SUPER_ADMIN_EVOLUTECH',
        companyId: decoded.companyId || null,
        companyName: decoded.companyName || null,
      };
      next();
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
        roles: {
          select: {
            role: true,
            companyId: true,
            company: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      res.status(403).json({ error: 'Usuário não encontrado' });
      return;
    }

    const activeRole = user.roles[0];

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      createdAt: user.createdAt,
      role: (activeRole?.role as AppRole) || 'SUPER_ADMIN_EVOLUTECH',
      companyId: activeRole?.companyId || null,
      companyName: activeRole?.company?.name || null,
    };

    next();
  } catch (_error) {
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

