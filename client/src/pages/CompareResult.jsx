import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { candidatesApi, comparisonsApi } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { formatDate, formatDateTime, officeLabel, positionLabel, resourceId } from '../lib/format';
import { useDocumentTitle } from '../lib/hooks';
import Alert from '../components/Alert';
import Button from '../components/Button';
import CandidateAvatar from '../components/CandidateAvatar';
import ModelPanel from '../components/ModelPanel';
import SampleDataBanner from '../components/SampleDataBanner';
import { SkeletonGroup, Skeleton } from '../components/Spinner';

function voteCount(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function resolveCandidate(value, fallbackName) {
  if (value && typeof value === 'object' && value.name) return value;
  const id = resourceId(value);
  if (!id) {
    return value && typeof value === 'object' ? value : { name: fallbackName };
  }
  try {
    const data = await candidatesApi.get(id);
    if (data && data.candidate) return data.candidate;
  } catch {
    // Fall through to the snapshot data the comparison already has.
  }
  return value && typeof value === 'object' ? value : { name: fallbackName };
}

function priorityPositionText(position) {
  if (!position || !position.position) return 'No recorded roll-call vote';
  const label = positionLabel(position.position);
  const detail = position.result || position.note;
  return detail ? `${label} — ${detail}` : label;
}

function PriorityMeasures({ measures }) {
  return (
    <section className="priority-measures" aria-labelledby="priority-measures-heading">
      <h2 id="priority-measures-heading">Priority measures</h2>
      <p className="priority-measures__intro">
        High-salience measures the panel is required to address. The positions below are taken
        directly from the recorded roll calls, not from the AI text.
      </p>
      <ul className="priority-measure-list">
        {measures.map((measure) => (
          <li className="priority-measure" key={measure.key || measure.label}>
            <div className="priority-measure__head">
              <div>
                {measure.billNumber ? (
                  <p className="priority-measure__number">{measure.billNumber}</p>
                ) : null}
                <h3>{measure.label || measure.title || 'Priority measure'}</h3>
              </div>
              {measure.sourceUrl ? (
                <a
                  className="text-link priority-measure__source"
                  href={measure.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View roll call
                </a>
              ) : null}
            </div>
            {measure.context ? (
              <p className="priority-measure__context">{measure.context}</p>
            ) : null}
            <div className="priority-positions">
              {['candidateA', 'candidateB'].map((side) => {
                const candidate = measure[side] || {};
                const position = candidate.position;
                return (
                  <article className="priority-position" key={side}>
                    <h4>{candidate.name || (side === 'candidateA' ? 'Candidate A' : 'Candidate B')}</h4>
                    <p>
                      {position ? (
                        <span className={`badge badge--${position}`}>
                          {positionLabel(position)}
                        </span>
                      ) : (
                        <span className="badge badge--unknown">No roll-call vote</span>
                      )}
                      <span className="priority-position__detail">
                        {position
                          ? candidate.result || candidate.note || ''
                          : candidate.note || 'No recorded position in the imported record.'}
                      </span>
                    </p>
                  </article>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BillReferences({ bills }) {
  return (
    <section className="bill-references" aria-labelledby="bills-cited-heading">
      <h2 id="bills-cited-heading">Bills cited in this briefing</h2>
      <p className="bill-references__intro">
        Every bill the models referenced, with its official title and the neutral summary
        that was supplied to them. Follow the source link to read the bill itself.
      </p>
      <ul className="bill-reference-list">
        {bills.map((bill) => (
          <li className="bill-reference" key={bill.number || bill.title}>
            <div>
              {bill.citation || bill.number ? (
                <p className="bill-reference__number">{bill.citation || bill.number}</p>
              ) : null}
              <h3 className="bill-reference__title">{bill.title || 'Untitled bill'}</h3>
              {bill.summary ? <p className="bill-reference__summary">{bill.summary}</p> : null}
              {Array.isArray(bill.topics) && bill.topics.length ? (
                <ul className="topics" aria-label="Bill topics">
                  {bill.topics.map((topic) => (
                    <li className="topic" key={String(topic)}>
                      {String(topic)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {bill.sourceUrl ? (
              <a
                className="text-link bill-reference__link"
                href={bill.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                View bill source
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CandidateCard({ candidate, fallbackName, votes }) {
  const id = resourceId(candidate);
  const name = (candidate && candidate.name) || fallbackName;
  const party = candidate && candidate.party ? candidate.party : '';
  const office = candidate && candidate.office ? officeLabel(candidate.office) : '';

  return (
    <article className="candidate-card">
      <div className="candidate-card__top">
        <CandidateAvatar name={name} size="lg" />
        <div>
          {party ? <p className="candidate-card__party">{party}</p> : null}
          <h2>{name}</h2>
          {office ? <p className="candidate-card__office">{office}</p> : null}
        </div>
      </div>
      <div className="candidate-card__foot">
        {votes !== null ? (
          <p className="candidate-card__votes">
            <span className="candidate-card__num">{votes}</span>
            <span>recorded votes in this snapshot</span>
          </p>
        ) : (
          <p className="candidate-card__votes-na">Vote count unavailable</p>
        )}
        {id ? (
          <Link className="text-link" to={`/candidates/${id}`}>
            View full voting record
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export default function CompareResult() {
  const { id } = useParams();
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError(new Error('No comparison id was provided.'));
      return undefined;
    }

    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setComparison(null);

    comparisonsApi
      .get(id, { signal: controller.signal })
      .then(async (data) => {
        const record = data && data.comparison ? data.comparison : data;
        if (!record || typeof record !== 'object') {
          throw new Error('The comparison record could not be read.');
        }
        const [candidateA, candidateB] = await Promise.all([
          resolveCandidate(record.candidateA, 'Candidate A'),
          resolveCandidate(record.candidateB, 'Candidate B'),
        ]);
        if (!active) return;
        setComparison({ ...record, candidateA, candidateB });
      })
      .catch((cause) => {
        if (!active || (cause && cause.name === 'AbortError')) return;
        setError(cause);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [id, reloadKey]);

  const candidateA = comparison && comparison.candidateA;
  const candidateB = comparison && comparison.candidateB;
  const nameA = (candidateA && candidateA.name) || 'Candidate A';
  const nameB = (candidateB && candidateB.name) || 'Candidate B';

  useDocumentTitle(comparison ? `${nameA} vs ${nameB}` : 'Comparison result');

  if (loading) {
    return (
      <div className="shell briefing">
        <h1 className="visually-hidden">Loading comparison</h1>
        <SkeletonGroup label="Loading comparison">
          <div className="briefing-skeleton">
            <Skeleton width="9rem" height="0.8rem" />
            <Skeleton width="72%" height="3.2rem" />
            <Skeleton width="46%" height="1.1rem" />
            <div className="briefing-skeleton__cards">
              <Skeleton height="10rem" />
              <Skeleton height="10rem" />
            </div>
            <Skeleton height="22rem" />
          </div>
        </SkeletonGroup>
      </div>
    );
  }

  if (error || !comparison) {
    const message =
      error && error.status === 404
        ? 'That comparison does not exist, or it belongs to another account.'
        : errorMessage(error, 'The comparison could not be loaded.');
    return (
      <div className="shell state-page">
        <h1>Comparison unavailable</h1>
        <Alert variant="error" title="We could not open this briefing">
          <p>{message}</p>
        </Alert>
        <div className="state-actions">
          <Button onClick={() => setReloadKey((value) => value + 1)}>Try again</Button>
          <Link className="btn btn--outline" to="/">
            Back to the comparison builder
          </Link>
        </div>
      </div>
    );
  }

  const snapshot = comparison.votesSnapshot || {};
  const votesA = voteCount(snapshot.candidateA);
  const votesB = voteCount(snapshot.candidateB);
  const office =
    (candidateA && candidateA.office && typeof candidateA.office === 'object'
      ? candidateA.office
      : null) ||
    (candidateB && candidateB.office && typeof candidateB.office === 'object'
      ? candidateB.office
      : null) ||
    (comparison.office && typeof comparison.office === 'object' ? comparison.office : null);
  const officeName = officeLabel(office);
  const race = comparison.race && typeof comparison.race === 'object' ? comparison.race : null;
  const models = Array.isArray(comparison.models) ? comparison.models : [];
  const billReferences = Array.isArray(comparison.billReferences)
    ? comparison.billReferences.filter((bill) => bill && (bill.number || bill.title))
    : [];
  const priorityMeasures = Array.isArray(comparison.priorityMeasures)
    ? comparison.priorityMeasures.filter((measure) => measure && (measure.label || measure.title))
    : [];
  const okCount = models.filter((model) => model && model.ok && model.analysis).length;
  const created = comparison.createdAt || comparison.generatedAt;
  const showSampleBanner =
    (candidateA && candidateA.isSample === true) ||
    (candidateB && candidateB.isSample === true);

  return (
    <div className="shell briefing">
      <header className="briefing-header">
        <p className="eyebrow">
          {race ? `${race.name} · ` : ''}Saved comparison{created ? ` · ${formatDate(created)}` : ''}
        </p>
        <h1>
          {nameA} <span className="briefing-vs">vs.</span> {nameB}
        </h1>
        <p className="lede">
          {race
            ? `A 2026 race briefing for ${race.name}.`
            : officeName
              ? `A record briefing for ${officeName}.`
              : 'A side-by-side reading of two voting records for the same office.'}{' '}
          Only roll-call votes were sent to the models.
        </p>
        <div className="briefing-actions">
          <Link className="btn btn--primary" to="/">
            New comparison
          </Link>
          <Link className="btn btn--outline" to="/history">
            Comparison history
          </Link>
          {created ? (
            <span className="briefing-date">Generated {formatDateTime(created)}</span>
          ) : null}
        </div>
      </header>

      {showSampleBanner ? <SampleDataBanner /> : null}

      <div className="matchup">
        <CandidateCard candidate={candidateA} fallbackName="Candidate A" votes={votesA} />
        <div className="matchup-divider" aria-hidden="true">
          vs
        </div>
        <CandidateCard candidate={candidateB} fallbackName="Candidate B" votes={votesB} />
      </div>

      {priorityMeasures.length ? <PriorityMeasures measures={priorityMeasures} /> : null}

      <div className="panel-status-bar" role="status" aria-live="polite">
        <span>
          {okCount} of 3 model {okCount === 1 ? 'analysis' : 'analyses'} available
        </span>
        <span>Identical prompt · voting records only</span>
      </div>

      <ModelPanel models={models} candidateA={candidateA} candidateB={candidateB} />

      {billReferences.length ? <BillReferences bills={billReferences} /> : null}

      <aside className="briefing-note">
        <p>
          <strong>How to read this:</strong> each tab is an independent AI interpretation of the
          same roll-call votes. Disagreement between models is useful information. None of these
          analyses is an endorsement, and all of them can be wrong.
        </p>
        <Link className="text-link" to="/about">
          Methodology, sources, and limitations
        </Link>
      </aside>
    </div>
  );
}
