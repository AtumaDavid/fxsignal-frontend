import type { ReactNode } from 'react';
import { Icon, type IconName } from '../Icon';

export function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={17} />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Spinner({ size = 14 }: { size?: number }) {
  return <Icon name="refresh" size={size} className="spin" />;
}
