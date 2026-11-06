import { Router } from 'express';
import { getHealth } from '../controllers/health.js';
import authRoutes from './auth.js';
import officeRoutes from './offices.js';
import candidateRoutes from './candidates.js';
import comparisonRoutes from './comparisons.js';
import raceRoutes from './races.js';

const router = Router();

router.get('/health', getHealth);
router.use('/auth', authRoutes);
router.use('/offices', officeRoutes);
router.use('/candidates', candidateRoutes);
router.use('/comparisons', comparisonRoutes);
router.use('/races', raceRoutes);

export default router;
