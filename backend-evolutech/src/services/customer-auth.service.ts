import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { AuthenticatedCustomer } from '../types';
import { JWT_SECRET } from '../config/secrets';
import { chaveTelefone, clientesComTelefone } from '../utils/telefone.util';

/**
 * Validade de cada token. A sessao em si nao vence enquanto o cliente usar o
 * app: toda abertura chama /customer-auth/me, que devolve um token novo com o
 * prazo zerado. So cai quem ficar esse tempo todo sem abrir.
 *
 * 90 dias porque o cliente de barbearia volta de mes em mes, as vezes de dois
 * em dois; com 7 dias ele achava a tela de login quase toda vez que abria.
 */
const CUSTOMER_JWT_EXPIRES_IN = (process.env.CUSTOMER_JWT_EXPIRES_IN || '90d') as jwt.SignOptions['expiresIn'];

type CustomerJwtPayload = {
  accountId: string;
  customerId: string;
  companyId: string;
  email: string | null;
  fullName: string;
  role: 'CLIENTE';
};

/**
 * A conta guarda a chave do telefone, nao o numero como foi digitado — mesma
 * chave que o balcao e o link publico usam para saber quem e o cliente
 * (utils/telefone.util). Se o portal identificasse por uma regra propria, a
 * mesma pessoa seria uma no agendamento e outra na assinatura.
 *
 * O numero legivel continua no cadastro do cliente, que e de onde sai o
 * WhatsApp; aqui fica so o que serve para reencontrar a conta.
 *
 * So vale chave com DDD + 8 digitos. A chave sozinha aceita qualquer coisa
 * que tenha digito — "123" viraria login —, e sem DDD o mesmo numero de
 * cidades diferentes cairia na mesma conta. Devolve null quando o numero nao
 * serve para identificar ninguem.
 */
const chaveDaConta = (valor: unknown): string | null => {
  const chave = chaveTelefone(valor);
  return chave.length === 10 ? chave : null;
};

/**
 * Basta parecer email para tratarmos como email. Quem valida de verdade e o
 * dono da caixa de entrada; aqui a pergunta e so uma: o cliente digitou email
 * ou telefone?
 */
const pareceEmail = (valor: string) => valor.includes('@');

class CustomerAuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'CustomerAuthError';
  }
}

export class CustomerAuthService {
  private async getCustomerPortalModuleId() {
    const portalModule = await prisma.modulo.findFirst({
      where: {
        codigo: { in: ['customer_portal', 'portal_cliente'] },
        status: 'active',
      },
      select: { id: true },
    });

    if (!portalModule) {
      throw new CustomerAuthError('Modulo customer_portal nao encontrado no catalogo', 500);
    }

    return portalModule.id;
  }

  private async ensureCustomerPortalEnabled(companyId: string) {
    const portalModuleId = await this.getCustomerPortalModuleId();

    const enabled = await prisma.companyModule.findFirst({
      where: {
        companyId,
        moduloId: portalModuleId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!enabled) {
      throw new CustomerAuthError('Portal do cliente nao habilitado para esta empresa', 403);
    }
  }

  async listCompanies() {
    const portalModuleId = await this.getCustomerPortalModuleId();
    const rows = await prisma.companyModule.findMany({
      where: {
        moduloId: portalModuleId,
        isActive: true,
        company: { status: 'active' },
      },
      select: {
        company: {
          select: { id: true, name: true, slug: true, logoUrl: true },
        },
      },
      orderBy: {
        company: { name: 'asc' },
      },
    });

    const mapped = rows
      .map((row) => row.company)
      .filter(
        (company): company is { id: string; name: string; slug: string; logoUrl: string | null } =>
          Boolean(company)
      );

    const uniqueBySlug = new Map<
      string,
      { id: string; name: string; slug: string; logo_url: string | null }
    >();
    for (const company of mapped) {
      if (!uniqueBySlug.has(company.slug)) {
        uniqueBySlug.set(company.slug, {
          id: company.id,
          name: company.name,
          slug: company.slug,
          logo_url: company.logoUrl || null,
        });
      }
    }

    return Array.from(uniqueBySlug.values());
  }

  private signCustomerToken(payload: CustomerJwtPayload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: CUSTOMER_JWT_EXPIRES_IN });
  }

