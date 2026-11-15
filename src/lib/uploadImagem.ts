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
  | 'course_media'
  | 'professional_photo';

const LIMITE_PADRAO = 3 * 1024 * 1024;

const lerComoDataUrl = (arquivo: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não consegui ler o arquivo'));
    reader.readAsDataURL(arquivo);
  });

/**
 * Lado maior, em px, que cada uso realmente precisa. Foto de celular chega
 * com 4000 px e 3 MB e era guardada e servida assim para o cliente.
 */
const LADO_MAXIMO: Record<FinalidadeImagem, number> = {
  logo: 512,
  favicon: 0, // nao mexe: o navegador precisa do .ico/.png como veio
  professional_photo: 800,
  login_cover: 1600,
  course_cover: 1600,
  course_media: 1600,
};

/**
 * Redimensiona e converte para WebP no proprio navegador (canvas, sem
 * biblioteca). Devolve o arquivo original quando nao compensa: favicon, GIF
 * (perderia a animacao), navegador que nao exporta WebP, ou resultado maior
 * que o original. WebP guarda transparencia, entao logo em PNG continua com
 * fundo transparente.
 */
async function otimizarImagem(arquivo: File, finalidade: FinalidadeImagem): Promise<File> {
  const lado = LADO_MAXIMO[finalidade];
  if (!lado || arquivo.type === 'image/gif' || typeof createImageBitmap !== 'function') return arquivo;
  try {
    const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
    const largura = Math.max(1, Math.round(bitmap.width * escala));
    const altura = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const contexto = canvas.getContext('2d');
    if (!contexto) return arquivo;
    contexto.drawImage(bitmap, 0, 0, largura, altura);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((pronto) => canvas.toBlob(pronto, 'image/webp', 0.82));
    // Sem suporte a WebP o canvas devolve PNG: ai fica o original.
    if (!blob || blob.type !== 'image/webp' || blob.size >= arquivo.size) return arquivo;
    const nome = arquivo.name.replace(/\.[^.]+$/, '') + '.webp';
    return new File([blob], nome, { type: 'image/webp' });
  } catch (_erro) {
    return arquivo;
  }
}

export async function uploadImagem(
  arquivo: File,
  finalidade: FinalidadeImagem,
  opcoes?: { companyId?: string; limiteBytes?: number }
): Promise<{ url: string; id: string }> {
  const limite = opcoes?.limiteBytes ?? LIMITE_PADRAO;
  if (!arquivo.type.startsWith('image/')) {
    throw new Error('Envie um arquivo de imagem');
  }
  // O limite vale para o que sobe, depois de otimizar: a foto de 5 MB do
  // celular vira algumas centenas de KB e passa.
  arquivo = await otimizarImagem(arquivo, finalidade);
  if (arquivo.size > limite) {
    throw new Error(`A imagem deve ter no máximo ${(limite / 1024 / 1024).toFixed(1)} MB`);
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
    throw new Error(erro.error || 'Não consegui enviar a imagem');
  }

  const dados = await resposta.json();
  // A API devolve caminho relativo; monta a URL absoluta para o <img>.
  const base = API_URL.replace(/\/api$/, '');
  return { url: `${base}${dados.url}`, id: dados.id };
}
