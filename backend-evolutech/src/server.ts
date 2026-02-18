import express from 'express';
import cors from 'cors';
import 'dotenv/config';

// Importa as rotas modulares
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import companyRoutes from './routes/company.routes';

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares Globais
app.use(cors());
app.use(express.json());

// Logger de Requisições
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Registro de Rotas
app.use('/api/auth', authRoutes);       // Login e Perfil
app.use('/api/admin', adminRoutes);     // Configurações do SaaS (Whitelabel)
app.use('/api/company', companyRoutes); // Dados Operacionais (Clientes, Produtos)

// Rota Raiz
app.get('/', (req, res) => {
  res.json({ status: 'Backend Evolutech Modular 🚀' });
});

// Inicialização
app.listen(PORT, () => {
  console.log(`✅ Server rodando na porta ${PORT}`);
});