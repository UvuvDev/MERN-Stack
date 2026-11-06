import Field from './Field';

export default function Select({
  id,
  label,
  error,
  hint,
  required,
  className,
  children,
  ...props
}) {
  return (
    <Field
      id={id}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <select required={required} {...props}>
        {children}
      </select>
    </Field>
  );
}
