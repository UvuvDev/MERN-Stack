import { useEffect, useRef, useState } from 'react';
import Alert from './Alert';
import { formatLatency } from '../lib/format';

import { MODEL_DEFINITIONS } from '../lib/models';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, fallback = '') {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function stringList(value) {
  return asArray(value)
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        return text(item.text || item.label || item.message || item.why || '');
      }
      return '';
    })
    .filter(Boolean);
}

function isComplete(model) {
  return Boolean(model && model.ok && model.analysis);
}

function BulletList({ items, emptyText }) {
  if (!items.length) {
    return <p className="analysis-empty">{emptyText}</p>;
  }
  return (
    <ul className="analysis-list">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function Analysis({ analysis, fallbackA, fallbackB, idPrefix = 'analysis' }) {
  const labelA = text(analysis && analysis.candidateA && analysis.candidateA.label) || fallbackA || 'Candidate A';
  const labelB = text(analysis && analysis.candidateB && analysis.candidateB.label) || fallbackB || 'Candidate B';
  const summary = text(analysis && analysis.summary);
  const dimensions = asArray(analysis && analysis.dimensions).filter(
    (dimension) => dimension && typeof dimension === 'object'
  );
  const candidateA = (analysis && analysis.candidateA) || {};
  const candidateB = (analysis && analysis.candidateB) || {};
  const strengthsA = stringList(candidateA.strengths);
  const concernsA = stringList(candidateA.concerns);
  const strengthsB = stringList(candidateB.strengths);
  const concernsB = stringList(candidateB.concerns);
  const sharedVotes = asArray(analysis && analysis.sharedVotes).filter(Boolean);
  const notableVotes = asArray(analysis && analysis.notableVotes).filter(Boolean);
  const confidence = text(analysis && analysis.confidence).toLowerCase();
  const confidenceClass = ['low', 'medium', 'high'].includes(confidence)
    ? confidence
    : 'unknown';
  const disclaimer = text(analysis && analysis.disclaimer);

  return (
    <div className="analysis">
      <section className="analysis-section analysis-section--first" aria-labelledby={`${idPrefix}-summary-heading`}>
        <h3 id={`${idPrefix}-summary-heading`}>Summary</h3>
        {summary ? <p className="analysis-summary">{summary}</p> : <p className="analysis-empty">No summary was returned.</p>}
      </section>

      <section className="analysis-section" aria-labelledby={`${idPrefix}-dimensions-heading`}>
        <h3 id={`${idPrefix}-dimensions-heading`}>Topic by topic</h3>
        {dimensions.length ? (
          <div className="table-wrap table-wrap--dimensions">
            <table className="dimension-table">
              <caption>
                How the two voting records differ by topic. Each cell summarizes recorded votes, not campaign positions.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Topic</th>
                  <th scope="col">{labelA}</th>
                  <th scope="col">{labelB}</th>
                  <th scope="col">Difference</th>
                </tr>
              </thead>
              <tbody>
                {dimensions.map((dimension, index) => (
                  <tr key={`${text(dimension.topic)}-${index}`}>
                    <th scope="row">{text(dimension.topic, 'General')}</th>
                    <td data-label={labelA}>{text(dimension.candidateA, '—')}</td>
                    <td data-label={labelB}>{text(dimension.candidateB, '—')}</td>
                    <td data-label="Difference">{text(dimension.difference, '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="analysis-empty">No topic breakdown was returned.</p>
        )}
      </section>

      <section className="analysis-section" aria-labelledby={`${idPrefix}-candidates-heading`}>
        <h3 id={`${idPrefix}-candidates-heading`}>Strengths and concerns</h3>
        <div className="analysis-grid">
          <article className="analysis-card">
            <h4>{labelA}</h4>
            <p className="analysis-card__label">Strengths in the record</p>
            <BulletList items={strengthsA} emptyText="No specific strengths were noted." />
            <p className="analysis-card__label">Concerns</p>
            <BulletList items={concernsA} emptyText="No specific concerns were noted." />
          </article>
          <article className="analysis-card">
            <h4>{labelB}</h4>
            <p className="analysis-card__label">Strengths in the record</p>
            <BulletList items={strengthsB} emptyText="No specific strengths were noted." />
            <p className="analysis-card__label">Concerns</p>
            <BulletList items={concernsB} emptyText="No specific concerns were noted." />
          </article>
        </div>
      </section>

      <div className="analysis-split">
        <section className="analysis-section" aria-labelledby={`${idPrefix}-shared-heading`}>
          <h3 id={`${idPrefix}-shared-heading`}>Shared votes</h3>
          {sharedVotes.length ? (
            <ul className="note-list">
              {sharedVotes.map((vote, index) => (
                <li key={`shared-${index}`}>{text(vote)}</li>
              ))}
            </ul>
          ) : (
            <p className="analysis-empty">No shared votes were called out.</p>
          )}
        </section>

        <section className="analysis-section" aria-labelledby={`${idPrefix}-notable-heading`}>
          <h3 id={`${idPrefix}-notable-heading`}>Notable votes</h3>
          {notableVotes.length ? (
            <ul className="note-list">
              {notableVotes.map((vote, index) => {
                if (typeof vote === 'string') {
                  return <li key={`notable-${index}`}>{vote}</li>;
                }
                return (
                  <li key={`notable-${index}`}>
                    {vote.bill ? <strong>{text(vote.bill)}</strong> : null}
                    {vote.why ? <span>{vote.bill ? ' — ' : ''}{text(vote.why)}</span> : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="analysis-empty">No notable votes were called out.</p>
          )}
        </section>
      </div>

      <div className="analysis-footer">
        <p className={`confidence confidence--${confidenceClass}`}>
          <span className="confidence__label">Confidence</span>
          <strong>{confidence || 'not stated'}</strong>
        </p>
        <p className="disclaimer">
          {disclaimer ||
            'This is an AI interpretation of recorded roll-call votes only. It is not an endorsement and can be wrong; check the underlying bills.'}
        </p>
      </div>
    </div>
  );
}

export default function ModelPanel({ models = [], candidateA, candidateB }) {
  const byKey = new Map();
  asArray(models).forEach((model) => {
    if (model && model.key) byKey.set(model.key, model);
  });

  const tabs = MODEL_DEFINITIONS.map((definition) => ({
    ...definition,
    model: byKey.get(definition.key) || null,
  }));

  const firstComplete = tabs.findIndex((tab) => isComplete(tab.model));
  const [active, setActive] = useState(firstComplete >= 0 ? firstComplete : 0);
  const tabRefs = useRef([]);

  useEffect(() => {
    if (isComplete(tabs[active] && tabs[active].model)) return;
    const next = tabs.findIndex((tab) => isComplete(tab.model));
    if (next >= 0) setActive(next);
    // tabs are derived from the models prop; only re-evaluate when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);

  function focusTab(index) {
    setActive(index);
    const element = tabRefs.current[index];
    if (element) element.focus();
  }

  function handleKeyDown(event, index) {
    let next = null;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== null) {
      event.preventDefault();
      focusTab(next);
    }
  }

  return (
    <section className="model-panel" aria-labelledby="model-panel-heading">
      <div className="model-panel__head">
        <div>
          <p className="eyebrow">The model panel</p>
          <h2 id="model-panel-heading">Three readings of the same record</h2>
          <p className="model-panel__intro">
            Each model received an identical prompt built only from bill text and recorded positions. No bios,
            platforms, ads, or speeches were sent.
          </p>
        </div>
      </div>

      <div className="model-tabs" role="tablist" aria-label="AI model analyses">
        {tabs.map((tab, index) => {
          const complete = isComplete(tab.model);
          const statusLabel = !tab.model ? 'Missing' : complete ? 'OK' : 'Error';
          return (
            <button
              key={tab.key}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`model-tab-${tab.key}`}
              aria-controls={`model-panel-${tab.key}`}
              aria-selected={active === index}
              tabIndex={active === index ? 0 : -1}
              className="model-tab"
              onClick={() => setActive(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <span>{tab.label}</span>
              <span className={`model-tab__status ${complete ? 'is-ok' : 'is-error'}`}>
                {statusLabel}
              </span>
            </button>
          );
        })}
      </div>

      {tabs.map((tab, index) => {
        const model = tab.model;
        const complete = isComplete(model);
        const failureMessage =
          model && model.error
            ? typeof model.error === 'string'
              ? model.error
              : model.error.message || 'The model response could not be read.'
            : !model
              ? 'No result was saved for this model.'
              : 'The model response was empty or could not be read.';
        return (
          <div
            key={tab.key}
            role="tabpanel"
            id={`model-panel-${tab.key}`}
            aria-labelledby={`model-tab-${tab.key}`}
            className="model-panel__body"
            hidden={active !== index}
            tabIndex={0}
          >
            {complete ? (
              <>
                <div className="model-meta">
                  <span className="status-pill status-pill--ok">Analysis complete</span>
                  {formatLatency(model.latencyMs) ? (
                    <span>Completed in {formatLatency(model.latencyMs)}</span>
                  ) : (
                    <span>Timing unavailable</span>
                  )}
                  {model.modelId ? <span className="model-id">{model.modelId}</span> : null}
                </div>
                <Analysis
                  analysis={model.analysis}
                  fallbackA={typeof candidateA === 'string' ? candidateA : candidateA && candidateA.name}
                  fallbackB={typeof candidateB === 'string' ? candidateB : candidateB && candidateB.name}
                  idPrefix={`model-${tab.key}`}
                />
              </>
            ) : (
              <div className="model-failure">
                <Alert variant="error" title={`${tab.label} did not return an analysis`}>
                  <p>{failureMessage}</p>
                  <p>
                    The other tabs are unaffected. This comparison is still a valid reading from the models that
                    responded.
                  </p>
                </Alert>
                {model && model.latencyMs ? (
                  <p className="model-failure__meta">Attempt took {formatLatency(model.latencyMs)}.</p>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
