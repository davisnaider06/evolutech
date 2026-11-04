import { Router } from 'express';
import { CompanyController } from '../controllers/company.controller';
import { MediaController } from '../controllers/media.controller';
import { rateLimit } from '../middlewares/security.middleware';

// Marcar pelo link nao pede login. Sem um limite proprio, um script enchia a
// agenda da barbearia de horarios falsos (o limite geral da API e de 600/min).
// 8 marcacoes em 10 minutos pelo mesmo IP cobre uma familia inteira marcando.
const limiteDeAgendamentoPublico = rateLimit({
  windowMs: 10 * 60_000,
  max: 8,
  scope: 'agendamento-publico',
  message: 'Muitos agendamentos seguidos deste aparelho. Aguarde alguns minutos ou fale com a barbearia.',
});

const router = Router();
const companyController = new CompanyController();
const mediaController = new MediaController();

// Entrega de imagens (logo, favicon, capa). Publica de proposito: e o que
// a tag <img> do navegador consome, inclusive na tela de login.
router.get('/media/:mediaId', mediaController.serve.bind(mediaController));

router.get('/booking/:slug', companyController.getPublicBookingCompany.bind(companyController));
router.get('/booking/:slug/options', companyController.getPublicBookingOptions.bind(companyController));
router.get('/booking/:slug/appointments', companyController.listPublicAppointmentsByDate.bind(companyController));
router.get('/booking/:slug/slots', companyController.listPublicAvailableSlots.bind(companyController));
router.post(
  '/booking/:slug/appointments',
  limiteDeAgendamentoPublico,
  companyController.createPublicAppointment.bind(companyController)
);

export default router;
