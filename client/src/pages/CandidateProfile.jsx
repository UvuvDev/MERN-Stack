import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { candidatesApi } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { officeLabel, officeSlug } from '../lib/format';
import { useDocumentTitle } from '../lib/hooks';
import Alert from '../components/Alert';
import Button from '../components/Button';
import CandidateAvatar from '../components/CandidateAvatar';
import SampleDataBanner from '../components/SampleDataBanner';
import { Skeleton, SkeletonGroup } from '../components/Spinner';
import VoteList from '../components/VoteList';

function tallyVotes(votes) {
  const tally = { yes: 0, no: 0, abstain: 0, absent: 0 };
  votes.forEach((vote) => {
    const key = String((vote && vote.position) || '').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(tally, key)) {
      tally[key] += 1;
    }
  });
  return tally;
}

export default function CandidateProfile() {
  const { id } = useParams();
  const [candidate, setCandidate] = useState(null);
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [votesWarning, setVotesWarning] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError(new Error('No candidate id was provided.'));
      return undefined;
    }

    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setVotesWarning('');
    setCandidate(null);
    setVotes([]);

    candidatesApi
      .get(id, { signal: controller.signal })
      .then(async (data) => {
        const record = data && data.candidate ? data.candidate : data;
        if (!record || typeof record !== 'object') {
          throw new Error('The candidate record could not be read.');
        }

        let voteList = Array.isArray(record.votes) ? record.votes : null;
        if (!voteList) {
          try {
            const voteData = await candidatesApi.votes(id, { signal: controller.signal });
            voteList = voteData && Array.isArray(voteData.votes) ? voteData.votes : [];
          } catch (voteError) {
            if (voteError && voteError.name === 'AbortError') throw voteError;
            voteList = [];
            if (active) {
              setVotesWarning(
                'The candidate loaded, but the individual votes could not be retrieved.'
              );
            }
          }
        }

        if (!active) return;
        setCandidate(record);
        setVotes(voteList);
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

  const name = (candidate && candidate.name) || 'Candidate';
  useDocumentTitle(candidate ? `${name} — voting record` : 'Candidate profile');

  const tally = useMemo(() => tallyVotes(votes), [votes]);
  const office = candidate && candidate.office && typeof candidate.office === 'object' ? candidate.office : null;
  const officeName = officeLabel(office);
  const officeParam = officeSlug(office);
  const sample = Boolean(candidate && candidate.isSample);
  const locationLine = candidate
    ? [candidate.state, candidate.district ? `District ${candidate.district}` : '']
        .filter(Boolean)
        .join(' · ')
    : '';

  if (loading) {
    return (
      <div className="shell profile-page">
        <h1 className="visually-hidden">Loading candidate profile</h1>
        <SkeletonGroup label="Loading candidate profile">
          <div className="profile-skeleton">
            <Skeleton width="78px" height="78px" />
            <div className="profile-skeleton__copy">
              <Skeleton width="52%" height="2.6rem" />
              <Skeleton width="34%" height="1rem" />
            </div>
          </div>
          <Skeleton height="16rem" />
        </SkeletonGroup>
      </div>
    );
  }

  if (error || !candidate) {
    const message =
      error && error.status === 404
        ? 'No candidate exists at this address.'
        : errorMessage(error, 'The candidate profile could not be loaded.');
    return (
      <div className="shell state-page">
        <h1>Candidate unavailable</h1>
        <Alert variant="error" title="We could not open this profile">
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

  return (
    <div className="shell profile-page">
      <p className="profile-back">
        <Link className="text-link" to="/">
          ← Back to comparisons
        </Link>
      </p>

      <header className="profile-head">
        <CandidateAvatar name={name} size="lg" />
        <div className="profile-head__copy">
          <p className="eyebrow">Candidate record</p>
          <h1>{name}</h1>
          <p className="profile-meta">
            {candidate.party ? <span className="party-tag">{candidate.party}</span> : null}
            {officeName ? (
              <span>
                {officeParam ? (
                  <Link className="text-link" to={`/?office=${encodeURIComponent(officeParam)}`}>
                    {officeName}
                  </Link>
                ) : (
                  officeName
                )}
              </span>
            ) : null}
            {locationLine ? <span>{locationLine}</span> : null}
          </p>
          {candidate.bio ? <p className="profile-bio">{candidate.bio}</p> : null}
          {candidate.officialUrl ? (
            <p>
              <a
                className="text-link"
                href={candidate.officialUrl}
                target="_blank"
                rel="noreferrer"
              >
                Official candidate page
              </a>
            </p>
          ) : null}
        </div>
      </header>

      {sample ? <SampleDataBanner /> : null}

      <section className="profile-record" aria-labelledby="profile-record-heading">
        <div className="profile-record__head">
          <div>
            <p className="eyebrow">Roll-call record</p>
            <h2 id="profile-record-heading">Voting record</h2>
            <p>
              {votes.length
                ? `${votes.length} recorded ${votes.length === 1 ? 'vote' : 'votes'}, newest first.`
                : 'No votes have been recorded for this candidate yet.'}
            </p>
          </div>
          <dl className="vote-tally" aria-label="Vote position totals">
            <div className="vote-tally__item">
              <dt>Yes</dt>
              <dd>{tally.yes}</dd>
            </div>
            <div className="vote-tally__item">
              <dt>No</dt>
              <dd>{tally.no}</dd>
            </div>
            <div className="vote-tally__item">
              <dt>Abstain</dt>
              <dd>{tally.abstain}</dd>
            </div>
            <div className="vote-tally__item">
              <dt>Absent</dt>
              <dd>{tally.absent}</dd>
            </div>
          </dl>
        </div>

        {votesWarning ? (
          <Alert variant="info" title="Votes partly unavailable">
            <p>{votesWarning}</p>
          </Alert>
        ) : null}

        <VoteList votes={votes} />
      </section>
    </div>
  );
}
