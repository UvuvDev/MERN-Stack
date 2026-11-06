import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../lib/hooks';

export default function NotFound() {
  useDocumentTitle('Page not found');

  return (
    <div className="shell state-page not-found">
      <p className="not-found__code" aria-hidden="true">
        404
      </p>
      <p className="eyebrow">Page not found</p>
      <h1>This page is not on the record.</h1>
      <p className="lede">
        The address may be mistyped, or the page may have moved. The comparison builder and the
        public candidate records are still available.
      </p>
      <div className="state-actions">
        <Link className="btn btn--primary" to="/">
          Back to the comparison builder
        </Link>
        <Link className="btn btn--outline" to="/about">
          Read the methodology
        </Link>
      </div>
    </div>
  );
}
