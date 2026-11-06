import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { candidatesApi, comparisonsApi, officesApi, racesApi } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useDocumentTitle } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';
import Button from '../components/Button';
import CandidateAvatar from '../components/CandidateAvatar';
import SampleDataBanner from '../components/SampleDataBanner';
import Select from '../components/Select';
import { SkeletonGroup, Skeleton } from '../components/Spinner';

function candidateId(candidate) {
  return (candidate && (candidate._id || candidate.id)) || '';
}

function officeKeys(office) {
  return [office && office._id, office && office.id, office && office.slug]
    .filter(Boolean)
    .map(String);
}

function belongsToOffice(candidate, keys) {
  const value = candidate && candidate.office;
  if (!value) return true;
  const reference =
    typeof value === 'string' ? value : value._id || value.id || value.slug || '';
  if (!reference) return true;
  return keys.includes(String(reference));
}

export default function Home() {
  useDocumentTitle('Compare voting records');
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedOffice = searchParams.get('office') || '';
  const requestedRace = searchParams.get('race') || '';

  const [offices, setOffices] = useState([]);
  const [officesLoading, setOfficesLoading] = useState(true);
  const [officesError, setOfficesError] = useState('');
  const [races, setRaces] = useState([]);
  const [racesLoading, setRacesLoading] = useState(true);
  const [racesError, setRacesError] = useState('');
  const [raceSlug, setRaceSlug] = useState('');
  const [officeSlug, setOfficeSlug] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState('');
  const [candidateAId, setCandidateAId] = useState('');
  const [candidateBId, setCandidateBId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setOfficesLoading(true);
    setOfficesError('');

    officesApi
      .list({ signal: controller.signal })
      .then((data) => {
        if (!active) return;
        const list = data && Array.isArray(data.offices) ? data.offices : [];
        setOffices(list);
        if (requestedOffice) {
          const match = list.find((office) => {
            const keys = officeKeys(office);
            return (
              (office && office.slug) === requestedOffice ||
              keys.includes(String(requestedOffice))
            );
          });
          if (match) {
            setOfficeSlug(match.slug || match._id || match.id || '');
          }
        }
      })
      .catch((error) => {
        if (!active || (error && error.name === 'AbortError')) return;
        setOfficesError(
          errorMessage(error, 'Could not load the list of offices. Please try again.')
        );
      })
      .finally(() => {
        if (active) setOfficesLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [requestedOffice]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setRacesLoading(true);
    setRacesError('');

    racesApi
      .list({ signal: controller.signal })
      .then((data) => {
        if (!active) return;
        const list = data && Array.isArray(data.races) ? data.races : [];
        setRaces(list);
        if (requestedRace) {
          const match = list.find((race) => race.slug === requestedRace);
          if (match) {
            setRaceSlug(match.slug);
            const raceOffice = match.office || {};
            setOfficeSlug(raceOffice.slug || raceOffice._id || raceOffice.id || '');
          }
        }
      })
      .catch((error) => {
        if (!active || (error && error.name === 'AbortError')) return;
        setRacesError(
          errorMessage(error, 'Could not load the race list. You can still build a comparison manually.')
        );
      })
      .finally(() => {
        if (active) setRacesLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [requestedRace]);

  useEffect(() => {
    if (!officeSlug) {
      setCandidates([]);
      setCandidatesLoading(false);
      setCandidatesError('');
      return undefined;
    }

    let active = true;
    const controller = new AbortController();
    setCandidatesLoading(true);
    setCandidatesError('');
    setCandidateAId('');
    setCandidateBId('');
    setFormError(null);

    candidatesApi
      .list({ office: officeSlug, limit: 100, signal: controller.signal })
      .then((data) => {
        if (!active) return;
        const list = data && Array.isArray(data.candidates) ? data.candidates : [];
        setCandidates(list);
      })
      .catch((error) => {
        if (!active || (error && error.name === 'AbortError')) return;
        setCandidatesError(
          errorMessage(error, 'Could not load candidates for this office.')
        );
      })
      .finally(() => {
        if (active) setCandidatesLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [officeSlug]);

  const office = useMemo(
    () =>
      offices.find((entry) => {
        const keys = officeKeys(entry);
        return (entry && entry.slug) === officeSlug || keys.includes(String(officeSlug));
      }) || null,
    [offices, officeSlug]
  );

  const selectedRace = useMemo(
    () => races.find((race) => race.slug === raceSlug) || null,
    [races, raceSlug]
  );

  const keys = useMemo(() => officeKeys(office), [office]);
  const raceIsReady = Boolean(
    selectedRace &&
      selectedRace.comparable !== false &&
      (selectedRace.candidates || []).length >= 2
  );

  const officeCandidates = useMemo(() => {
    if (!office) return candidates;
    return candidates.filter((candidate) => belongsToOffice(candidate, keys));
  }, [candidates, office, keys]);

  useEffect(() => {
    if (!selectedRace) return;
    const ids = (selectedRace.candidates || []).map(candidateId).filter(Boolean);
    if (ids.length < 2) {
      setCandidateAId('');
      setCandidateBId('');
      return;
    }
    setCandidateAId(ids[0]);
    setCandidateBId(ids[1]);
  }, [selectedRace]);

  const candidatePool = raceIsReady ? selectedRace.candidates : officeCandidates;
  const selectedA = candidatePool.find((candidate) => candidateId(candidate) === candidateAId) || null;
  const selectedB = candidatePool.find((candidate) => candidateId(candidate) === candidateBId) || null;
  const pairIsValid = Boolean(candidateAId && candidateBId && candidateAId !== candidateBId);
  const canCompare = Boolean(officeSlug && pairIsValid && !candidatesLoading && !submitting);
  const showSampleBanner =
    (office && office.isSample === true) ||
    candidatePool.some((candidate) => candidate && candidate.isSample === true);

  function handleRaceChange(event) {
    const slug = event.target.value;
    setRaceSlug(slug);
    setFormError(null);
    const race = races.find((entry) => entry.slug === slug);
    if (!race) {
      setOfficeSlug('');
      setCandidateAId('');
      setCandidateBId('');
      return;
    }
    const raceOffice = race.office || {};
    setOfficeSlug(raceOffice.slug || raceOffice._id || raceOffice.id || '');
  }

  function clearRace() {
    setRaceSlug('');
    setOfficeSlug('');
    setCandidateAId('');
    setCandidateBId('');
  }

  function handleManualOfficeChange(event) {
    setRaceSlug('');
    setOfficeSlug(event.target.value);
  }

  function handleManualCandidateA(event) {
    setRaceSlug('');
    setCandidateAId(event.target.value);
  }

  function handleManualCandidateB(event) {
    setRaceSlug('');
    setCandidateBId(event.target.value);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);

    if (!pairIsValid) {
      setFormError(new Error('Choose two different candidates for the same office.'));
      return;
    }

    if (!user) {
      navigate('/login?next=%2F', {
        state: { notice: 'Sign in to run and save your comparison. It only takes a moment.' },
      });
      return;
    }

    setSubmitting(true);
    try {
      const data = await comparisonsApi.create({
        candidateAId,
        candidateBId,
        raceId: selectedRace ? selectedRace.id : undefined,
      });
      const comparison = data && data.comparison ? data.comparison : null;
      const id =
        (comparison && (comparison._id || comparison.id)) ||
        (data && (data._id || data.id));
      if (!id) {
        throw new Error('The comparison was created but no comparison id was returned.');
      }
      navigate(`/compare/${id}`);
    } catch (error) {
      if (error && error.status === 401) {
        navigate('/login?next=%2F', {
          replace: true,
          state: { notice: 'Your session expired. Sign in to run the comparison.' },
        });
        return;
      }
      setFormError(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className="hero shell" aria-labelledby="home-heading">
        <div className="hero-copy">
          <p className="eyebrow">A civic record, not a campaign ad</p>
          <h1 id="home-heading">
            Compare the record,{' '}
            <br />
            not the rhetoric.
          </h1>
          <p className="lede">
            Pick a 2026 race, or any two candidates for the same office. Three independent AI models
            read only their roll-call votes on bills — never platforms, ads, speeches, or party messaging.
          </p>
          <div className="hero-actions">
            <a className="btn btn--primary" href="#builder">
              Build a comparison
            </a>
            <Link className="btn btn--outline" to="/about">
              How the panel works
            </Link>
          </div>
          <p className="hero-note">
            Public records in. Three readings out. You decide what the differences mean.
          </p>
        </div>

        <aside className="hero-panel" aria-labelledby="hero-panel-heading">
          <p className="eyebrow">What the panel receives</p>
          <h2 id="hero-panel-heading">The record, and nothing else</h2>
          <ul className="hero-facts">
            <li>
              <span className="hero-fact__num">01</span>
              <span>
                <strong>Bill text.</strong> Number, title, neutral summary, and topic.
              </span>
            </li>
            <li>
              <span className="hero-fact__num">02</span>
              <span>
                <strong>Recorded positions.</strong> Yes, no, abstain, or absent.
              </span>
            </li>
            <li>
              <span className="hero-fact__num">03</span>
              <span>
                <strong>No rhetoric.</strong> Bios, slogans, endorsements, and platforms stay out.
              </span>
            </li>
          </ul>
        </aside>
      </section>

      <section className="builder-section shell" id="builder" aria-labelledby="builder-heading">
        <div className="builder-card">
          <div className="builder-intro">
            <p className="eyebrow eyebrow--light">Comparison builder</p>
            <h2 id="builder-heading">Two records. One race.</h2>
            <p>
              Choose a 2026 race, or an office manually, then pair two candidates. The comparison is
              saved to your account so you can return to the briefing.
            </p>
            <ol className="builder-steps">
              <li>Select a race (or an office manually).</li>
              <li>Pick two different candidates.</li>
              <li>Run the three-model panel.</li>
            </ol>
            <p className="builder-fineprint">
              You must be signed in to run a comparison. Individual candidate profiles and vote
              histories stay public.
            </p>
          </div>

          <form className="builder-form" onSubmit={handleSubmit}>
            {racesLoading || races.length > 0 || racesError ? (
              <>
                <Select
                  id="race"
                  label="2026 race"
                  value={raceSlug}
                  onChange={handleRaceChange}
                  disabled={racesLoading}
                  hint={
                    selectedRace
                      ? 'Both candidates are preselected. Changing the office or a candidate below removes the race link.'
                      : 'All 35 Senate races are registered. Races marked incomplete have a nominee with no federal voting record; every state is still available in the office picker below.'
                  }
                >
                  <option value="">
                    {racesLoading ? 'Loading races…' : 'Choose a race (or build manually)…'}
                  </option>
                  {races.map((race) => {
                    const names = (race.candidates || [])
                      .map((candidate) => candidate.name)
                      .filter(Boolean)
                      .join(' vs. ');
                    return (
                      <option key={race.slug} value={race.slug}>
                        {race.name}
                        {names ? ` — ${names}` : ''}
                        {race.comparable === false ? ' (records incomplete)' : ''}
                      </option>
                    );
                  })}
                </Select>

                {racesError ? (
                  <Alert variant="error" title="Races unavailable">
                    <p>{racesError}</p>
                  </Alert>
                ) : null}

                {selectedRace ? (
                  <div className="race-note" aria-live="polite">
                    <p className="eyebrow">
                      Race briefing
                      {selectedRace.comparable === false ? ' · records incomplete' : ' · ready'}
                    </p>
                    <p className="race-note__name">{selectedRace.name}</p>
                    {selectedRace.description ? (
                      <p className="race-note__desc">{selectedRace.description}</p>
                    ) : null}
                    <ul className="race-note__candidates">
                      {(selectedRace.candidates || []).map((candidate) => (
                        <li key={candidate.id || candidate.slug || candidate.name}>
                          <strong>{candidate.name}</strong>
                          {candidate.party ? ` — ${candidate.party}` : ''}
                          {typeof candidate.voteCount === 'number'
                            ? ` · ${candidate.voteCount} recorded votes`
                            : ''}
                        </li>
                      ))}
                      {(selectedRace.missingNominees || []).map((nominee) => (
                        <li className="race-note__missing" key={`missing-${nominee.name}`}>
                          <strong>{nominee.name}</strong>
                          {nominee.party ? ` — ${nominee.party}` : ''} · no federal voting
                          record in this dataset
                        </li>
                      ))}
                    </ul>
                    {selectedRace.comparable === false ? (
                      <p className="race-note__warning">
                        A record-only comparison is not available for this race yet. You can still
                        compare the state&apos;s current senators by choosing candidates below.
                      </p>
                    ) : (
                      <p className="race-note__ready">
                        Both nominees have federal roll-call records; the comparison is ready.
                      </p>
                    )}
                    <button
                      type="button"
                      className="text-link race-note__clear"
                      onClick={clearRace}
                    >
                      Choose candidates manually
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}

            {!raceIsReady ? (
              <>
            <Select
              id="office"
              label="Office"
              value={officeSlug}
              onChange={handleManualOfficeChange}
              disabled={officesLoading}
              hint={
                officesLoading
                  ? 'Loading offices…'
                  : 'All candidates in the next step are filtered to this office.'
              }
              required
            >
              <option value="">{officesLoading ? 'Loading offices…' : 'Select an office…'}</option>
              {offices.map((entry) => {
                const value = entry.slug || entry._id || entry.id;
                return (
                  <option key={value} value={value}>
                    {entry.name}
                    {entry.level ? ` — ${entry.level}` : ''}
                  </option>
                );
              })}
            </Select>

            {officesError ? (
              <Alert variant="error" title="Offices unavailable">
                <p>{officesError}</p>
              </Alert>
            ) : null}

            {!officesLoading && !officesError && offices.length === 0 ? (
              <Alert variant="info" title="No offices yet">
                <p>The API has not returned any offices. Try again once the sample data is seeded.</p>
              </Alert>
            ) : null}

            <fieldset className="pair-fieldset" aria-describedby="pairing-hint">
              <legend>Choose two candidates</legend>
              <p className="field-hint" id="pairing-hint">
                Both candidates must be different and belong to the selected office.
              </p>

              {candidatesLoading ? (
                <SkeletonGroup label="Loading candidates">
                  <div className="pair-grid pair-grid--loading" aria-hidden="true">
                    <Skeleton height="46px" />
                    <span />
                    <Skeleton height="46px" />
                  </div>
                </SkeletonGroup>
              ) : (
                <div className="pair-grid">
                  <Select
                    id="candidate-a"
                    label="First candidate"
                    value={candidateAId}
                    onChange={handleManualCandidateA}
                    disabled={!officeSlug || !officeCandidates.length}
                    hint={
                      !officeSlug
                        ? 'Choose an office first.'
                        : officeCandidates.length
                          ? undefined
                          : 'No candidates are available for this office.'
                    }
                  >
                    <option value="">Select a candidate…</option>
                    {officeCandidates.map((candidate) => {
                      const id = candidateId(candidate);
                      return (
                        <option key={id} value={id} disabled={id === candidateBId}>
                          {candidate.name}
                          {candidate.party ? ` — ${candidate.party}` : ''}
                        </option>
                      );
                    })}
                  </Select>

                  <span className="pair-vs" aria-hidden="true">
                    vs
                  </span>

                  <Select
                    id="candidate-b"
                    label="Second candidate"
                    value={candidateBId}
                    onChange={handleManualCandidateB}
                    disabled={!officeSlug || !officeCandidates.length}
                  >
                    <option value="">Select a candidate…</option>
                    {officeCandidates.map((candidate) => {
                      const id = candidateId(candidate);
                      return (
                        <option key={id} value={id} disabled={id === candidateAId}>
                          {candidate.name}
                          {candidate.party ? ` — ${candidate.party}` : ''}
                        </option>
                      );
                    })}
                  </Select>
                </div>
              )}

              {candidatesError ? (
                <Alert variant="error" title="Candidates unavailable">
                  <p>{candidatesError}</p>
                </Alert>
              ) : null}

              {officeSlug &&
              !candidatesLoading &&
              !candidatesError &&
              officeCandidates.length > 0 &&
              officeCandidates.length < 2 ? (
                <Alert variant="info" title="A second candidate is needed">
                  <p>This office currently has fewer than two candidates on record.</p>
                </Alert>
              ) : null}
            </fieldset>
              </>
            ) : null}

            {selectedA && selectedB ? (
              <div className="pair-preview" aria-live="polite">
                <span className="pair-preview__side">
                  <CandidateAvatar name={selectedA.name} size="sm" />
                  <span>{selectedA.name}</span>
                </span>
                <span className="pair-preview__vs">vs</span>
                <span className="pair-preview__side pair-preview__side--right">
                  <span>{selectedB.name}</span>
                  <CandidateAvatar name={selectedB.name} size="sm" />
                </span>
              </div>
            ) : null}

            {showSampleBanner ? <SampleDataBanner /> : null}

            {formError ? (
              <Alert variant="error" title="Comparison not started">
                <p>{errorMessage(formError)}</p>
              </Alert>
            ) : null}

            <div className="builder-submit">
              <Button
                type="submit"
                loading={submitting}
                loadingLabel="Running the panel…"
                disabled={!canCompare}
              >
                Run comparison
              </Button>
              {!authLoading && !user ? (
                <p className="form-signin-note">You will be asked to sign in before it runs.</p>
              ) : null}
            </div>

            <p className="form-status" role="status" aria-live="polite">
              {submitting
                ? 'Sending both voting records to three independent models. This can take a moment…'
                : officeSlug && pairIsValid
                  ? 'Ready. The panel will read only the recorded votes.'
                  : ''}
            </p>
          </form>
        </div>
      </section>

      <section className="how shell" id="how-it-works" aria-labelledby="how-heading">
        <div className="section-head">
          <p className="eyebrow">Method</p>
          <h2 id="how-heading">A briefing, not a scoreboard</h2>
          <p>
            One model can be confidently wrong. Three independent models, given the same record,
            make disagreement visible. The result is a reading of the record — not a verdict.
          </p>
        </div>
        <ol className="steps">
          <li className="step">
            <span className="step-num">01</span>
            <h3>Choose the record</h3>
            <p>Select an office and two candidates. Only candidates from the same office can be paired.</p>
          </li>
          <li className="step">
            <span className="step-num">02</span>
            <h3>Send only the votes</h3>
            <p>Each model receives bill numbers and titles, neutral summaries, topics, and yes/no/abstain/absent positions.</p>
          </li>
          <li className="step">
            <span className="step-num">03</span>
            <h3>Read the differences</h3>
            <p>Compare three analyses side by side, with shared votes called out and confidence stated.</p>
          </li>
        </ol>
        <aside className="method-callout">
          <p>
            <strong>What is never sent:</strong> biographies, official URLs, campaign slogans,
            endorsements, party platforms, or any speech text.
          </p>
          <Link className="text-link" to="/about">
            Read the full methodology and AI disclosure
          </Link>
        </aside>
      </section>
    </>
  );
}
