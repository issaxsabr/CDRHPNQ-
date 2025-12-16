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
  className = ''
}) => {
  const baseClasses = 'rounded-xl border p-6 transition-all';
  const hoverClasses = hover ? 'card-hover cursor-pointer' : '';
  const glassClasses = glass ? 'glass backdrop-blur-xl' : 'bg-white border-beige-300 shadow-elegant';

  return (
    <div className={`${baseClasses} ${hoverClasses} ${glassClasses} ${className}`}>
      {children}
    </div>
  );
};

export default Card;