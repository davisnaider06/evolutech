import { Router, json, raw } from 'express';
import { PaymentController } from '../controllers/payment.controller';

const router = Router();
const controller = new PaymentController();

router.post(
  '/stripe/:companyId',
  raw({ type: 'application/json' }),
  controller.stripeWebhook.bind(controller)
);
router.post(
  '/mercadopago/:companyId',
  json(),
  controller.mercadoPagoWebhook.bind(controller)
);
router.post(
  '/pagbank/:companyId',
  json(),
  controller.pagBankWebhook.bind(controller)
);

export default router;
