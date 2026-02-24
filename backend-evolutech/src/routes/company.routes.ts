import { Router } from 'express';
import { CompanyController } from '../controllers/company.controller';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();
const companyController = new CompanyController();
const dashboardController = new DashboardController();

router.use(authenticateToken);

router.get('/financeiro/overview', companyController.getFinancialOverview.bind(companyController));
router.get('/reports/overview', companyController.getReportsOverview.bind(companyController));
router.get('/dashboard/metrics', dashboardController.getMetrics.bind(dashboardController));
router.get('/appointments/availability', companyController.listAppointmentAvailability.bind(companyController));
router.put('/appointments/availability/:professionalId', companyController.saveAppointmentAvailability.bind(companyController));
router.get('/tasks/my', companyController.listMyTasks.bind(companyController));
router.post('/tasks/my', companyController.createMyTask.bind(companyController));
router.patch('/tasks/my/:taskId', companyController.updateMyTask.bind(companyController));
router.delete('/tasks/my/:taskId', companyController.deleteMyTask.bind(companyController));
router.post('/tasks/my/:taskId/move', companyController.moveMyTask.bind(companyController));
router.get('/team/members', companyController.listTeamMembers.bind(companyController));
router.post('/team/members', companyController.createTeamMember.bind(companyController));
router.get('/pdv/products', companyController.listPdvProducts.bind(companyController));
router.get('/pdv/orders', companyController.listPdvOrders.bind(companyController));
router.post('/pdv/checkout', companyController.checkoutPdv.bind(companyController));
router.post('/pdv/orders/:orderId/confirm-pix', companyController.confirmPixPayment.bind(companyController));
router.get('/billing/charges', companyController.listBillingCharges.bind(companyController));
router.post('/billing/charges', companyController.createBillingCharge.bind(companyController));
router.get('/gateways', companyController.listMyPaymentGateways.bind(companyController));
router.post('/gateways/connect', companyController.connectMyPaymentGateway.bind(companyController));
router.post('/gateways/:gatewayId/activate', companyController.activateMyPaymentGateway.bind(companyController));
router.delete('/gateways/:gatewayId', companyController.deleteMyPaymentGateway.bind(companyController));
router.post('/products/import', companyController.importProducts.bind(companyController));

router.get('/:table', companyController.list.bind(companyController));
router.post('/:table', companyController.create.bind(companyController));
router.put('/:table/:id', companyController.update.bind(companyController));
router.delete('/:table/:id', companyController.remove.bind(companyController));

export default router;
