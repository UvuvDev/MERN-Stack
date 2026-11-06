import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { comparisonsApi } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { formatDate, officeLabel } from '../lib/format';
import { useDocumentTitle } from '../lib/hooks';
import { MODEL_DEFINITIONS } from '../lib/models';
import Alert from '../components/Alert';
import Button from '../components/Button';
import CandidateAvatar from '../components/CandidateAvatar';
import EmptyState from '../components/EmptyState';
import { Skeleton, SkeletonGroup } from '../components/Spinner';

const PAGE_SIZE = 10;

function candidateName(value, fallback) {
  if (value && typeof value === 'object' && value.name) return value.name;
  return fallback;
}

function HistoryCard({ comparison }) {
  const candidateA = comparison && comparison.candidateA;
  const candidateB = comparison && comparison.candidateB;
  const nameA = candidateName(candidateA, 'Candidate A');
  const nameB = candidateName(candidateB, 'Candidate B');
  const id = (comparison && (comparison._id || comparison.id)) || '';
  const created = comparison && (comparison.createdAt || comparison.generatedAt);
  const office =
    (candidateA && candidateA.office && typeof candidateA.office === 'object'
      ? candidateA.office
      : null) ||
    (candidateB && candidateB.office && typeof candidateB.office === 'object'
      ? candidateB.office
      : null) ||
    (comparison && comparison.office && typeof comparison.office === 'object'
      ? comparison.office
      : null);
  const officeName = officeLabel(office);
  const raceName =
    comparison && comparison.race && typeof comparison.race === 'object'
      ? comparison.race.name
      : '';
  const models = comparison && Array.isArray(comparison.models) ? comparison.models : [];
  const byKey = new Map();
  models.forEach((model) => {
    if (model && model.key) byKey.set(model.key, model);
  });
  const okCount = models.filter((model) => model && model.ok && model.analysis).length;

  return (
    <article className="history-card">
      <div className="history-card__top">
        <p className="eyebrow">{created ? formatDate(created) : 'Date not recorded'}</p>
        {raceName || officeName ? (
          <p className="history-card__office">{raceName || officeName}</p>
        ) : null}
      </div>

      <h2>
        {id ? (
          <Link to={`/compare/${id}`} className="history-card__link">
            {nameA} <span className="history-card__vs">vs</span> {nameB}
          </Link>
        ) : (
          <>
            {nameA} <span className="history-card__vs">vs</span> {nameB}
          </>
        )}
      </h2>

      <div className="history-card__people" aria-hidden="true">
        <span className="history-card__person">
          <CandidateAvatar name={nameA} size="sm" />
        </span>
        <span className="history-card__divider">vs</span>
        <span className="history-card__person history-card__person--right">
          <CandidateAvatar name={nameB} size="sm" />
        </span>
      </div>

      <ul className="model-chips" aria-label={`Model results: ${okCount} of 3 available`}>
        {MODEL_DEFINITIONS.map((definition) => {
          const model = byKey.get(definition.key);
          const ok = Boolean(model && model.ok && model.analysis);
          const state = !model ? 'Missing' : ok ? 'OK' : 'Error';
          return (
            <li key={definition.key} className={`model-chip ${ok ? 'is-ok' : 'is-error'}`}>
              <span className="model-chip__dot" aria-hidden="true" />
              <span>{definition.label}</span>
              <span className="model-chip__state">{state}</span>
            </li>
          );
        })}
      </ul>

      <div className="history-card__foot">
        <p>
          {okCount} of 3 model {okCount === 1 ? 'reading' : 'readings'} available
        </p>
        {id ? (
          <Link className="text-link" to={`/compare/${id}`}>
            Open briefing
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export default function History() {
  useDocumentTitle('Your comparison history');
  const [searchParams, setSearchParams] = useSearchParams();
  const parsedPage = Number.parseInt(searchParams.get('page') || '1', 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [comparisons, setComparisons] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    comparisonsApi
      .list({ page, limit: PAGE_SIZE, signal: controller.signal })
      .then((data) => {
        if (!active) return;
        setComparisons(data && Array.isArray(data.comparisons) ? data.comparisons : []);
        setPagination(data && data.pagination ? data.pagination : null);
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
  }, [page, reloadKey]);

  function goToPage(nextPage) {
    if (nextPage <= 1) {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ page: String(nextPage) }, { replace: true });
    }
    window.scrollTo(0, 0);
  }

  const total = pagination && typeof pagination.total === 'number' ? pagination.total : null;
  const totalPages =
    pagination && typeof pagination.pages === 'number'
      ? pagination.pages
      : pagination && typeof pagination.totalPages === 'number'
        ? pagination.totalPages
        : total !== null
          ? Math.max(1, Math.ceil(total / PAGE_SIZE))
          : null;
  const hasPrev = pagination && typeof pagination.hasPrev === 'boolean' ? pagination.hasPrev : page > 1;
  const hasNext =
    pagination && typeof pagination.hasNext === 'boolean'
      ? pagination.hasNext
      : totalPages !== null
        ? page < totalPages
        : comparisons.length === PAGE_SIZE;

  return (
    <div className="shell history-page">
      <header className="page-header">
        <p className="eyebrow">Your account</p>
        <h1>Comparison history</h1>
        <p className="lede">
          Every briefing you have run, saved with the candidate snapshot and the model responses
          from that moment.
        </p>
        <div className="page-header__actions">
          <Link className="btn btn--primary" to="/">
            Build a new comparison
          </Link>
        </div>
      </header>

      {loading ? (
        <SkeletonGroup label="Loading comparison history">
          <div className="history-list" aria-hidden="true">
            <Skeleton height="13rem" />
            <Skeleton height="13rem" />
            <Skeleton height="13rem" />
          </div>
        </SkeletonGroup>
      ) : error ? (
        <div className="history-error">
          <Alert variant="error" title="History unavailable">
            <p>{errorMessage(error, 'Could not load your saved comparisons.')}</p>
          </Alert>
          <div className="state-actions">
            <Button onClick={() => setReloadKey((value) => value + 1)}>Try again</Button>
            <Link className="text-link" to="/">
              Back to the builder
            </Link>
          </div>
        </div>
      ) : comparisons.length === 0 ? (
        <EmptyState
          title={page > 1 ? 'Nothing on this page' : 'No saved comparisons yet'}
          action={
            page > 1 ? (
              <Link className="btn btn--primary" to="/history">
                Back to the latest comparisons
              </Link>
            ) : (
              <Link className="btn btn--primary" to="/">
                Build your first comparison
              </Link>
            )
          }
        >
          <p>
            {page > 1
              ? 'That page has no saved comparisons. Return to the first page of your history.'
              : 'Choose a race (or an office and two candidates) to create a briefing. It will appear here the next time you sign in.'}
          </p>
        </EmptyState>
      ) : (
        <>
          <div className="history-list">
            {comparisons.map((comparison, index) => (
              <HistoryCard
                key={(comparison && (comparison._id || comparison.id)) || `comparison-${index}`}
                comparison={comparison}
              />
            ))}
          </div>

          {totalPages !== null && totalPages > 1 ? (
            <nav className="pagination" aria-label="Comparison history pages">
              <Button
                variant="outline"
                onClick={() => goToPage(page - 1)}
                disabled={!hasPrev}
              >
                Previous
              </Button>
              <p className="pagination__status" aria-live="polite">
                Page {page}
                {totalPages ? ` of ${totalPages}` : ''}
                {total !== null ? ` · ${total} total` : ''}
              </p>
              <Button
                variant="outline"
                onClick={() => goToPage(page + 1)}
                disabled={!hasNext}
              >
                Next
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