  async register(data: {
    company_slug?: string;
    full_name?: string;
    email?: string;
    phone?: string;
    password?: string;
  }) {
    const slug = String(data.company_slug || '').trim().toLowerCase();
    const fullName = String(data.full_name || '').trim();
    const emailDigitado = String(data.email || '').trim().toLowerCase();
    const telefoneDigitado = String(data.phone || '').trim();
    const password = String(data.password || '');

    if (!slug || !fullName || !password) {
      throw new CustomerAuthError(
        'Campos obrigatorios: company_slug, full_name, password',
        400
      );
    }

    // O identificador e o que amarra assinatura, agendamento e fidelidade ao
    // cliente certo. Sem email nem telefone nao ha por onde reencontrar essa
    // conta depois — por isso e aqui que o cadastro para.
    if (!emailDigitado && !telefoneDigitado) {
      throw new CustomerAuthError('Informe email ou telefone para identificar sua conta', 400);
    }

    if (emailDigitado && !pareceEmail(emailDigitado)) {
      throw new CustomerAuthError('Email invalido', 400);
    }

    const email = emailDigitado || null;
    const phone = telefoneDigitado ? chaveDaConta(telefoneDigitado) : null;
    if (telefoneDigitado && !phone) {
      throw new CustomerAuthError(
        'Telefone invalido. Use DDD + numero com ou sem codigo do pais',
        400
      );
    }

    if (password.length < 6) {
      throw new CustomerAuthError('Senha deve ter pelo menos 6 caracteres', 400);
    }

    const company = await prisma.company.findFirst({
      where: { slug, status: 'active' },
      select: { id: true, name: true, slug: true, logoUrl: true },
    });
    if (!company) throw new CustomerAuthError('Empresa nao encontrada', 404);

    await this.ensureCustomerPortalEnabled(company.id);

    // Identificador repetido dentro da empresa e conta duplicada: o cliente ja
    // tem acesso, so precisa entrar. A mensagem diz qual dos dois bateu para
    // ele saber por onde entrar.
    const contaExistente = await (prisma as any).customerAccount.findFirst({
      where: {
        companyId: company.id,
        OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
      },
      select: { id: true, email: true, phone: true },
    });
    if (contaExistente) {
      throw new CustomerAuthError(
        email && contaExistente.email === email
          ? 'Ja existe conta de cliente com este e-mail'
          : 'Ja existe conta de cliente com este telefone',
        409
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await prisma.$transaction(async (tx) => {
      // Cliente que a empresa ja cadastrou no balcao vira dono desta conta em
      // vez de virar um segundo cadastro — e o historico dele (assinatura,
      // pontos, agendamentos) continua sendo o mesmo.
      const existingCustomer = await this.encontrarClienteExistente(
        tx,
        company.id,
        email,
        telefoneDigitado
      );

      // Cliente do balcao que ja abriu conta antes, agora chegando por outro
      // identificador (cadastrou-se pelo telefone, volta digitando o email).
      // Cada cliente tem uma conta so, entao isto e "entre em vez de cadastrar"
      // — e nao o erro de chave duplicada que o banco daria.
      if (existingCustomer?.account) {
        throw new CustomerAuthError(
          'Este cliente ja possui conta no portal. Entre com o email ou telefone ja cadastrado',
          409
        );
      }

      const customer = existingCustomer
        ? await tx.customer.update({
            where: { id: existingCustomer.id },
            data: {
              name: fullName,
              // Sem sobrescrever com null: quem se cadastrou pelo telefone nao
              // apaga o email que a empresa ja tinha do cliente, e vice-versa.
              ...(email ? { email } : {}),
              // O numero como o cliente digitou — e daqui que sai o WhatsApp.
              // A chave, que so serve para reencontrar a conta, fica na conta.
              ...(telefoneDigitado ? { phone: telefoneDigitado } : {}),
              isActive: true,
            },
          })
        : await tx.customer.create({
            data: {
              companyId: company.id,
              name: fullName,
              email,
              phone: telefoneDigitado || null,
              isActive: true,
            },
          });

      const account = await (tx as any).customerAccount.create({
        data: {
          companyId: company.id,
          customerId: customer.id,
          email,
          phone,
          passwordHash,
          isActive: true,
        },
      });

      return { customer, account };
    });

    const token = this.signCustomerToken({
      accountId: created.account.id,
      customerId: created.customer.id,
      companyId: company.id,
      email: created.account.email,
      fullName: created.customer.name,
      role: 'CLIENTE',
    });

    return {
      token,
      customer: {
        id: created.customer.id,
        name: created.customer.name,
        email: created.account.email,
        phone: created.customer.phone,
        role: 'CLIENTE',
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        logo_url: company.logoUrl || null,
      },
    };
  }

  /**
   * Procura, entre os clientes da empresa, aquele que ja e a pessoa que esta se
   * cadastrando. Email casa direto no banco; telefone nao, porque o cadastro do
   * balcao guarda o numero como o atendente digitou — mesma busca do
   * agendamento pelo link publico (utils/telefone.util).
   */
  private async encontrarClienteExistente(
    tx: any,
    companyId: string,
    email: string | null,
    telefoneDigitado: string
  ) {
    const selecao = { id: true, name: true, account: { select: { id: true } } };

    if (email) {
      const porEmail = await tx.customer.findFirst({
        where: { companyId, email: { equals: email, mode: 'insensitive' } },
        select: selecao,
      });
      if (porEmail) return porEmail;
    }

    const [maisAntigo] = await clientesComTelefone(tx, companyId, telefoneDigitado);
    if (!maisAntigo) return null;

    return tx.customer.findUnique({ where: { id: maisAntigo.id }, select: selecao });
  }

  async login(data: {
    company_slug?: string;
    identifier?: string;
    email?: string;
    phone?: string;
    password?: string;
  }) {
    const slug = String(data.company_slug || '').trim().toLowerCase();
    // `email` e `phone` continuam aceitos para nao quebrar quem ja chama a API
    // com o campo antigo; `identifier` e o campo unico do formulario novo.
    const identificador = String(data.identifier || data.email || data.phone || '').trim();
    const password = String(data.password || '');

    if (!slug || !identificador || !password) {
      throw new CustomerAuthError('Campos obrigatorios: company_slug, identifier, password', 400);
    }

    const email = pareceEmail(identificador) ? identificador.toLowerCase() : null;
    const phone = email ? null : chaveDaConta(identificador);

    // Numero que nao da para normalizar e erro de digitacao, nao credencial
    // errada — dizer isso poupa o cliente de ficar tentando a senha.
    if (!email && !phone) {
      throw new CustomerAuthError('Informe um email ou telefone valido', 400);
    }

    const company = await prisma.company.findFirst({
      where: { slug, status: 'active' },
      select: { id: true, name: true, slug: true, logoUrl: true },
    });
    if (!company) throw new CustomerAuthError('Empresa nao encontrada', 404);

    await this.ensureCustomerPortalEnabled(company.id);

    const account = await (prisma as any).customerAccount.findFirst({
      where: {
        companyId: company.id,
        ...(email ? { email } : { phone }),
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, isActive: true },
        },
      },
    });

    if (!account) throw new CustomerAuthError('Credenciais invalidas', 401);
    if (!account.isActive || !account.customer?.isActive) {
      throw new CustomerAuthError('Conta de cliente inativa', 403);
    }

    const valid = await bcrypt.compare(password, String(account.passwordHash || ''));
    if (!valid) throw new CustomerAuthError('Credenciais invalidas', 401);

    await (prisma as any).customerAccount.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date() },
    });

    const token = this.signCustomerToken({
      accountId: account.id,
      customerId: account.customerId,
      companyId: account.companyId,
      email: account.email,
      fullName: account.customer?.name || '',
      role: 'CLIENTE',
    });

    return {
      token,
      customer: {
        id: account.customer?.id,
        name: account.customer?.name,
        email: account.email,
        phone: account.customer?.phone || null,
        role: 'CLIENTE',
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        logo_url: company.logoUrl || null,
      },
    };
  }

  async me(auth: AuthenticatedCustomer) {
    const account = await (prisma as any).customerAccount.findFirst({
      where: {
        id: auth.accountId,
        companyId: auth.companyId,
        customerId: auth.customerId,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            document: true,
            isActive: true,
          },
        },
        company: {
          select: { id: true, name: true, slug: true, logoUrl: true },
        },
      },
    });

    // 401, e nao 404: conta que sumiu e credencial que nao vale mais, e e isso
    // que faz o app encerrar a sessao em vez de tentar de novo.
    if (!account) throw new CustomerAuthError('Conta de cliente nao encontrada', 401);

    // O token nao sabe que a conta foi desativada. Como e aqui que ele se
    // renova, conta inativa para de renovar e a sessao cai na abertura.
    if (!account.isActive || !account.customer?.isActive) {
      throw new CustomerAuthError('Conta de cliente inativa', 403);
    }

    return {
      // Token novo a cada abertura do app: e isso que mantem o cliente logado
      // enquanto ele continuar usando, como num app de celular.
      token: this.signCustomerToken({
        accountId: account.id,
        customerId: account.customerId,
        companyId: account.companyId,
        email: account.email,
        fullName: account.customer?.name || '',
        role: 'CLIENTE',
      }),
      customer: {
        id: account.customer?.id,
        name: account.customer?.name,
        email: account.email || account.customer?.email || null,
        phone: account.customer?.phone || null,
        document: account.customer?.document || null,
        role: 'CLIENTE',
      },
      company: {
        id: account.company.id,
        name: account.company.name,
        slug: account.company.slug,
        logo_url: account.company.logoUrl || null,
      },
    };
  }
}

export { CustomerAuthError };
