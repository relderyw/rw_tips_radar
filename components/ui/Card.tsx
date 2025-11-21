import React, { ReactNode, CSSProperties } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  style?: CSSProperties;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, icon, action, style }) => {
  return (
    <div className={`bg-surface/50 backdrop-blur-md border border-white/5 rounded-xl p-6 shadow-lg ${className}`} style={style}>
      {(title || action) && (
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            {icon && <span className="text-primary text-xl">{icon}</span>}
            {title && <h3 className="text-lg font-semibold text-textMain tracking-wide">{title}</h3>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

export const StatCard: React.FC<{ label: string; value: string | number; trend?: string; color?: 'primary' | 'accent' | 'warning' }> = ({ label, value, trend, color = 'accent' }) => {
    const colorStyles = {
        primary: 'text-primary',
        accent: 'text-accent',
        warning: 'text-warning',
    }

    return (
        <div className="bg-surfaceHighlight/40 p-4 rounded-lg border-l-4 border-transparent hover:border-accent transition-all duration-300 hover:-translate-y-1">
            <p className="text-textMuted text-xs uppercase tracking-wider font-semibold mb-2">{label}</p>
            <div className={`text-3xl font-bold ${colorStyles[color]}`}>{value}</div>
            {trend && <p className="text-xs text-textMuted mt-1">{trend}</p>}
        </div>
    )
}