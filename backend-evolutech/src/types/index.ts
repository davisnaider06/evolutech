import { Request } from 'express';

export type AppRole =
  | 'SUPER_ADMIN_EVOLUTECH'
  | 'ADMIN_EVOLUTECH'
  | 'DONO_EMPRESA'
  | 'FUNCIONARIO_EMPRESA';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  companyId: string | null;
  companyName: string | null;
  createdAt?: string;
}

export interface AuthedRequest extends Request {
  user?: AuthenticatedUser;
  requestId?: string;
}