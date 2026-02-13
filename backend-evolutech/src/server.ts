import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import { verifyToken } from '@clerk/clerk-sdk-node';
import { pool } from './db';

type AppRole =
  | 'SUPER_ADMIN_EVOLUTECH'
  | 'ADMIN_EVOLUTECH'
  | 'DONO_EMPRESA'
  | 'FUNCIONARIO_EMPRESA';

interface AuthenticatedUser {
  id: string;
  clerkId: string;
  fullName: string | null;
  email: string | null;
  createdAt: string | null;
  role: AppRole;
  companyId: string | null;
  companyName: string | null;
}

interface AuthedRequest extends Request {
  authUser?: AuthenticatedUser;
}

interface TableConfig {
  searchFields: string[];
  allowedOrderBy: string[];
  defaultOrderBy: string;
  dateField: string;
}

const app = express();
const PORT = process.env.PORT || 3001;
const CLERK_CLOCK_SKEW_MS = Number(process.env.CLERK_CLOCK_SKEW_MS || 300000);
let requestCounter = 0;

const TABLE_CONFIG: Record<string, TableConfig> = {
  customers: {
    searchFields: ['name', 'email', 'phone', 'document'],
    allowedOrderBy: ['name', 'created_at', 'updated_at', 'is_active'],
    defaultOrderBy: 'created_at',
    dateField: 'created_at',
  },
  products: {
    searchFields: ['name', 'sku', 'barcode'],
    allowedOrderBy: ['name', 'created_at', 'updated_at', 'stock_quantity', 'sale_price', 'is_active'],
    defaultOrderBy: 'created_at',
    dateField: 'created_at',
  },
  appointments: {
    searchFields: ['customer_name', 'service_name'],
    allowedOrderBy: ['scheduled_at', 'created_at', 'updated_at', 'status'],
    defaultOrderBy: 'scheduled_at',
    dateField: 'scheduled_at',
  },
  orders: {
    searchFields: ['customer_name'],
    allowedOrderBy: ['created_at', 'updated_at', 'status', 'payment_status', 'total'],
    defaultOrderBy: 'created_at',
    dateField: 'created_at',
  },
  cash_transactions: {
    searchFields: ['description', 'category', 'type'],
    allowedOrderBy: ['transaction_date', 'created_at', 'amount', 'type'],
    defaultOrderBy: 'created_at',
    dateField: 'transaction_date',
  },
};

const normalizeRole = (role: string | null | undefined): AppRole => {
  if (!role) return 'SUPER_ADMIN_EVOLUTECH';

  const roleMap: Record<string, AppRole> = {
    super_admin_evolutech: 'SUPER_ADMIN_EVOLUTECH',
    admin_evolutech: 'ADMIN_EVOLUTECH',
    dono_empresa: 'DONO_EMPRESA',
    funcionario_empresa: 'FUNCIONARIO_EMPRESA',
    SUPER_ADMIN_EVOLUTECH: 'SUPER_ADMIN_EVOLUTECH',
    ADMIN_EVOLUTECH: 'ADMIN_EVOLUTECH',
    DONO_EMPRESA: 'DONO_EMPRESA',
    FUNCIONARIO_EMPRESA: 'FUNCIONARIO_EMPRESA',
  };

  return roleMap[role] || 'SUPER_ADMIN_EVOLUTECH';
};

const isEvolutechRole = (role: AppRole) =>
  role === 'SUPER_ADMIN_EVOLUTECH' || role === 'ADMIN_EVOLUTECH';

const isSuperAdmin = (role: AppRole) => role === 'SUPER_ADMIN_EVOLUTECH';

const safeIdentifier = (value: string) => /^[a-z_][a-z0-9_]*$/i.test(value);

const getTargetCompanyId = (req: AuthedRequest): string | null => {
  const user = req.authUser!;
  if (!isEvolutechRole(user.role)) {
    return user.companyId;
  }
  const companyId = req.query.company_id as string | undefined;
  return companyId || null;
};

const requireRoles = (roles: AppRole[]) => (req: AuthedRequest, res: Response, next: NextFunction) => {
  if (!req.authUser || !roles.includes(req.authUser.role)) {
    res.status(403).json({ error: 'Sem permissÃ£o para este recurso' });
    return;
  }
  next();
};

