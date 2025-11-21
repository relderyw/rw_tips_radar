import React from 'react';

interface BadgeProps {
  value: number;
  isPercentage?: boolean;
  suffix?: string;
}

export const Badge: React.FC<BadgeProps> = ({ value, isPercentage = true, suffix = '%' }) => {
  let colorClass = 'bg-red-500/10 text-red-500 border-red-500/20'; // Poor
  
  if (value >= 85) {
    colorClass = 'bg-accent/10 text-accent border-accent/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]'; // Excellent
  } else if (value >= 70) {
    colorClass = 'bg-green-500/10 text-green-500 border-green-500/20'; // Good
  } else if (value >= 50) {
    colorClass = 'bg-warning/10 text-warning border-warning/20'; // Average
  }

  return (
    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${colorClass}`}>
      {value}{isPercentage ? suffix : ''}
      {value >= 85 && <span className="ml-1 text-[10px]">🔥</span>}
    </span>
  );
};
