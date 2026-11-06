import { formatDate, formatMonth, positionLabel } from '../lib/format';

function isoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function sortVotes(votes) {
  return [...votes].sort((a, b) => {
    const left = new Date((a && (a.castAt || a.createdAt)) || 0).getTime() || 0;
    const right = new Date((b && (b.castAt || b.createdAt)) || 0).getTime() || 0;
    return right - left;
  });
}

function billOf(vote) {
  if (vote && vote.bill && typeof vote.bill === 'object') return vote.bill;
  return null;
}

function groupVotes(votes) {
  const groups = [];
  const index = new Map();
  sortVotes(votes).forEach((vote) => {
    const label = vote && vote.castAt ? formatMonth(vote.castAt) : 'Date not recorded';
    if (!index.has(label)) {
      const group = { label, items: [] };
      index.set(label, group);
      groups.push(group);
    }
    index.get(label).items.push(vote);
  });
  return groups;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function VoteList({ votes = [] }) {
  const safeVotes = Array.isArray(votes) ? votes : [];

  if (!safeVotes.length) {
    return <p className="vote-empty">No recorded votes are available for this candidate yet.</p>;
  }

  const groups = groupVotes(safeVotes);

  return (
    <div className="vote-groups">
      {groups.map((group) => {
        const headingId = `votes-${slugify(group.label)}`;
        return (
          <section className="vote-month" key={group.label} aria-labelledby={headingId}>
            <h3 id={headingId}>
              {group.label}
              <span className="vote-month__count">
                {group.items.length} {group.items.length === 1 ? 'vote' : 'votes'}
              </span>
            </h3>
            <ul className="vote-list">
              {group.items.map((vote, index) => {
                const bill = billOf(vote);
                const number = bill && bill.number ? String(bill.number) : '';
                const title =
                  (bill && bill.title) ||
                  (vote && typeof vote.bill === 'string' ? 'Bill record' : 'Untitled bill');
                const topics = bill && Array.isArray(bill.topics) ? bill.topics : [];
                const summary = bill && bill.summary ? bill.summary : '';
                const sourceUrl = bill && bill.sourceUrl ? bill.sourceUrl : '';
                const position = String((vote && vote.position) || '').toLowerCase();
                const voteDate = vote && vote.castAt ? vote.castAt : '';
                const voteId =
                  (vote && (vote._id || vote.id)) || `${group.label}-${index}`;

                return (
                  <li className="vote-item" key={voteId}>
                    <p className="vote-date">
                      <time dateTime={isoDate(voteDate)}>
                        {formatDate(voteDate, 'Date not recorded')}
                      </time>
                    </p>
                    <div className="vote-main">
                      {number ? (
                        <p className="vote-number">
                          {number}
                          {bill && bill.congress ? ` · ${bill.congress}th Congress` : ''}
                        </p>
                      ) : null}
                      <h4 className="vote-title">{title}</h4>
                      {topics.length ? (
                        <ul className="topics" aria-label="Bill topics">
                          {topics.map((topic) => (
                            <li className="topic" key={String(topic)}>
                              {String(topic)}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {summary ? <p className="vote-summary">{summary}</p> : null}
                      {vote && vote.note ? (
                        <p className="vote-note">
                          <strong>Note:</strong> {vote.note}
                        </p>
                      ) : null}
                      {sourceUrl ? (
                        <a
                          className="text-link vote-source"
                          href={sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View bill source
                        </a>
                      ) : null}
                    </div>
                    <span className={`badge badge--${position || 'unknown'}`}>
                      {positionLabel(vote && vote.position)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
