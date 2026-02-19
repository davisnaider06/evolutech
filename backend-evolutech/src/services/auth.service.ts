import { prisma } from '../db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_fallback_dev';

export class AuthService {
  async login(email: string, passwordPlain: string) {
    // Busca usuário e já traz as Roles juntas (JOIN automático)
    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: true }, 
    });

    if (!user) throw new Error('Credenciais inválidas');
    if (!user.passwordHash) throw new Error('Usuário sem senha definida');

    const isValid = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isValid) throw new Error('Credenciais inválidas');

    // Pega o primeiro papel (assumindo 1 role ativa por login por enquanto)
    const activeRole = user.roles[0]; 

    const token = jwt.sign(
      { 
        userId: user.id, 
        role: activeRole?.role, 
        companyId: activeRole?.companyId 
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.fullName,
        role: activeRole?.role,
        tenantId: activeRole?.companyId
      }
    };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: { company: true } // Traz dados da empresa
        }
      }
    });

    if (!user) return null;
    const activeRole = user.roles[0];

    return {
      id: user.id,
      full_name: user.fullName,
      email: user.email,
      role: activeRole?.role,
      company_id: activeRole?.companyId,
      company_name: activeRole?.company?.name
    };
  }
}