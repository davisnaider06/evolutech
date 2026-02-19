const API_URL = 'http://localhost:3001/api/admin';

// Função auxiliar para montar os headers com o token
const getHeaders = () => {
  const token = localStorage.getItem('evolutech_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const adminService = {
  // --- MÓDULOS ---
  listarModulos: async (onlyActive = false) => {
    const response = await fetch(`${API_URL}/modulos?active=${onlyActive}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Erro ao buscar módulos');
    return response.json();
  },

  criarModulo: async (dados: any) => {
    const response = await fetch(`${API_URL}/modulos`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(dados),
    });
    if (!response.ok) throw new Error('Erro ao criar módulo');
    return response.json();
  },

  // --- SISTEMAS BASE (TEMPLATES) ---
  listarSistemasBase: async (onlyActive = false) => {
    const response = await fetch(`${API_URL}/sistemas-base?active=${onlyActive}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Erro ao buscar sistemas base');
    return response.json();
  },

  criarSistemaBase: async (dados: any) => {
    const response = await fetch(`${API_URL}/sistemas-base`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(dados),
    });
    if (!response.ok) throw new Error('Erro ao criar sistema base');
    return response.json();
  }
};