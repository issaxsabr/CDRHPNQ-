
import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'danger-light' | 'glass' | 'glass-danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  rounded?: 'default' | 'full' | 'md' | 'lg';
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  className = '',
  rounded = 'lg',
  fullWidth = false,
  ...props
}) => {
  const baseClasses = 'btn-modern inline-flex items-center justify-center font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none btn-ripple';

  const variantClasses: Record<ButtonVariant, string> = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md border border-transparent',
    secondary: 'bg-white text-earth-700 border border-slate-200 hover:bg-slate-50 hover:text-earth-900 shadow-sm', // Modifié pour être plus proche de la spec UI du prompt
    danger: 'bg-rose-500 text-white hover:bg-rose-600 shadow-md',
    ghost: 'bg-transparent text-earth-700 hover:bg-slate-100',
    outline: 'bg-white text-earth-900 border border-slate-300 hover:border-slate-400',
    'danger-light': 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100',
    glass: 'bg-white/10 text-beige-100 border border-white/20 hover:bg-white/20 backdrop-blur-sm shadow-sm',
    'glass-danger': 'bg-white/10 text-rose-300 border border-rose-200/20 hover:bg-rose-500/30 backdrop-blur-sm shadow-sm'
  };

  const sizeClasses: Record<ButtonSize, string> = {
    xs: 'px-2 py-1 text-[10px] gap-1',
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-2.5 text-base gap-2.5',
    icon: 'p-2 aspect-square flex items-center justify-center'
  };

  const roundedClasses = {
      default: "rounded",
      md: "rounded-md",
      lg: "rounded-lg",
      full: "rounded-full"
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${roundedClasses[rounded]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className={`animate-spin ${size === 'xs' || size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`} />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      {children}
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
};

export default Button;
