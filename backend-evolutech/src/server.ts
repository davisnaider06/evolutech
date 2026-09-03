import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { aplicarFusoDaCasa, FUSO_BARBEARIA } from './config/fuso';

// Antes de qualquer conta com data: o processo passa a viver no fuso da
// barbearia. Rodando em UTC (o padrao do Render), a mesma linha do banco
// aparecia como 15:00 para o dono e 12:00 para o cliente.
aplicarFusoDaCasa();

// Importa as rotas modulares
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import companyRoutes from './routes/company.routes';
import tenantRoutes from './routes/tenant.routes';
import publicRoutes from './routes/public.routes';
import paymentWebhookRoutes from './routes/payment-webhook.routes';
import customerAuthRoutes from './routes/customer-auth.routes';
import customerRoutes from './routes/customer.routes';
import { prisma } from './db';
import { CompanyService } from './services/company.service';
import { subscriptionBillingService } from './services/subscription-billing.service';
import { resolveCorsOrigins, isProduction } from './config/secrets';
import { securityHeaders, apiRateLimit } from './middlewares/security.middleware';

const app = express();
const PORT = process.env.PORT || 3001;
const requestLogEnabled = process.env.REQUEST_LOG_ENABLED === 'true';
const corsOrigins = resolveCorsOrigins();
const DB_KEEPALIVE_ENABLED = process.env.DB_KEEPALIVE_ENABLED !== 'false';
const DB_KEEPALIVE_MS = Math.max(60000, Number(process.env.DB_KEEPALIVE_MS || 240000));
const COLLECTIONS_JOB_ENABLED = process.env.COLLECTIONS_AUTOMATION_JOB_ENABLED === 'true';
const COLLECTIONS_JOB_MS = Math.max(60000, Number(process.env.COLLECTIONS_AUTOMATION_JOB_MS || 300000));
const COLLECTIONS_JOB_STARTUP_DELAY_MS = Math.max(
  5000,
  Number(process.env.COLLECTIONS_AUTOMATION_JOB_STARTUP_DELAY_MS || 15000)
);
// Regua das mensalidades: avisa 2 dias antes do vencimento e encerra quem
// nao pagou. Roda de 6 em 6 horas por padrao — a regua e por dia, entao
// rodar mais de uma vez e inofensivo (o envio e idempotente) e protege
// contra o servico ter ficado suspenso na hora certa.
const SUBSCRIPTION_JOB_ENABLED = process.env.SUBSCRIPTION_BILLING_JOB_ENABLED !== 'false';
const SUBSCRIPTION_JOB_MS = Math.max(
  600000,
  Number(process.env.SUBSCRIPTION_BILLING_JOB_MS || 6 * 60 * 60 * 1000)
);
const SUBSCRIPTION_JOB_STARTUP_DELAY_MS = Math.max(
  10000,
  Number(process.env.SUBSCRIPTION_BILLING_JOB_STARTUP_DELAY_MS || 45000)
);

// Em producao o servico fica atras de um proxy (Vercel, Render e afins).
// Sem isso, `req.ip` seria sempre o IP do proxy e o rate limit trataria o
// mundo inteiro como um unico cliente. `1` confia so no proxy imediato — nao
// na cadeia inteira de X-Forwarded-For, que o cliente consegue forjar.
app.set('trust proxy', isProduction ? 1 : false);

// Middlewares Globais
app.use(securityHeaders);
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

// Teto geral da API. Fica depois dos webhooks de proposito: o gateway pode
// reenviar em rajada e nao deve levar 429 por isso.
app.use('/api', apiRateLimit);

// Registro de Rotas
app.use('/api/auth', authRoutes);       // Login e Perfil
app.use('/api/admin', adminRoutes);     // Configurações do SaaS (Whitelabel)
app.use('/api/admin', tenantRoutes);    // Onboarding de tenants (Empresa + Dono + Módulos)
app.use('/api/company', companyRoutes); // Dados Operacionais (Clientes, Produtos)
app.use('/api/public', publicRoutes);   // Agendamento público por link
app.use('/api/customer-auth', customerAuthRoutes); // Cadastro/Login do cliente final
app.use('/api/customer', customerRoutes); // Portal autenticado do cliente final

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

app.get('/api/health', async (_req, res) => {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      ok: true,
      db: 'up',
      server_time: new Date().toISOString(),
      latency_ms: Date.now() - startedAt,
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      db: 'down',
      server_time: new Date().toISOString(),
      latency_ms: Date.now() - startedAt,
    });
  }
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
    console.log(`Fuso da agenda: ${FUSO_BARBEARIA} (agora ${new Date().toLocaleString('pt-BR')})`);
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

  if (COLLECTIONS_JOB_ENABLED) {
    const companyService = new CompanyService();
    let collectionsJobRunning = false;

    const runCollectionsJob = async (reason: 'startup' | 'interval') => {
      if (collectionsJobRunning) {
        console.warn(`Collections automation job skipped (${reason}) because a previous cycle is still running`);
        return;
      }

      collectionsJobRunning = true;
      try {
        await companyService.runCollectionsBackgroundJobs();
      } catch (error) {
        console.warn(`Collections automation job failed (${reason})`, error);
      } finally {
        collectionsJobRunning = false;
      }
    };

    setTimeout(() => {
      try {
        void runCollectionsJob('startup');
      } catch (error) {
        console.warn('Collections automation startup scheduling failed', error);
      }
    }, COLLECTIONS_JOB_STARTUP_DELAY_MS).unref();

    setInterval(() => {
      void runCollectionsJob('interval');
    }, COLLECTIONS_JOB_MS).unref();
  }

  if (SUBSCRIPTION_JOB_ENABLED) {
    let subscriptionJobRunning = false;

    const runSubscriptionJob = async (reason: 'startup' | 'interval') => {
      if (subscriptionJobRunning) {
        console.warn(`Subscription billing job skipped (${reason}): previous cycle still running`);
        return;
      }
      subscriptionJobRunning = true;
      try {
        const resultado = await subscriptionBillingService.executar();
        if (
          resultado.avisos_enviados ||
          resultado.renovadas ||
          resultado.canceladas ||
          resultado.em_aberto ||
          resultado.resumos_enviados ||
          resultado.erros
        ) {
          console.log(
            `[subscription-billing] ${reason}: ${resultado.avisos_enviados} avisos, ` +
              `${resultado.renovadas} renovadas, ${resultado.canceladas} encerradas, ` +
              `${resultado.em_aberto} em aberto, ${resultado.resumos_enviados} resumos, ` +
              `${resultado.erros} erros`
          );
          resultado.detalhes.forEach((linha) => console.log(`  - ${linha}`));
        }
      } catch (error) {
        console.warn(`Subscription billing job failed (${reason})`, error);
      } finally {
        subscriptionJobRunning = false;
      }
    };

    setTimeout(() => {
      void runSubscriptionJob('startup');
    }, SUBSCRIPTION_JOB_STARTUP_DELAY_MS).unref();

    setInterval(() => {
      void runSubscriptionJob('interval');
    }, SUBSCRIPTION_JOB_MS).unref();
  }
};

startServer();
