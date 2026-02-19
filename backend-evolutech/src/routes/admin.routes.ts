import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticateToken, requireRoles } from '../middlewares/auth.middleware';

const router = Router();
const controller = new AdminController();

router.use(authenticateToken);
router.use(requireRoles(['SUPER_ADMIN_EVOLUTECH']));

router.get('/modulos', controller.listModulos.bind(controller));
router.post('/modulos', controller.createModulo.bind(controller));
router.patch('/modulos/:moduloId', controller.updateModulo.bind(controller));
router.delete('/modulos/:moduloId', controller.deleteModulo.bind(controller));

router.get('/sistemas-base', controller.listSistemasBase.bind(controller));
router.post('/sistemas-base', controller.createSistemaBase.bind(controller));
router.patch('/sistemas-base/:sistemaId', controller.updateSistemaBase.bind(controller));
router.delete('/sistemas-base/:sistemaId', controller.deleteSistemaBase.bind(controller));
router.get('/sistemas-base/:sistemaId/modulos', controller.listSistemaBaseModulos.bind(controller));
router.put('/sistemas-base/:sistemaId/modulos', controller.replaceSistemaBaseModulos.bind(controller));

router.get('/tenants', controller.listTenants.bind(controller));
router.patch('/tenants/:tenantId', controller.updateTenant.bind(controller));
router.delete('/tenants/:tenantId', controller.deleteTenant.bind(controller));

export default router;
