import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../lib/hooks';

const MODELS = [
  {
    name: 'MiniMax M3 Flash',
    id: 'minimax/minimax-m3.1-flash',
  },
  {
    name: 'DeepSeek 4.1 Flash',
    id: 'deepseek/deepseek-v4.1-flash',
  },
  {
    name: 'Grok 4.3',
    id: 'x-ai/grok-4.3',
  },
];

export default function About() {
  useDocumentTitle('Methodology and AI disclosure');

  return (
    <div className="shell about-page">
      <header className="about-hero">
        <p className="eyebrow">Methodology, data, and AI disclosure</p>
        <h1>How a briefing is made</h1>
        <p className="lede">
          Record Over Rhetoric compares candidates only on their recorded roll-call votes on bills.
          It deliberately excludes the things campaigns are made of: slogans, ads, speeches, and
          party messaging.
        </p>
      </header>

      <div className="about-layout">
        <div className="prose">
          <section aria-labelledby="methodology-heading">
            <h2 id="methodology-heading">Methodology</h2>
            <p>
              You choose one office and two candidates. The service gathers each candidate&apos;s
              recorded position on bills: <strong>yes</strong>, <strong>no</strong>,{' '}
              <strong>abstain</strong>, or <strong>absent</strong>. It then builds one identical
              prompt for three independent AI models.
            </p>
            <p>
              The prompt contains the bill number, title, a neutral summary, topics, and each
              candidate&apos;s recorded position. It does not contain a candidate&apos;s biography,
              official URL, party platform, endorsements, advertisements, or speech text. The same
              record is sent to every model, which is what makes disagreement between models useful.
            </p>
            <p>
              Every bill reference in a finished briefing is expanded to its short title, and the
              briefing lists the bills it cites with neutral summaries and a link to the source, so
              a bill number never appears without context.
            </p>
            <p>
              The builder is race-first: a registered race links an election year, an office, and
              its nominees. All 35 Senate races on the 2026 map are registered. Three (Alaska,
              Georgia, Ohio) have both nominees&apos; federal records; the rest are shown with an
              explicit records-incomplete status because most challengers have never held federal
              office. When service periods, chambers, or Congresses differ, the models are told to
              match bills by number and Congress and not to invent shared votes.
            </p>
            <div className="sent-grid">
              <div className="sent-card sent-card--yes">
                <h3>Always sent</h3>
                <ul>
                  <li>Bill number and title</li>
                  <li>Neutral bill summary</li>
                  <li>Bill topics</li>
                  <li>Recorded positions and dates</li>
                </ul>
              </div>
              <div className="sent-card sent-card--no">
                <h3>Never sent</h3>
                <ul>
                  <li>Biographies or official URLs</li>
                  <li>Campaign slogans or advertisements</li>
                  <li>Speeches, endorsements, party platforms</li>
                  <li>Your account details or email address</li>
                </ul>
              </div>
            </div>
          </section>

          <section aria-labelledby="models-heading">
            <h2 id="models-heading">The three models</h2>
            <p>
              Each comparison runs three models in parallel. If one model fails or returns an
              unreadable response, the other results are still saved and shown clearly.
            </p>
            <div className="table-wrap">
              <table className="model-table">
                <caption>Model names and default OpenRouter identifiers. Identifiers can be overridden by the server operator.</caption>
                <thead>
                  <tr>
                    <th scope="col">Display name</th>
                    <th scope="col">OpenRouter model id</th>
                  </tr>
                </thead>
                <tbody>
                  {MODELS.map((model) => (
                    <tr key={model.id}>
                      <th scope="row">{model.name}</th>
                      <td>
                        <code>{model.id}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="prose-note">
              A single model can be confidently wrong. Three independent readings of the same
              record make disagreement visible. Disagreement is a prompt to check the underlying
              votes, not a verdict.
            </p>
          </section>

          <section aria-labelledby="limitations-heading">
            <h2 id="limitations-heading">Limitations</h2>
            <ul className="limitations-list">
              <li>
                <strong>Absences are ambiguous.</strong> An absent vote can reflect a schedule,
                a procedural rule, or a deliberate choice. The UI shows it as recorded, without
                guessing intent.
              </li>
              <li>
                <strong>Summaries are not the full bill.</strong> A neutral summary can omit
                important detail, amendments, or context. Always read the underlying bill.
              </li>
              <li>
                <strong>AI models can misread or hallucinate.</strong> The analyses are
                AI-generated interpretations, not authoritative facts. Verify every claim against
                the cited bill.
              </li>
              <li>
                <strong>Votes are simplified.</strong> Roll-call positions do not capture
                committee work, amendments, or procedural maneuvering.
              </li>
              <li>
                <strong>This is not an endorsement.</strong> The service does not score,
                rank, or recommend candidates. It describes differences in the record.
              </li>
            </ul>
          </section>

          <section aria-labelledby="data-heading">
            <h2 id="data-heading">Data source and sample data</h2>
            <p>
              This deployment ships with fictional sample offices, candidates, bills, and votes.
              The sample names do not represent real officeholders, and any comparison built from
              them is marked with a sample-data notice.
            </p>
            <p>
              Real records can be loaded with the project's importer. Per-member roll-call
              positions for the U.S. House and Senate come from Voteview's public congressional
              vote data; official bill titles, summaries, and policy areas are optionally enriched
              from the Congress.gov API. Real candidates and bills are marked as non-sample, and
              each bill links back to Congress.gov so a reader can verify it.
            </p>
          </section>

          <section aria-labelledby="ai-heading">
            <h2 id="ai-heading">AI disclosure</h2>
            <p>
              The comparison text is generated by third-party AI models through OpenRouter. The
              models receive only the structured voting record described above. They do not receive
              your password, email address, display name, or browsing history.
            </p>
            <p>
              The model name, model identifier, success status, latency, and generated output are
              stored with each saved comparison so you can see exactly which model produced which
              reading. A model failure never blocks the other results.
            </p>
          </section>

          <section aria-labelledby="transparency-heading">
            <h2 id="transparency-heading">API and transparency</h2>
            <p>
              The REST API is documented with OpenAPI. You can inspect every endpoint, request
              shape, and response shape used by this client.
            </p>
            <p className="about-links">
              <a href="/api/docs" target="_blank" rel="noreferrer" className="text-link">
                Swagger UI documentation
              </a>
              <a href="/api/openapi.json" target="_blank" rel="noreferrer" className="text-link">
                OpenAPI 3.0 JSON
              </a>
            </p>
            <div className="about-cta">
              <Link className="btn btn--primary" to="/">
                Build a comparison
              </Link>
              <Link className="btn btn--outline" to="/register">
                Create an account
              </Link>
            </div>
          </section>
        </div>

        <aside className="about-side" aria-label="At a glance">
          <p className="eyebrow">At a glance</p>
          <h2>The rules of the record</h2>
          <ul className="about-side__list">
            <li>Two candidates, one office.</li>
            <li>Only roll-call votes and bill context.</li>
            <li>Three independent model readings.</li>
            <li>Failures are shown, never hidden.</li>
            <li>No rankings or endorsements.</li>
          </ul>
          <p className="about-side__note">
            Sample data in this deployment is fictional. Verify any real record with an official
            source.
          </p>
          <a className="btn btn--outline btn--block" href="/api/docs" target="_blank" rel="noreferrer">
            Open API documentation
          </a>
        </aside>
      </div>
    </div>
  );
}
