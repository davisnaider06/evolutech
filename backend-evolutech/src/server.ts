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

const app = express();
const PORT = process.env.PORT || 3001;
const requestLogEnabled = process.env.REQUEST_LOG_ENABLED === 'true';
const corsOrigins = String(process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Middlewares Globais
app.use(
  cors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  })
);
app.use('/api/public/payments/webhook', paymentWebhookRoutes);
app.use(express.json());

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

// Rota Raiz
app.get('/', (req, res) => {
  res.json({ status: 'Backend Evolutech Modular 🚀' });
});

// Inicialização
app.listen(PORT, () => {
  console.log(`✅ Server rodando na porta ${PORT}`);
});
