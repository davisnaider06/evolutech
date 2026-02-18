import { pool } from '../db';
import { AuthenticatedUser } from '../types';
import { TABLE_CONFIG } from '../config/tableConfig';

export class CompanyService {
  private checkAccess(user: AuthenticatedUser, targetCompanyId: string) {
    if (user.role === 'SUPER_ADMIN_EVOLUTECH') return true;
    return user.companyId === targetCompanyId;
  }

  private safeIdentifier(value: string) {
    return /^[a-z_][a-z0-9_]*$/i.test(value);
  }

  async listTableData(table: string, user: AuthenticatedUser, queryParams: any) {
    const config = TABLE_CONFIG[table];
    if (!config) throw new Error('Tabela não suportada');

    const companyId = user.role === 'SUPER_ADMIN_EVOLUTECH' 
        ? (queryParams.company_id || user.companyId) 
        : user.companyId;

    if (!companyId) throw new Error('Company ID obrigatório');
    if (!this.checkAccess(user, companyId)) throw new Error('Acesso negado à empresa');

    const page = Number(queryParams.page || 1);
    const pageSize = Number(queryParams.pageSize || 10);
    const offset = (page - 1) * pageSize;
    const search = (queryParams.search as string)?.trim();

    const values: any[] = [companyId];
    const whereParts: string[] = ['company_id = $1'];

    // Busca Textual
    if (search && config.searchFields.length > 0) {
      const searchParts: string[] = [];
      for (const field of config.searchFields) {
        values.push(`%${search}%`);
        searchParts.push(`${field} ILIKE $${values.length}`);
      }
      whereParts.push(`(${searchParts.join(' OR ')})`);
    }

    // Filtro de Data (Exemplo)
    if (queryParams.dateFrom) {
        values.push(queryParams.dateFrom);
        whereParts.push(`${config.dateField} >= $${values.length}`);
    }

    const whereClause = whereParts.join(' AND ');

    // Count
    const countQuery = `SELECT COUNT(*)::int as total FROM ${table} WHERE ${whereClause}`;
    const { rows: countRows } = await pool.query(countQuery, values);
    const total = countRows[0]?.total || 0;

    // Data
    values.push(pageSize);
    values.push(offset);
    const dataQuery = `
      SELECT * FROM ${table} 
      WHERE ${whereClause} 
      ORDER BY ${config.defaultOrderBy} DESC 
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `;
    
    const { rows } = await pool.query(dataQuery, values);
    return { data: rows, total, page, pageSize };
  }

  async createRecord(table: string, user: AuthenticatedUser, data: any) {
    if (!TABLE_CONFIG[table]) throw new Error('Tabela não suportada');
    
    const companyId = user.role === 'SUPER_ADMIN_EVOLUTECH' 
        ? (data.company_id || user.companyId) 
        : user.companyId;

    if (!companyId) throw new Error('Company ID necessário');
    if (!this.checkAccess(user, companyId)) throw new Error('Acesso negado');

    const payload = { ...data, company_id: companyId };
    delete payload.id; // ID é gerado pelo banco

    const columns = Object.keys(payload).filter(this.safeIdentifier);
    const values = columns.map(c => payload[c]);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const { rows } = await pool.query(sql, values);
    
    return rows[0];
  }
}