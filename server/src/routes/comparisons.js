import { Router } from 'express';
import {
  createComparison,
  listComparisons,
  getComparison,
} from '../controllers/comparisons.js';
import {
  createComparisonSchema,
  paginationQuerySchema,
} from '../validators/comparisons.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { compareLimiter } from '../middleware/rateLimit.js';

function validateQuery(schema) {
  return function queryValidator(req, res, next) {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        error: {
          message: 'Invalid query parameters.',
          details: result.error.issues,
        },
      });
      return;
    }
    req.query = result.data;
    next();
  };
}

const router = Router();

router.use(requireAuth);

router.post('/', compareLimiter, validate(createComparisonSchema), createComparison);
router.get('/', validateQuery(paginationQuerySchema), listComparisons);
router.get('/:id', getComparison);

export default router;
