import { useEffect } from 'react';

const SUFFIX = 'Record Over Rhetoric';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — ${SUFFIX}` : SUFFIX;
  }, [title]);
}
