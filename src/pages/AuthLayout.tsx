import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/ui/Brand';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="auth">
      <header className="auth-top">
        <Brand />
        <Link to="/" className="btn btn-ghost btn-sm">
          Back to site
        </Link>
      </header>
      <main className="auth-card">
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
        <div className="auth-switch">{footer}</div>
      </main>
      <footer className="auth-foot">
        Market context for research and education. Not financial advice.
      </footer>
    </div>
  );
}
