import { Office } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listOffices = asyncHandler(async (req, res) => {
  const offices = await Office.find({})
    .sort({ name: 1 })
    .select('slug name level state district description')
    .lean();

  res.json({
    offices: offices.map((office) => ({
      id: office._id,
      slug: office.slug,
      name: office.name,
      level: office.level,
      state: office.state ?? null,
      district: office.district ?? null,
      description: office.description ?? '',
    })),
  });
});

export default { listOffices };