const canAccessCompany = (user: AuthenticatedUser, companyId: string | null) => {
  if (!companyId) return false;
  if (isEvolutechRole(user.role)) return true;
  return user.companyId === companyId;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isTransientDbError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  return (
    message.includes('connection timeout') ||
    message.includes('terminat') ||
    message.includes('econnreset') ||
    message.includes('socket') ||
    code === '57P01' ||
    code === '57P02' ||
    code === '57P03'
  );
};
const queryWithRetry = async (text: string, values: any[], requestId: string, label: string) => {
  const maxAttempts = 2;
  let lastError: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await pool.query(text, values);
    } catch (error: any) {
      lastError = error;
      const transient = isTransientDbError(error);
      console.error(`[DB ${requestId}] ${label} failed (attempt ${attempt}/${maxAttempts})`, {
        message: error?.message,
        code: error?.code,
        transient,
      });
      if (!transient || attempt === maxAttempts) break;
      await sleep(400 * attempt);
    }
  }
  throw lastError;
};

const tableColumnsCache = new Map<string, Set<string>>();
const getTableColumns = async (tableName: string): Promise<Set<string>> => {
  const cached = tableColumnsCache.get(tableName);
  if (cached) return cached;
  const { rows } = await queryWithRetry(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
    'schema',
    `load ${tableName} columns`
  );
  const columns = new Set(rows.map((r: any) => r.column_name));
  tableColumnsCache.set(tableName, columns);
  console.log(`[SCHEMA] ${tableName} columns:`, Array.from(columns).sort());
  return columns;
};
const getCompaniesColumns = async (): Promise<Set<string>> => getTableColumns('companies');

app.use(cors());
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = (++requestCounter).toString().padStart(6, '0');
  const startedAt = Date.now();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const rawAuth = req.headers.authorization;
  const authPreview = rawAuth?.startsWith('Bearer ') ? `${rawAuth.slice(0, 20)}...` : 'none';

  (req as any).requestId = requestId;
  console.log(`[REQ ${requestId}] ${req.method} ${req.originalUrl} ip=${ip} auth=${authPreview}`);

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    console.log(`[RES ${requestId}] ${req.method} ${req.originalUrl} status=${res.statusCode} duration=${durationMs}ms`);
  });

  next();
});

console.log('ðŸ” MODO BACKEND API');
console.log(`ðŸ”‘ Secret Key carregada: ${process.env.CLERK_SECRET_KEY?.substring(0, 10)}...`);
console.log(`â±ï¸ Clock skew configurado: ${CLERK_CLOCK_SKEW_MS}ms`);

app.get('/', (_req, res) => {
  res.json({ status: 'Backend Online' });
});

const requireAuth = async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
  const requestId = (req as any).requestId || 'no-id';
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[AUTH ' + requestId + '] Missing bearer token');
    res.status(401).json({ error: 'Token nÃ£o fornecido' });
    return;
  }

  const token = authHeader.split(' ')[1];

  let decoded: any;
  try {
    decoded = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      clockSkewInMs: CLERK_CLOCK_SKEW_MS,
    } as any);
  } catch (error: any) {
    console.error('[AUTH ' + requestId + '] Token validation failed', { message: error?.message, reason: error?.reason });
    res.status(401).json({
      error: 'Token InvÃ¡lido',
      details: error?.message,
      reason: error?.reason,
    });
    return;
  }

  try {
    const clerkId = decoded.sub as string;
    console.log('[AUTH ' + requestId + '] Token valid for sub=' + clerkId);
    const userQuery = `
      SELECT 
        p.id,
        p.full_name,
        p.email,
        p.created_at,
        p.clerk_id,
        ur.role,
        ur.company_id,
        c.name as company_name
      FROM profiles p
      LEFT JOIN user_roles ur ON p.id = ur.user_id
      LEFT JOIN companies c ON c.id = ur.company_id
      WHERE p.clerk_id = $1
      LIMIT 1
    `;

    let result = await queryWithRetry(userQuery, [clerkId], requestId, 'load auth profile');
    let user = result.rows[0];

    if (!user) {
      const insert = await queryWithRetry(
        `INSERT INTO profiles (clerk_id, full_name, email)
         VALUES ($1, $2, $3)
         RETURNING id, full_name, email, created_at, clerk_id`,
        [clerkId, 'Novo UsuÃ¡rio', 'email@temp.com'],
        requestId,
        'create auth profile'
      );
      user = insert.rows[0];
      user.role = 'super_admin_evolutech';
      user.company_id = null;
      user.company_name = null;
    }

    req.authUser = {
      id: user.id,
      clerkId: user.clerk_id,
      fullName: user.full_name,
      email: user.email,
      createdAt: user.created_at,
      role: normalizeRole(user.role),
      companyId: user.company_id || null,
      companyName: user.company_name || null,
    };

    next();
  } catch (error: any) {
    console.error('[AUTH ' + requestId + '] Database error while loading profile', { message: error?.message, code: error?.code, stack: error?.stack });
    res.status(503).json({
      error: 'Falha de conexÃ£o com banco',
      details: error?.message,
    });
  }
};

