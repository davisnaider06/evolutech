import express from 'express';
import cors from 'cors';
import 'dotenv/config';

// Importa as rotas modulares
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import companyRoutes from './routes/company.routes';
import tenantRoutes from './routes/tenant.routes';
import publicRoutes from './routes/public.routes';
import paymentWebhookRoutes from './routes/payment-webhook.routes';
import customerAuthRoutes from './routes/customer-auth.routes';
import customerRoutes from './routes/customer.routes';
import courseAuthRoutes from './routes/course-auth.routes';
import courseAdminRoutes from './routes/course-admin.routes';
import { prisma } from './db';

const app = express();
const PORT = process.env.PORT || 3001;
const requestLogEnabled = process.env.REQUEST_LOG_ENABLED === 'true';
const corsOrigins = String(process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const DB_KEEPALIVE_ENABLED = process.env.DB_KEEPALIVE_ENABLED !== 'false';
const DB_KEEPALIVE_MS = Math.max(60000, Number(process.env.DB_KEEPALIVE_MS || 240000));

// Middlewares Globais
app.use(
  cors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  })
);
app.use('/api/public/payments/webhook', paymentWebhookRoutes);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '8mb' }));

// Logger de Requisições
if (requestLogEnabled) {
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      const elapsedMs = Date.now() - startedAt;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} -> ${res.statusCode} (${elapsedMs}ms)`);
    });
    next();
  });
}

// Registro de Rotas
app.use('/api/auth', authRoutes);       // Login e Perfil
app.use('/api/admin', adminRoutes);     // Configurações do SaaS (Whitelabel)
app.use('/api/admin', tenantRoutes);    // Onboarding de tenants (Empresa + Dono + Módulos)
app.use('/api/company', companyRoutes); // Dados Operacionais (Clientes, Produtos)
app.use('/api/public', publicRoutes);   // Agendamento público por link
app.use('/api/customer-auth', customerAuthRoutes); // Cadastro/Login do cliente final
app.use('/api/customer', customerRoutes); // Portal autenticado do cliente final
app.use('/api/course-auth', courseAuthRoutes); // Login separado da gestao de cursos
app.use('/api/course-admin', courseAdminRoutes); // CRUD de cursos por conta separada

app.use((error: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error?.type === 'entity.too.large' || error?.status === 413) {
    return res.status(413).json({ error: 'Payload muito grande. Reduza o tamanho da imagem.' });
  }
  return next(error);
});

// Rota Raiz
app.get('/', (req, res) => {
  res.json({ status: 'Backend Evolutech Modular 🚀' });
});

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('Database connected');
  } catch (error) {
    console.error('Database connection failed during startup', error);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  if (DB_KEEPALIVE_ENABLED) {
    setInterval(async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (error) {
        console.warn('Database keepalive failed', error);
      }
    }, DB_KEEPALIVE_MS).unref();
  }
};

startServer();
