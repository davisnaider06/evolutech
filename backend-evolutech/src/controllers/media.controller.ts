import { Request, Response } from 'express';
import { AuthedRequest } from '../types';
import { mediaService, MediaServiceError } from '../services/media.service';

export class MediaController {
  private handleError(error: unknown, res: Response) {
    if (error instanceof MediaServiceError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    const message = error instanceof Error ? error.message : 'Erro interno';
    return res.status(500).json({ error: message });
  }

  async upload(req: AuthedRequest, res: Response) {
    try {
      const result = await mediaService.upload(req.user!, req.body || {});
      return res.status(201).json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async remove(req: AuthedRequest, res: Response) {
    try {
      const result = await mediaService.remover(req.user!, req.params.mediaId);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  /** Rota publica: serve a imagem para o navegador, com cache longo. */
  async serve(req: Request, res: Response) {
    try {
      const asset = await mediaService.buscarParaEntrega(req.params.mediaId);
      res.setHeader('Content-Type', asset.mimeType);
      res.setHeader('Content-Length', String(asset.sizeBytes));
      // O id nunca e reaproveitado, entao o conteudo e imutavel.
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(Buffer.from(asset.data));
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }
}