app.get('/api/me', requireAuth, async (req: AuthedRequest, res: Response) => {
  const user = req.authUser!;
  res.json({
    user: {
      id: user.id,
      full_name: user.fullName,
      email: user.email,
      created_at: user.createdAt,
      role: user.role,
      company_id: user.companyId,
    },
    company: user.companyId ? { id: user.companyId, name: user.companyName } : null,
  });
});

app.get('/api/roles', requireAuth, (_req, res) => {
  res.json({
    roles: [
      'SUPER_ADMIN_EVOLUTECH',
      'ADMIN_EVOLUTECH',
      'DONO_EMPRESA',
      'FUNCIONARIO_EMPRESA',
    ],
  });
});

app.get('/api/companies', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.authUser!;
    const columns = await getCompaniesColumns();
    const selectFields = [
      'id',
      'name',
      'slug',
      'plan',
      'status',
      'logo_url',
      'created_at',
      'updated_at',
      columns.has('monthly_revenue') ? 'monthly_revenue' : '0::numeric as monthly_revenue',
      columns.has('sistema_base_id') ? 'sistema_base_id' : 'NULL::uuid as sistema_base_id',
    ].join(', ');

    if (isEvolutechRole(user.role)) {
      const { rows } = await pool.query(`SELECT ${selectFields} FROM companies ORDER BY created_at DESC`);
      res.json(rows);
      return;
    }

    if (!user.companyId) {
      res.json([]);
      return;
    }

    const { rows } = await pool.query(`SELECT ${selectFields} FROM companies WHERE id = $1`, [user.companyId]);
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar empresas', details: error?.message });
  }
});

app.post('/api/companies', requireAuth, requireRoles(['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH']), async (req: AuthedRequest, res: Response) => {
  try {
    const { name, slug, plan = 'starter', monthly_revenue = 0, logo_url = null, sistema_base_id = null, status = 'active' } = req.body;
    console.log('[COMPANIES] create requested', {
      userId: req.authUser?.id,
      role: req.authUser?.role,
      name,
      slug,
      plan,
      hasLogo: !!logo_url,
      hasSistemaBase: !!sistema_base_id,
      status,
    });
    if (!name || !slug) {
      res.status(400).json({ error: 'Campos obrigatÃ³rios: name, slug' });
      return;
    }

    const columns = await getCompaniesColumns();
    const insertData: Record<string, any> = { name, slug };
    if (columns.has('plan')) insertData.plan = plan;
    if (columns.has('status')) insertData.status = status;
    if (columns.has('logo_url')) insertData.logo_url = logo_url;
    if (columns.has('monthly_revenue')) insertData.monthly_revenue = monthly_revenue;
    if (columns.has('sistema_base_id')) insertData.sistema_base_id = sistema_base_id;

    const insertColumns = Object.keys(insertData);
    const values = insertColumns.map((col) => insertData[col]);
    const placeholders = insertColumns.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `INSERT INTO companies (${insertColumns.join(', ')})
       VALUES (${placeholders})
       RETURNING *`,
      values
    );
    res.status(201).json(rows[0]);
  } catch (error: any) {
    console.error('[COMPANIES] create failed', {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      constraint: error?.constraint,
      stack: error?.stack,
    });
    res.status(500).json({ error: 'Erro ao criar empresa', details: error?.message });
  }
});

app.patch('/api/companies/:id', requireAuth, requireRoles(['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH']), async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const columns = await getCompaniesColumns();
    const allowed = ['name', 'slug', 'plan', 'monthly_revenue', 'logo_url', 'sistema_base_id', 'status']
      .filter((col) => columns.has(col));
    const keys = Object.keys(req.body || {}).filter(k => allowed.includes(k));
    if (!keys.length) {
      res.status(400).json({ error: 'Nenhum campo vÃ¡lido para atualizar' });
      return;
    }

    const setParts = keys.map((k, i) => `${k} = $${i + 1}`);
    const values = keys.map(k => req.body[k]);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE companies SET ${setParts.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (!rows.length) {
      res.status(404).json({ error: 'Empresa nÃ£o encontrada' });
      return;
    }

    res.json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao atualizar empresa', details: error?.message });
  }
});

