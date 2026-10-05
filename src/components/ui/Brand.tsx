import { Link } from 'react-router-dom';

export function BrandGlyph({
  className = 'brand-glyph',
}: {
  className?: string;
}) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="7"
        fill="#141417"
        stroke="#2c2c33"
      />
      <path
        d="M7 21.5 13 15.5l4 4 8-9"
        fill="none"
        stroke="#ededef"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="brand" aria-label="FXSignal home">
      <BrandGlyph />
      FXSignal
    </Link>
  );
}
