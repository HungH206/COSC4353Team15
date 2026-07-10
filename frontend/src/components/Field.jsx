export default function Field({ label, id, error, ...props }) {
  return (
    <div className="field-group">
      <label htmlFor={id} className="field-label">{label}</label>
      <input id={id} className={`field-input ${error ? 'field-error' : ''}`} {...props} />
      {error && <p className="field-help field-help-error">{error}</p>}
    </div>
  );
}
