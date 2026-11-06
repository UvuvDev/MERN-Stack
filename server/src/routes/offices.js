import { Router } from 'express';
import { listOffices } from '../controllers/offices.js';

const router = Router();

router.get('/', listOffices);

export default router;
