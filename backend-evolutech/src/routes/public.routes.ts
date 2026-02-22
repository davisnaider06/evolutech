import { Router } from 'express';
import { CompanyController } from '../controllers/company.controller';

const router = Router();
const companyController = new CompanyController();

router.get('/booking/:slug', companyController.getPublicBookingCompany.bind(companyController));
router.get('/booking/:slug/appointments', companyController.listPublicAppointmentsByDate.bind(companyController));
router.post('/booking/:slug/appointments', companyController.createPublicAppointment.bind(companyController));

export default router;
