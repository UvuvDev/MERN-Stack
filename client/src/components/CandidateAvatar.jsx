import { avatarColor, initials } from '../lib/format';

export default function CandidateAvatar({ name = '', size = 'md', className = '' }) {
  return (
    <span
      className={`avatar avatar--${size} ${className}`.trim()}
      style={{ backgroundColor: avatarColor(name) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
