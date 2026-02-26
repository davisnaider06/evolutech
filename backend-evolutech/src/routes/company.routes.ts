import { Router } from 'express';
import { CompanyController } from '../controllers/company.controller';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();
const companyController = new CompanyController();
const dashboardController = new DashboardController();
const COMPANY_PERF_DEBUG = process.env.COMPANY_PERF_DEBUG === 'true';
const COMPANY_SLOW_MS = Number(process.env.COMPANY_SLOW_MS || 300);

router.use(authenticateToken);
if (COMPANY_PERF_DEBUG) {
  router.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs > COMPANY_SLOW_MS) {
        console.warn(`[company.routes] slow ${elapsedMs}ms ${req.method} ${req.originalUrl}`);
      }
    });
    next();
  });
}

router.get('/financeiro/overview', companyController.getFinancialOverview.bind(companyController));
router.get('/reports/overview', companyController.getReportsOverview.bind(companyController));
router.get('/commissions/profiles', companyController.listCommissionProfiles.bind(companyController));
router.put('/commissions/profiles/:professionalId', companyController.upsertCommissionProfile.bind(companyController));
router.post('/commissions/adjustments', companyController.createCommissionAdjustment.bind(companyController));
router.get('/commissions/overview', companyController.getCommissionsOverview.bind(companyController));
router.get('/commissions/export', companyController.exportCommissionsExcel.bind(companyController));
router.get('/commissions/payouts', companyController.listCommissionPayouts.bind(companyController));
router.put('/commissions/payouts', companyController.upsertCommissionPayout.bind(companyController));
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
router.get('/customers/:customerId/history', companyController.getCustomerHistory.bind(companyController));
router.get('/loyalty/settings', companyController.getLoyaltySettings.bind(companyController));
router.put('/loyalty/settings', companyController.updateLoyaltySettings.bind(companyController));
router.get('/loyalty/customers/:customerId', companyController.getCustomerLoyaltyProfile.bind(companyController));
router.get('/subscriptions/plans', companyController.listSubscriptionPlans.bind(companyController));
router.post('/subscriptions/plans', companyController.upsertSubscriptionPlan.bind(companyController));
router.put('/subscriptions/plans', companyController.upsertSubscriptionPlan.bind(companyController));
router.get('/subscriptions/customers', companyController.listCustomerSubscriptions.bind(companyController));
router.post('/subscriptions/customers', companyController.upsertCustomerSubscription.bind(companyController));
router.put('/subscriptions/customers', companyController.upsertCustomerSubscription.bind(companyController));
router.get('/subscriptions/usage', companyController.listSubscriptionUsage.bind(companyController));
router.post('/pdv/loyalty/preview', companyController.previewPdvLoyalty.bind(companyController));
router.post('/pdv/preview', companyController.previewPdvCheckout.bind(companyController));
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
