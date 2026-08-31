/**
 * Inscricao de aparelhos para push.
 *
 * Rotas de equipe: quem chama ja passou pelo authenticateToken, entao a
 * inscricao sempre pertence ao usuario do token — nunca ao id que vier no
 * corpo. Deixar o cliente escolher o dono da inscricao seria entregar o push
 * de um barbeiro para outro.
 */
import { Response } from 'express';
import { AuthedRequest } from '../types';
import { pushService } from '../services/push.service';

export class PushController {
  /** A chave publica VAPID, que o navegador precisa antes de se inscrever. */
  async getPublicKey(_req: AuthedRequest, res: Response) {
    const chave = pushService.chavePublica;
    if (!chave) {
      return res.status(503).json({ error: 'Push nao configurado neste ambiente' });
    }
    return res.json({ public_key: chave });
  }

  async subscribe(req: AuthedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: 'Nao autenticado' });

      await pushService.salvarInscricao({
        userId: user.id,
        companyId: user.companyId || null,
        subscription: req.body?.subscription || req.body || {},
        userAgent: req.headers['user-agent'] || null,
      });

      return res.status(201).json({ subscribed: true });
    } catch (error: any) {
      return res.status(400).json({ error: String(error?.message || 'Inscricao invalida') });
    }
  }

  async unsubscribe(req: AuthedRequest, res: Response) {
    try {
      const endpoint = String(req.body?.endpoint || '').trim();
      const result = await pushService.removerInscricao(endpoint);
      return res.json({ unsubscribed: true, ...result });
    } catch (error: any) {
      return res.status(400).json({ error: String(error?.message || 'Endpoint invalido') });
    }
  }

  /** Envia um aviso de teste para os proprios aparelhos de quem chamou. */
  async sendTest(req: AuthedRequest, res: Response) {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Nao autenticado' });

    const resultado = await pushService.enviarParaUsuarios([user.id], {
      title: 'Notificacoes ligadas',
      body: 'E assim que os avisos da barbearia vao chegar neste aparelho.',
      url: '/empresa/app',
      tag: 'teste',
    });

    return res.json(resultado);
  }
}
