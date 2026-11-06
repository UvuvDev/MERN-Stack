import { Router } from 'express';
import { getRace, listRaces } from '../controllers/races.js';

const router = Router();

router.get('/', listRaces);
router.get('/:idOrSlug', getRace);

export default router;
