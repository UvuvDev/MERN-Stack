import fs from 'node:fs';
import mongoose from 'mongoose';
import { Candidate, Office, Race } from '../models/index.js';

/**
 * The 2026 Senate map, generated from the public election pages and mapped to
 * imported bioguide IDs. A race is created even when a nominee has no federal
 * roll-call record; the API exposes that as `missingNominees` and
 * `comparable: false`, so the UI can explain the gap instead of hiding the race.
 *
 * Edit `races-2026.json` to add or correct races.
 */
const raceDataUrl = new URL('./races-2026.json', import.meta.url);
export const RACE_DEFINITIONS = JSON.parse(fs.readFileSync(raceDataUrl, 'utf8'));

export async function importRaces({ logger = console } = {}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('importRaces() requires an open MongoDB connection');
  }

  const results = [];

  for (const definition of RACE_DEFINITIONS) {
    const office = await Office.findOne({ slug: definition.officeSlug }).lean();
    if (!office) {
      logger?.warn?.(
        `[races] ${definition.slug}: office ${definition.officeSlug} not found. Import the state first.`
      );
      results.push({
        slug: definition.slug,
        status: 'missing-office',
        candidates: 0,
        missing: definition.missingNominees?.length ?? 0,
      });
      continue;
    }

    const bioguideIds = (definition.bioguideIds ?? []).map((id) => id.toUpperCase());
    const candidates = await Candidate.find({
      bioguideId: { $in: bioguideIds },
    })
      .select('_id bioguideId name')
      .lean();

    const byBioguide = new Map(
      candidates.map((candidate) => [String(candidate.bioguideId).toUpperCase(), candidate])
    );
    const ordered = bioguideIds
      .map((id) => byBioguide.get(id))
      .filter(Boolean);

    const race = await Race.findOneAndUpdate(
      { slug: definition.slug },
      {
        $set: {
          slug: definition.slug,
          name: definition.name,
          electionYear: definition.electionYear,
          electionDate: new Date(`${definition.electionDate}T00:00:00Z`),
          office: office._id,
          state: definition.state,
          district: definition.district ?? null,
          candidates: ordered.map((candidate) => candidate._id),
          missingNominees: (definition.missingNominees ?? []).map((nominee) => ({
            name: nominee.name,
            party: nominee.party,
            reason:
              nominee.reason ??
              'No federal roll-call record in the imported dataset.',
          })),
          description: definition.description,
          sourceUrl: definition.sourceUrl,
          isSample: false,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    const names = ordered.map((candidate) => candidate.name);
    results.push({
      slug: race.slug,
      status: 'upserted',
      candidates: names,
      missing: definition.missingNominees?.map((nominee) => nominee.name) ?? [],
      id: race._id,
    });
    logger?.info?.(
      `[races] ${race.slug}: ${names.length ? names.join(' vs ') : 'no matched records'}${
        definition.missingNominees?.length
          ? ` | no federal record: ${definition.missingNominees
              .map((nominee) => nominee.name)
              .join('; ')}`
          : ''
      }`
    );
  }

  return results;
}

export default importRaces;