app.delete('/api/companies/:id', requireAuth, requireRoles(['SUPER_ADMIN_EVOLUTECH']), async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query('DELETE FROM companies WHERE id = $1', [id]);
    if (!rowCount) {
      res.status(404).json({ error: 'Empresa nÃ£o encontrada' });
      return;
    }
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao excluir empresa', details: error?.message });
  }
});

app.get('/api/modulos', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.authUser!;
    const onlyActive = !isEvolutechRole(user.role);
    const query = onlyActive
      ? 'SELECT * FROM modulos WHERE status = $1 ORDER BY is_core DESC, nome ASC'
      : 'SELECT * FROM modulos ORDER BY is_core DESC, nome ASC';
    const params = onlyActive ? ['active'] : [];
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar mÃ³dulos', details: error?.message });
  }
});

app.post('/api/modulos', requireAuth, requireRoles(['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH']), async (req: AuthedRequest, res: Response) => {
  try {
    const {
      nome,
      descricao = null,
      codigo,
      icone = null,
      preco_mensal = 0,
      is_core = false,
      status = 'active',
    } = req.body;
    if (!nome || !codigo) {
      res.status(400).json({ error: 'Campos obrigatÃ³rios: nome, codigo' });
      return;
    }
    const { rows } = await pool.query(
      `INSERT INTO modulos (nome, descricao, codigo, icone, preco_mensal, is_core, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [nome, descricao, codigo, icone, preco_mensal, is_core, status]
    );
    res.status(201).json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao criar mÃ³dulo', details: error?.message });
  }
});

app.patch('/api/modulos/:id', requireAuth, requireRoles(['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH']), async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const allowed = ['nome', 'descricao', 'icone', 'preco_mensal', 'is_core', 'status'];
    const keys = Object.keys(req.body || {}).filter(k => allowed.includes(k));
    if (!keys.length) {
      res.status(400).json({ error: 'Nenhum campo vÃ¡lido para atualizar' });
      return;
    }
    const setParts = keys.map((k, i) => `${k} = $${i + 1}`);
    const values = keys.map(k => req.body[k]);
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE modulos SET ${setParts.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!rows.length) {
      res.status(404).json({ error: 'MÃ³dulo nÃ£o encontrado' });
      return;
    }
    res.json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao atualizar mÃ³dulo', details: error?.message });
  }
});

app.delete('/api/modulos/:id', requireAuth, requireRoles(['SUPER_ADMIN_EVOLUTECH']), async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query('DELETE FROM modulos WHERE id = $1', [id]);
    if (!rowCount) {
      res.status(404).json({ error: 'MÃ³dulo nÃ£o encontrado' });
      return;
    }
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao excluir mÃ³dulo', details: error?.message });
  }
});

app.get('/api/sistemas-base', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.authUser!;
    const onlyActive = !isEvolutechRole(user.role);
    const query = onlyActive
      ? 'SELECT * FROM sistemas_base WHERE status = $1 ORDER BY created_at DESC'
      : 'SELECT * FROM sistemas_base ORDER BY created_at DESC';
    const params = onlyActive ? ['active'] : [];
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar sistemas base', details: error?.message });
  }
});

app.post('/api/sistemas-base', requireAuth, requireRoles(['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH']), async (req: AuthedRequest, res: Response) => {
  try {
    const columns = await getTableColumns('sistemas_base');
    const payload: Record<string, any> = {};
    if (columns.has('nome')) payload.nome = req.body?.nome;
    if (columns.has('descricao')) payload.descricao = req.body?.descricao || null;
    if (columns.has('nicho')) payload.nicho = req.body?.nicho;
    if (columns.has('versao')) payload.versao = req.body?.versao || '1.0.0';
    if (columns.has('status')) payload.status = req.body?.status || 'active';

    if (!payload.nome || !payload.nicho) {
      res.status(400).json({ error: 'Campos obrigatórios: nome, nicho' });
      return;
    }

    const insertColumns = Object.keys(payload);
    const values = insertColumns.map((col) => payload[col]);
    const placeholders = insertColumns.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `INSERT INTO sistemas_base (${insertColumns.join(', ')})
       VALUES (${placeholders})
       RETURNING *`,
      values
    );
    res.status(201).json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao criar sistema base', details: error?.message });
  }
});

app.patch('/api/sistemas-base/:id', requireAuth, requireRoles(['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH']), async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const columns = await getTableColumns('sistemas_base');
    const allowed = ['nome', 'descricao', 'nicho', 'versao', 'status'].filter((c) => columns.has(c));
    const keys = Object.keys(req.body || {}).filter((k) => allowed.includes(k));
    if (!keys.length) {
      res.status(400).json({ error: 'Nenhum campo válido para atualizar' });
      return;
    }

    const setParts = keys.map((k, i) => `${k} = $${i + 1}`);
    const values = keys.map((k) => req.body[k]);
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE sistemas_base
       SET ${setParts.join(', ')}
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );
    if (!rows.length) {
      res.status(404).json({ error: 'Sistema base não encontrado' });
      return;
    }
    res.json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao atualizar sistema base', details: error?.message });
  }
});

app.delete('/api/sistemas-base/:id', requireAuth, requireRoles(['SUPER_ADMIN_EVOLUTECH']), async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query('DELETE FROM sistemas_base WHERE id = $1', [id]);
    if (!rowCount) {
      res.status(404).json({ error: 'Sistema base não encontrado' });
      return;
    }
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao excluir sistema base', details: error?.message });
  }
});

app.get('/api/sistemas-base/:id/modulos', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT sbm.modulo_id, sbm.is_default, m.*
       FROM sistema_base_modulos sbm
       INNER JOIN modulos m ON m.id = sbm.modulo_id
       WHERE sbm.sistema_base_id = $1
       ORDER BY m.is_core DESC, m.nome ASC`,
      [id]
    );
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar mÃ³dulos do sistema', details: error?.message });
  }
});

