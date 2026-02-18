import { Router } from 'express';
import { CompanyController } from '../controllers/company.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();
const controller = new CompanyController();

router.use(authenticateToken);

// CRUD Genérico: /api/company/:table (ex: customers, products)
router.get('/:table', controller.list.bind(controller));
router.post('/:table', controller.create.bind(controller));
// TODO: Adicionar PUT/PATCH e DELETE seguindo a mesma lógica

export default router;