import React from 'react';

interface CardProps {
  children: React.ReactNode;
  hover?: boolean;
  glass?: boolean;
  className?: string;
}

const Card: React.FC<CardProps> = ({
  children,
  hover = false,
  glass = false,
  className = '',
  ...props
}) => {
  const baseClasses = 'rounded-xl border p-6 transition-all';
  const hoverClasses = hover ? 'card-hover cursor-pointer' : '';
  const glassClasses = glass ? 'glass-light' : 'bg-white border-slate-200 shadow-card';

  return (
    <div className={`${baseClasses} ${hoverClasses} ${glassClasses} ${className}`} {...props}>
      {children}
    </div>
  );
};

export default Card;