app.put('/api/sistemas-base/:id/modulos', requireAuth, requireRoles(['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH']), async (req: AuthedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const moduleIds = Array.isArray(req.body?.moduleIds) ? req.body.moduleIds : [];
    const defaultModuleIds = Array.isArray(req.body?.defaultModuleIds) ? req.body.defaultModuleIds : [];

    await client.query('BEGIN');
    await client.query('DELETE FROM sistema_base_modulos WHERE sistema_base_id = $1', [id]);

    for (const moduleId of moduleIds) {
      await client.query(
        `INSERT INTO sistema_base_modulos (sistema_base_id, modulo_id, is_default)
         VALUES ($1, $2, $3)`,
        [id, moduleId, defaultModuleIds.includes(moduleId)]
      );
    }

    await client.query('COMMIT');
    res.status(204).send();
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Erro ao salvar mÃ³dulos do sistema', details: error?.message });
  } finally {
    client.release();
  }
});

app.get('/api/companies/:companyId/modules', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const companyIdParam = req.params.companyId;
    const companyId = Array.isArray(companyIdParam) ? companyIdParam[0] : companyIdParam;
    if (!canAccessCompany(req.authUser!, companyId)) {
      res.status(403).json({ error: 'Sem permissÃ£o para esta empresa' });
      return;
    }

    const { rows } = await pool.query(
      `SELECT em.id, em.modulo_id, em.ativo, em.obrigatorio, m.*
       FROM empresa_modulos em
       INNER JOIN modulos m ON m.id = em.modulo_id
       WHERE em.empresa_id = $1
       ORDER BY m.is_core DESC, m.nome ASC`,
      [companyId]
    );
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar mÃ³dulos da empresa', details: error?.message });
  }
});

app.put('/api/companies/:companyId/modules', requireAuth, async (req: AuthedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const companyIdParam = req.params.companyId;
    const companyId = Array.isArray(companyIdParam) ? companyIdParam[0] : companyIdParam;
    if (!canAccessCompany(req.authUser!, companyId)) {
      res.status(403).json({ error: 'Sem permissÃ£o para esta empresa' });
      return;
    }

    const activeModuleIds = Array.isArray(req.body?.activeModuleIds) ? req.body.activeModuleIds : [];
    await client.query('BEGIN');

    await client.query('UPDATE empresa_modulos SET ativo = false WHERE empresa_id = $1', [companyId]);

    for (const moduleId of activeModuleIds) {
      await client.query(
        `INSERT INTO empresa_modulos (empresa_id, modulo_id, ativo, obrigatorio)
         VALUES ($1, $2, true, false)
         ON CONFLICT (empresa_id, modulo_id)
         DO UPDATE SET ativo = true`,
        [companyId, moduleId]
      );
    }

    await client.query('COMMIT');
    res.status(204).send();
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Erro ao salvar mÃ³dulos da empresa', details: error?.message });
  } finally {
    client.release();
  }
});

