import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { AuthedCustomerRequest, AuthedRequest, AppRole } from '../types';
import { JWT_SECRET } from '../config/secrets';

const AUTH_REQUIRE_DB_CHECK = process.env.AUTH_REQUIRE_DB_CHECK === 'true';
const AUTH_PERF_DEBUG = process.env.AUTH_PERF_DEBUG === 'true';
const AUTH_SLOW_MS = Number(process.env.AUTH_SLOW_MS || 200);

/**
 * De quanto em quanto tempo o papel do token e reconferido no banco.
 *
 * O caminho rapido continua existindo — nao volta a fazer uma query por
 * requisicao —, mas o token deixa de valer para sempre. Desativar um usuario,
 * remover um funcionario ou rebaixar um papel passa a ter efeito dentro dessa
 * janela, em vez de so quando o token expirar (7 dias no exemplo de producao).
 *
 * 0 desliga a revalidacao e volta ao comportamento antigo.
 */
const AUTH_REVALIDATE_MS = Math.max(0, Number(process.env.AUTH_REVALIDATE_MS ?? 30000));

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

type CustomerJwtClaims = {
  accountId: string;
  customerId: string;
  companyId: string;
  email?: string;
  fullName?: string;
  role?: 'CLIENTE';
  iat?: number;
  exp?: number;
};

const VALID_ROLES: AppRole[] = [
  'SUPER_ADMIN_EVOLUTECH',
  'ADMIN_EVOLUTECH',
  'DONO_EMPRESA',
  'FUNCIONARIO_EMPRESA',
  'CLIENTE',
];

const isKnownRole = (role: unknown): role is AppRole =>
  typeof role === 'string' && (VALID_ROLES as string[]).includes(role);

/** Papel e vinculo atuais do usuario, com validade curta. */
type RoleSnapshot = {
  isActive: boolean;
  role: AppRole | null;
  companyId: string | null;
  companyName: string | null;
};

const roleCache = new Map<string, { snapshot: RoleSnapshot; expiresAt: number }>();

const readRoleSnapshot = async (userId: string): Promise<RoleSnapshot | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isActive: true,
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

  if (!user) return null;

  const activeRole = user.roles[0];
  return {
    isActive: user.isActive,
    role: isKnownRole(activeRole?.role) ? (activeRole.role as AppRole) : null,
    companyId: activeRole?.companyId || null,
    companyName: activeRole?.company?.name || null,
  };
};

const getRoleSnapshot = async (userId: string, ttlMs: number): Promise<RoleSnapshot | null> => {
  if (ttlMs <= 0) return readRoleSnapshot(userId);

  const now = Date.now();
  const cached = roleCache.get(userId);
  if (cached && cached.expiresAt > now) return cached.snapshot;

  const snapshot = await readRoleSnapshot(userId);
  if (!snapshot) {
    roleCache.delete(userId);
    return null;
  }

  roleCache.set(userId, { snapshot, expiresAt: now + ttlMs });
  return snapshot;
};

/**
 * Descarta o papel em cache de um usuario.
 *
 * Chamado por quem muda vinculo ou status para que o efeito seja imediato,
 * sem esperar a janela de revalidacao.
 */
export const invalidateRoleCache = (userId?: string | null) => {
  if (!userId) {
    roleCache.clear();
    return;
  }
  roleCache.delete(userId);
};

const finishAuth = (req: AuthedRequest, res: Response, startedAt: number) => {
  const elapsedMs = Date.now() - startedAt;
  res.locals.authPerfMs = elapsedMs;
  if (AUTH_PERF_DEBUG) {
    res.setHeader('X-Auth-Middleware-Ms', String(elapsedMs));
  }
  if (elapsedMs > AUTH_SLOW_MS) {
    console.warn(`[auth.middleware] slow request ${elapsedMs}ms ${req.method} ${req.originalUrl}`);
  }
};

export const authenticateToken = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const startedAt = Date.now();
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  let decoded: JwtClaims;
  try {
    decoded = jwt.verify(token, JWT_SECRET) as JwtClaims;
  } catch (_error) {
    res.status(403).json({ error: 'Token inválido' });
    return;
  }

  if (!decoded.userId) {
    res.status(403).json({ error: 'Token inválido' });
    return;
  }

  // Um token de cliente final nao vale nas rotas de equipe, e vice-versa.
  if (decoded.role === 'CLIENTE') {
    res.status(403).json({ error: 'Sem permissão' });
    return;
  }

  // Token sem papel reconhecido nao entra.
  //
  // Antes o middleware assumia SUPER_ADMIN_EVOLUTECH quando a claim faltava.
  // Como o login emite token sem papel para quem ficou sem vinculo — por
  // exemplo depois que a empresa dele foi apagada e as linhas de user_roles
  // cairam por cascata —, esse padrao entregava a conta mais poderosa do
  // sistema a quem tinha acabado de perder o acesso.
  if (!isKnownRole(decoded.role)) {
    console.warn(
      `[auth.middleware] token sem papel reconhecido recusado userId=${decoded.userId} role=${String(
        decoded.role
      )}`
    );
    res.status(403).json({
      error: 'Sua conta não está vinculada a nenhum perfil de acesso. Fale com o administrador.',
    });
    return;
  }

  const needsDbCheck = AUTH_REQUIRE_DB_CHECK || AUTH_REVALIDATE_MS > 0;

  if (!needsDbCheck) {
    req.user = {
      id: decoded.userId,
      email: decoded.email || '',
      fullName: decoded.fullName || '',
      role: decoded.role,
      companyId: decoded.companyId || null,
      companyName: decoded.companyName || null,
    };
    finishAuth(req, res, startedAt);
    next();
    return;
  }

  try {
    // Em modo estrito nao ha cache: toda requisicao reconfere no banco.
    const snapshot = await getRoleSnapshot(
      decoded.userId,
      AUTH_REQUIRE_DB_CHECK ? 0 : AUTH_REVALIDATE_MS
    );

    if (!snapshot) {
      res.status(403).json({ error: 'Usuário não encontrado' });
      return;
    }

    if (!snapshot.isActive) {
      res.status(403).json({ error: 'Usuário inativo' });
      return;
    }

    if (!snapshot.role) {
      res.status(403).json({
        error: 'Sua conta não está vinculada a nenhum perfil de acesso. Fale com o administrador.',
      });
      return;
    }

    // O banco manda sobre o token: um papel rebaixado vale a partir de agora.
    req.user = {
      id: decoded.userId,
      email: decoded.email || '',
      fullName: decoded.fullName || '',
      role: snapshot.role,
      companyId: snapshot.companyId,
      companyName: snapshot.companyName,
    };

    finishAuth(req, res, startedAt);
    next();
  } catch (error) {
    console.error('[auth.middleware] falha ao revalidar sessao', error);
    res.status(503).json({ error: 'Não foi possível validar sua sessão. Tente novamente.' });
  }
};

export const requireRoles = (roles: AppRole[]) => (req: AuthedRequest, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403).json({ error: 'Sem permissão' });
    return;
  }
  next();
};

export const authenticateCustomerToken = async (
  req: AuthedCustomerRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as CustomerJwtClaims;

    if (!decoded.accountId || !decoded.customerId || !decoded.companyId) {
      res.status(403).json({ error: 'Token inválido' });
      return;
    }

    req.customer = {
      accountId: decoded.accountId,
      customerId: decoded.customerId,
      companyId: decoded.companyId,
      role: 'CLIENTE',
      email: decoded.email || '',
      fullName: decoded.fullName || '',
    };

    next();
  } catch (_error) {
    res.status(403).json({ error: 'Token inválido' });
  }
};
