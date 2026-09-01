/**
 * Armazenamento de imagens no proprio banco.
 *
 * Substitui o storage do Supabase para o que o sistema realmente sobe:
 * logo, favicon, capa de login e capa de curso. Sao arquivos pequenos e
 * pouco numerosos, entao guardar no Postgres evita depender de mais um
 * servico externo.
 *
 * O upload chega como data URL (base64) porque e o formato que o navegador
 * produz sem esforco e cabe no corpo JSON que a API ja aceita.
 */
import { prisma } from '../db';
import { AuthenticatedUser } from '../types';

export class MediaServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'MediaServiceError';
    this.statusCode = statusCode;
  }
}

/** Tipos aceitos. SVG fica de fora: aceita script embutido. */
const TIPOS_PERMITIDOS = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

const FINALIDADES = new Set([
  'logo',
  'favicon',
  'login_cover',
  'course_cover',
  'course_media',
  // Foto do barbeiro, exibida na Equipe e na agenda.
  'professional_photo',
]);

/** 3 MB ja e generoso para logo; segura o banco de crescer sem controle. */
const TAMANHO_MAXIMO = Number(process.env.MEDIA_MAX_BYTES || 3 * 1024 * 1024);

export class MediaService {
  /**
   * Recebe uma data URL, valida e grava.
   * Devolve o caminho publico que a tela deve salvar no tema/curso.
   */
  async upload(
    user: AuthenticatedUser,
    payload: { data_url?: string; file_name?: string; kind?: string; company_id?: string }
  ) {
    const dataUrl = String(payload.data_url || '').trim();
    if (!dataUrl.startsWith('data:')) {
      throw new MediaServiceError('Envie a imagem como data URL (data:image/...;base64,...)', 400);
    }

    const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
    if (!match) throw new MediaServiceError('Formato de imagem invalido', 400);

    const mimeType = match[1].toLowerCase();
    if (!TIPOS_PERMITIDOS.has(mimeType)) {
      throw new MediaServiceError(
        `Tipo nao permitido (${mimeType}). Use PNG, JPG, WEBP, GIF ou ICO.`,
        400
      );
    }

    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0) throw new MediaServiceError('Arquivo vazio', 400);
    if (buffer.length > TAMANHO_MAXIMO) {
      const limiteMb = (TAMANHO_MAXIMO / 1024 / 1024).toFixed(1);
      throw new MediaServiceError(`Imagem acima do limite de ${limiteMb} MB`, 400);
    }

    const kind = String(payload.kind || 'logo').trim().toLowerCase();
    if (!FINALIDADES.has(kind)) {
      throw new MediaServiceError(`Finalidade invalida: ${kind}`, 400);
    }

    // Super admin pode subir para qualquer empresa; os demais so para a sua.
    const ehAdmin = ['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH'].includes(user.role);
    const companyId = ehAdmin
      ? String(payload.company_id || user.companyId || '').trim() || null
      : user.companyId || null;

    if (!ehAdmin && !companyId) {
      throw new MediaServiceError('Empresa nao identificada para o upload', 400);
    }
    if (companyId) {
      const empresa = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
      if (!empresa) throw new MediaServiceError('Empresa nao encontrada', 404);
    }

    const criado = await (prisma as any).mediaAsset.create({
      data: {
        companyId,
        kind,
        fileName: String(payload.file_name || 'imagem').slice(0, 180),
        mimeType,
        sizeBytes: buffer.length,
        data: buffer,
        createdBy: user.id,
      },
      select: { id: true, kind: true, mimeType: true, sizeBytes: true, createdAt: true },
    });

    return {
      id: criado.id,
      // Caminho publico: e isto que vai salvo no tema e nas telas.
      url: `/api/public/media/${criado.id}`,
      kind: criado.kind,
      mime_type: criado.mimeType,
      size_bytes: criado.sizeBytes,
      created_at: criado.createdAt,
    };
  }

  /** Busca o binario para a rota publica servir. */
  async buscarParaEntrega(id: string) {
    const asset = await (prisma as any).mediaAsset.findUnique({
      where: { id: String(id || '').trim() },
      select: { data: true, mimeType: true, sizeBytes: true },
    });
    if (!asset) throw new MediaServiceError('Imagem nao encontrada', 404);
    return asset;
  }

  /** Remove uma imagem. Só o dono da empresa ou um admin da plataforma. */
  async remover(user: AuthenticatedUser, id: string) {
    const asset = await (prisma as any).mediaAsset.findUnique({
      where: { id: String(id || '').trim() },
      select: { id: true, companyId: true },
    });
    if (!asset) throw new MediaServiceError('Imagem nao encontrada', 404);

    const ehAdmin = ['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH'].includes(user.role);
    if (!ehAdmin && asset.companyId !== user.companyId) {
      throw new MediaServiceError('Acesso negado', 403);
    }

    await (prisma as any).mediaAsset.delete({ where: { id: asset.id } });
    return { success: true, id: asset.id };
  }
}

export const mediaService = new MediaService();