app.get('/api/users', requireAuth, requireRoles(['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH']), async (_req: AuthedRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT 
         p.id,
         p.full_name,
         p.email,
         p.is_active,
         p.company_id,
         p.created_at,
         p.updated_at,
         ur.role,
         ur.company_id as role_company_id,
         c.name as company_name
       FROM profiles p
       LEFT JOIN user_roles ur ON ur.user_id = p.id
       LEFT JOIN companies c ON c.id = p.company_id
       ORDER BY p.created_at DESC`
    );
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar usuÃ¡rios', details: error?.message });
  }
});

app.patch('/api/users/:id/active', requireAuth, requireRoles(['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH']), async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      res.status(400).json({ error: 'Campo is_active deve ser boolean' });
      return;
    }
    const { rows } = await pool.query(
      'UPDATE profiles SET is_active = $1 WHERE id = $2 RETURNING *',
      [is_active, id]
    );
    if (!rows.length) {
      res.status(404).json({ error: 'UsuÃ¡rio nÃ£o encontrado' });
      return;
    }
    res.json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao atualizar status do usuÃ¡rio', details: error?.message });
  }
});

app.put('/api/users/:id/role', requireAuth, requireRoles(['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH']), async (req: AuthedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { role, company_id = null } = req.body;
    if (!role) {
      res.status(400).json({ error: 'Campo role Ã© obrigatÃ³rio' });
      return;
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM user_roles WHERE user_id = $1', [id]);
    await client.query(
      `INSERT INTO user_roles (user_id, role, company_id)
       VALUES ($1, $2, $3)`,
      [id, role, company_id]
    );
    await client.query('COMMIT');
    res.status(204).send();
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Erro ao atualizar role do usuÃ¡rio', details: error?.message });
  } finally {
    client.release();
  }
});

app.get('/api/company/:table', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const tableParam = req.params.table;
    const table = Array.isArray(tableParam) ? tableParam[0] : tableParam;
    const tableConfig = TABLE_CONFIG[table];
    if (!tableConfig) {
      res.status(404).json({ error: 'Tabela nÃ£o suportada' });
      return;
    }

    const companyId = getTargetCompanyId(req);
    if (!companyId || !canAccessCompany(req.authUser!, companyId)) {
      res.status(403).json({ error: 'Empresa nÃ£o informada ou sem permissÃ£o' });
      return;
    }

    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 10);
    const offset = (page - 1) * pageSize;
    const search = (req.query.search as string | undefined)?.trim();
    const status = (req.query.status as string | undefined)?.trim();
    const isActive = (req.query.is_active as string | undefined)?.trim();
    const dateFrom = (req.query.dateFrom as string | undefined)?.trim();
    const dateTo = (req.query.dateTo as string | undefined)?.trim();
    const orderByCandidate = (req.query.orderBy as string | undefined) || tableConfig.defaultOrderBy;
    const orderDirection = (req.query.orderDirection as string | undefined)?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const orderBy = tableConfig.allowedOrderBy.includes(orderByCandidate) ? orderByCandidate : tableConfig.defaultOrderBy;

    const values: any[] = [companyId];
    const whereParts: string[] = ['company_id = $1'];

    if (search) {
      const searchParts: string[] = [];
      for (const field of tableConfig.searchFields) {
        values.push(`%${search}%`);
        searchParts.push(`${field} ILIKE $${values.length}`);
      }
      whereParts.push(`(${searchParts.join(' OR ')})`);
    }

    if (status && status !== 'all' && safeIdentifier('status')) {
      values.push(status);
      whereParts.push(`status = $${values.length}`);
    }

    if (isActive && isActive !== 'all' && safeIdentifier('is_active')) {
      values.push(isActive === 'true');
      whereParts.push(`is_active = $${values.length}`);
    }

    if (dateFrom) {
      values.push(dateFrom);
      whereParts.push(`${tableConfig.dateField} >= $${values.length}`);
    }

    if (dateTo) {
      values.push(dateTo);
      whereParts.push(`${tableConfig.dateField} <= $${values.length}`);
    }

    const whereClause = whereParts.join(' AND ');
    const countQuery = `SELECT COUNT(*)::int as total FROM ${table} WHERE ${whereClause}`;
    const { rows: countRows } = await pool.query(countQuery, values);
    const total = countRows[0]?.total || 0;

    values.push(pageSize);
    values.push(offset);
    const dataQuery = `
      SELECT * FROM ${table}
      WHERE ${whereClause}
      ORDER BY ${orderBy} ${orderDirection}
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `;
    const { rows } = await pool.query(dataQuery, values);

    res.json({
      data: rows,
      total,
      page,
      pageSize,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar dados da empresa', details: error?.message });
  }
});

app.post('/api/company/:table', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const tableParam = req.params.table;
    const table = Array.isArray(tableParam) ? tableParam[0] : tableParam;
    if (!TABLE_CONFIG[table]) {
      res.status(404).json({ error: 'Tabela nÃ£o suportada' });
      return;
    }

    const user = req.authUser!;
    const payload = { ...(req.body || {}) };
    const companyId = isEvolutechRole(user.role)
      ? (payload.company_id as string | undefined)
      : user.companyId;

    if (!companyId || !canAccessCompany(user, companyId)) {
      res.status(403).json({ error: 'Empresa nÃ£o informada ou sem permissÃ£o' });
      return;
    }

    payload.company_id = companyId;

    const columns = Object.keys(payload).filter(safeIdentifier);
    if (!columns.length) {
      res.status(400).json({ error: 'Payload invÃ¡lido' });
      return;
    }

    const values = columns.map(c => payload[c]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    const { rows } = await pool.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao criar registro', details: error?.message });
  }
});

app.patch('/api/company/:table/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const tableParam = req.params.table;
    const idParam = req.params.id;
    const table = Array.isArray(tableParam) ? tableParam[0] : tableParam;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!TABLE_CONFIG[table]) {
      res.status(404).json({ error: 'Tabela nÃ£o suportada' });
      return;
    }

    const user = req.authUser!;
    const payload = { ...(req.body || {}) };
    delete payload.company_id;

    const columns = Object.keys(payload).filter(safeIdentifier);
    if (!columns.length) {
      res.status(400).json({ error: 'Nenhum campo vÃ¡lido para atualizar' });
      return;
    }

    const targetCompanyId = getTargetCompanyId(req);
    if (!targetCompanyId || !canAccessCompany(user, targetCompanyId)) {
      res.status(403).json({ error: 'Empresa nÃ£o informada ou sem permissÃ£o' });
      return;
    }

    const setParts = columns.map((c, i) => `${c} = $${i + 1}`);
    const values = columns.map(c => payload[c]);
    values.push(id);
    values.push(targetCompanyId);

    const query = `
      UPDATE ${table}
      SET ${setParts.join(', ')}
      WHERE id = $${values.length - 1}
        AND company_id = $${values.length}
      RETURNING *
    `;
    const { rows } = await pool.query(query, values);
    if (!rows.length) {
      res.status(404).json({ error: 'Registro nÃ£o encontrado' });
      return;
    }
    res.json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao atualizar registro', details: error?.message });
  }
});

app.delete('/api/company/:table/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const tableParam = req.params.table;
    const idParam = req.params.id;
    const table = Array.isArray(tableParam) ? tableParam[0] : tableParam;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!TABLE_CONFIG[table]) {
      res.status(404).json({ error: 'Tabela nÃ£o suportada' });
      return;
    }

    const user = req.authUser!;
    const targetCompanyId = getTargetCompanyId(req);
    if (!targetCompanyId || !canAccessCompany(user, targetCompanyId)) {
      res.status(403).json({ error: 'Empresa nÃ£o informada ou sem permissÃ£o' });
      return;
    }

    const { rowCount } = await pool.query(
      `DELETE FROM ${table} WHERE id = $1 AND company_id = $2`,
      [id, targetCompanyId]
    );
    if (!rowCount) {
      res.status(404).json({ error: 'Registro nÃ£o encontrado' });
      return;
    }
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao excluir registro', details: error?.message });
  }
});

app.listen(PORT, () => {
  console.log(`âœ… Backend rodando na porta ${PORT}`);
});

