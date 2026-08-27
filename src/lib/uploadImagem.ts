import { API_URL } from '@/config/api';

/**
 * Envia uma imagem para a API e devolve a URL publica para exibir.
 *
 * Substitui o storage do Supabase. O arquivo e convertido para data URL no
 * navegador e gravado no banco pelo backend; a URL devolvida ja aponta para
 * a rota publica que serve a imagem.
 */

export type FinalidadeImagem =
  | 'logo'
  | 'favicon'
  | 'login_cover'
  | 'course_cover'
  | 'course_media';

const LIMITE_PADRAO = 3 * 1024 * 1024;

const lerComoDataUrl = (arquivo: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Nao consegui ler o arquivo'));
    reader.readAsDataURL(arquivo);
  });

export async function uploadImagem(
  arquivo: File,
  finalidade: FinalidadeImagem,
  opcoes?: { companyId?: string; limiteBytes?: number }
): Promise<{ url: string; id: string }> {
  const limite = opcoes?.limiteBytes ?? LIMITE_PADRAO;
  if (arquivo.size > limite) {
    throw new Error(`A imagem deve ter no maximo ${(limite / 1024 / 1024).toFixed(1)} MB`);
  }
  if (!arquivo.type.startsWith('image/')) {
    throw new Error('Envie um arquivo de imagem');
  }

  const dataUrl = await lerComoDataUrl(arquivo);
  const token = localStorage.getItem('evolutech_token');

  const resposta = await fetch(`${API_URL}/company/media`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      data_url: dataUrl,
      file_name: arquivo.name,
      kind: finalidade,
      company_id: opcoes?.companyId,
    }),
  });

  if (!resposta.ok) {
    const erro = await resposta.json().catch(() => ({}));
    throw new Error(erro.error || 'Nao consegui enviar a imagem');
  }

  const dados = await resposta.json();
  // A API devolve caminho relativo; monta a URL absoluta para o <img>.
  const base = API_URL.replace(/\/api$/, '');
  return { url: `${base}${dados.url}`, id: dados.id };
}
