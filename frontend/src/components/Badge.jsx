export default function Badge({ text, className = '' }) {
  return (
    <span className={`badge ${className}`.trim()}>
      {text}
    </span>
  );
}
