export default function Button({ children, onClick, variant = 'primary', size = 'md', type = 'button', disabled = false, className = '' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant} btn-${size} ${className}`.trim()}
    >
      {children}
    </button>
  );
}
