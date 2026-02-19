import { prisma } from '../db';
import { AuthenticatedUser } from '../types';
import { TABLE_CONFIG } from '../config/tableConfig';

export class CompanyService {
  
  // Mapeia string da URL -> Model do Prisma
  private getModel(tableName: string) {
    // Mapeamento manual para garantir segurança e converter plural/singular se necessário
    const map: Record<string, any> = {
      customers: prisma.customer,
      products: prisma.product,
      appointments: prisma.appointment,
      orders: prisma.order,
      // adicione novos models aqui
    };
    return map[tableName];
  }

  private checkAccess(user: AuthenticatedUser, companyId: string) {
    if (user.role === 'SUPER_ADMIN_EVOLUTECH') return true;
    return user.companyId === companyId;
  }

  async listTableData(table: string, user: AuthenticatedUser, queryParams: any) {
    const model = this.getModel(table);
    const config = TABLE_CONFIG[table];
    if (!model || !config) throw new Error('Tabela não suportada ou não configurada');

    const companyId = user.role === 'SUPER_ADMIN_EVOLUTECH' 
        ? (queryParams.company_id || user.companyId) 
        : user.companyId;

    if (!companyId) throw new Error('Company ID obrigatório');
    if (!this.checkAccess(user, companyId)) throw new Error('Acesso negado');

    const page = Number(queryParams.page || 1);
    const pageSize = Number(queryParams.pageSize || 10);
    const search = (queryParams.search as string)?.trim();

    // Filtros Dinâmicos do Prisma
    const where: any = { companyId };

    if (search && config.searchFields.length > 0) {
      where['OR'] = config.searchFields.map(field => ({
        [field]: { contains: search, mode: 'insensitive' }
      }));
    }

    if (queryParams.dateFrom) {
      where[config.dateField] = { gte: new Date(queryParams.dateFrom) };
    }

    // Executa Queries
    const [data, total] = await Promise.all([
      model.findMany({
        where,
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: { [config.defaultOrderBy]: 'desc' }
      }),
      model.count({ where })
    ]);
    
    return { data, total, page, pageSize };
  }

  async createRecord(table: string, user: AuthenticatedUser, data: any) {
    const model = this.getModel(table);
    if (!model) throw new Error('Tabela não suportada');

    const companyId = user.role === 'SUPER_ADMIN_EVOLUTECH' ? data.company_id : user.companyId;
    if (!companyId) throw new Error('Company ID obrigatório');
    if (!this.checkAccess(user, companyId)) throw new Error('Acesso negado');

    // O Prisma ignora campos extras que não existem no schema, 
    // mas é bom limpar o payload se necessário.
    const payload = { ...data, companyId };
    delete payload.id; 

    return model.create({ data: payload });
  }
}