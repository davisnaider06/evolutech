import express, { Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import { verifyToken } from '@clerk/clerk-sdk-node'; // Importamos a validação manual
import { pool } from './db';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

console.log("🔍 MODO DIAGNÓSTICO ATIVADO");
console.log(`🔑 Secret Key carregada: ${process.env.CLERK_SECRET_KEY?.substring(0, 10)}...`);

app.get('/', (req, res) => {
  res.json({ status: 'Backend Online' });
});

// REMOVEMOS o middleware ClerkExpressRequireAuth()
// Vamos fazer a validação manualmente dentro da rota para ver o erro.
app.get('/api/me', async (req: Request, res: Response): Promise<void> => {
  console.log("\n📡 Recebida requisição em /api/me");
  
  // 1. Pega o Token cru do Header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn("❌ Header Authorization ausente ou mal formatado");
    res.status(401).json({ error: "Token não fornecido" });
    return;
  }

  const token = authHeader.split(' ')[1];
  console.log(`🎫 Token recebido (início): ${token.substring(0, 15)}...`);

  try {
    // 2. Tenta validar manualmente usando a chave secreta do .env
    // Isso vai lançar um erro específico se falhar
    const decoded = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    }as any);

    console.log("✅ Token Validado com Sucesso!");
    console.log(`👤 User ID (sub): ${decoded.sub}`);

    // 3. Se passou, segue para o banco (Código original)
    const userId = decoded.sub;
    
    let query = `
      SELECT p.id, p.full_name, p.email, p.clerk_id, ur.role, ur.company_id
      FROM profiles p
      LEFT JOIN user_roles ur ON p.id = ur.user_id
      WHERE p.clerk_id = $1
    `;
    
    let result = await pool.query(query, [userId]);
    let user = result.rows[0];

    // Cria usuário se não existir (Mockado para teste)
    if (!user) {
        console.log("🆕 Criando usuário novo no banco...");
        const insert = await pool.query(
            "INSERT INTO profiles (clerk_id, full_name, email) VALUES ($1, $2, $3) RETURNING *",
            [userId, "Novo Usuário", "email@temp.com"]
        );
        user = insert.rows[0];
        user.role = 'SUPER_ADMIN_EVOLUTECH'; 
    }

    res.json({
      user: {
        id: user.id,
        role: user.role || 'SUPER_ADMIN_EVOLUTECH',
        tenantId: user.company_id,
      },
      company: null
    });

  } catch (error: any) {
    // AQUI ESTÁ O SEGREDO: Vamos imprimir o erro exato
    console.error("❌ ERRO FATAL NA VALIDAÇÃO DO TOKEN:");
    console.error("➡️ Mensagem:", error.message);
    console.error("➡️ Motivo:", error.reason);
    
    res.status(401).json({ 
      error: "Token Inválido", 
      details: error.message,
      reason: error.reason 
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend rodando na porta ${PORT}`);
});