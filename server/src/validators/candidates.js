import { z } from 'zod';

export const listCandidatesQuerySchema = z.object({
  office: z.string().trim().min(1).optional(),
  search: z.string().trim().max(100, 'Search must be at most 100 characters.').optional(),
  limit: z.coerce
    .number()
    .int('Limit must be a whole number.')
    .min(1, 'Limit must be at least 1.')
    .max(100, 'Limit must be at most 100.')
    .default(50),
});

export const candidateIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Candidate id is required.'),
});

export default {
  listCandidatesQuerySchema,
  candidateIdParamSchema,
};
