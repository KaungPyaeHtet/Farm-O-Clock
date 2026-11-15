// Farm O'Clock "orbit clock" logo (same drawing as app/icon.svg).
export default function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Farm O'Clock logo">
      <rect width="100" height="100" rx="23" fill="#2F8A3E" />
      <path d="M74.47,41.59 A27,27 0 1 1 61.41,28.53" fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" />
      <circle cx="69.09" cy="33.91" r="5" fill="#fff" />
      <path d="M50,53 L50,36" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      <path d="M50,46 C48,40 43,37 36,38 C37,44 43,47 50,46 Z" fill="#fff" />
      <path d="M50,41 C52,36 56,34 61,35 C60,40 55,42 50,41 Z" fill="#fff" />
      <circle cx="50" cy="53" r="5" fill="#fff" />
    </svg>
  );
}
