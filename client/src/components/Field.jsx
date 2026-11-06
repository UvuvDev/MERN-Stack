import { cloneElement, isValidElement } from 'react';

export default function Field({
  id,
  label,
  error,
  hint,
  required = false,
  className = '',
  children,
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  let control = children;
  if (isValidElement(children)) {
    control = cloneElement(children, {
      id,
      'aria-invalid': error ? 'true' : undefined,
      'aria-describedby': describedBy,
    });
  }

  return (
    <div className={`field ${className}`.trim()}>
      <label htmlFor={id}>
        {label}
        {required ? (
          <span className="field-required" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {control}
      {error ? (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({ id, label, error, hint, required, className, ...props }) {
  return (
    <Field
      id={id}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <input required={required} {...props} />
    </Field>
  );
}
