import React from 'react';

interface FocusRingProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const FocusRing: React.FC<FocusRingProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-10 h-4 -bottom-1',
    md: 'w-16 h-6 -bottom-2',
    lg: 'w-24 h-8 -bottom-3',
  };

  return (
    <div className={`absolute left-1/2 -translate-x-1/2 pointer-events-none z-10 flex items-center justify-center ${sizeClasses[size]} ${className}`}>
      {/* Semi-transparent amber pulsing oval ring */}
      <div className="absolute inset-0 rounded-[50%] border-2 border-amber-400 bg-amber-400/25 animate-ping opacity-75" />
      <div className="absolute inset-0 rounded-[50%] border-2 border-amber-500 bg-amber-400/35 shadow-[0_0_12px_rgba(245,158,11,0.5)]" />
      {/* Small side arrow pointing to character feet */}
      <span className="absolute -right-3 -top-2 text-amber-500 font-bold text-xs select-none animate-bounce">
        ◀
      </span>
    </div>
  );
};
