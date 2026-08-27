import { Router } from 'express';
import { CompanyController } from '../controllers/company.controller';
import { MediaController } from '../controllers/media.controller';

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
router.post('/booking/:slug/appointments', companyController.createPublicAppointment.bind(companyController));

export default router;
