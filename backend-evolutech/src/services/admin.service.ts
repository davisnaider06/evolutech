import { pool } from '../db';

export class AdminService {
  async listModulos(onlyActive: boolean) {
    const query = onlyActive
      ? 'SELECT * FROM modulos WHERE status = $1 ORDER BY is_core DESC, nome ASC'
      : 'SELECT * FROM modulos ORDER BY is_core DESC, nome ASC';
    const params = onlyActive ? ['active'] : [];
    const { rows } = await pool.query(query, params);
    return rows;
  }

  async createModulo(data: any) {
    const { nome, descricao, codigo, icone, preco_mensal, is_core, status } = data;
    const { rows } = await pool.query(
      `INSERT INTO modulos (nome, descricao, codigo, icone, preco_mensal, is_core, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [nome, descricao, codigo, icone, preco_mensal || 0, is_core || false, status || 'active']
    );
    return rows[0];
  }

  async listSistemasBase(onlyActive: boolean) {
    const query = onlyActive
      ? 'SELECT * FROM sistema_base WHERE is_active = $1 ORDER BY created_at DESC'
      : 'SELECT * FROM sistema_base ORDER BY created_at DESC';
    const params = onlyActive ? [true] : [];
    const { rows } = await pool.query(query, params);
    return rows;
  }

  async createSistemaBase(data: any) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const { rows } = await client.query(
        `INSERT INTO sistema_base (nome, descricao, categoria, icone)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [data.nome, data.descricao, data.categoria, data.icone]
      );
      const sistema = rows[0];

      if (data.modulosIds && Array.isArray(data.modulosIds)) {
        for (const modId of data.modulosIds) {
          await client.query(
            `INSERT INTO sistema_base_modulos (sistema_base_id, modulo_id) VALUES ($1, $2)`,
            [sistema.id, modId]
          );
        }
      }

      await client.query('COMMIT');
      return sistema;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}