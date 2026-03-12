import { Request } from 'express';
import { User, Role } from '@prisma/client'; // Tipos automáticos do Prisma!

// Reexporta para usar no resto do app
export type AppRole = Role;

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  companyId: string | null;
  companyName: string | null;
  createdAt?: Date;
}

export interface AuthedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface AuthenticatedCustomer {
  accountId: string;
  customerId: string;
  companyId: string;
  role: 'CLIENTE';
  email: string;
  fullName: string;
}

export interface AuthedCustomerRequest extends Request {
  customer?: AuthenticatedCustomer;
}
