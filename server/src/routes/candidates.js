import { Router } from 'express';
import {
  listCandidates,
  getCandidate,
  getCandidateVotes,
} from '../controllers/candidates.js';
import { listCandidatesQuerySchema } from '../validators/candidates.js';

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

router.get('/', validateQuery(listCandidatesQuerySchema), listCandidates);
router.get('/:id', getCandidate);
router.get('/:id/votes', getCandidateVotes);

export default router;
