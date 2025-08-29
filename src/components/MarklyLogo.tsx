import React from 'react';

interface MarklyLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

const MarklyLogo: React.FC<MarklyLogoProps> = ({ 
  className = '', 
  size = 'md', 
  showText = true 
}) => {
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-12',
    xl: 'h-16'
  };

  const textSizeClasses = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
    xl: 'text-5xl'
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`${sizeClasses[size]} aspect-square rounded-full gradient-markly flex items-center justify-center shadow-markly`}>
        <svg 
          viewBox="0 0 24 24" 
          className="w-6 h-6 text-white"
          fill="currentColor"
        >
          <path d="M12 2L2 7L12 12L22 7L12 2Z" opacity="0.9" />
          <path d="M2 17L12 22L22 17" opacity="0.7" />
          <path d="M2 12L12 17L22 12" opacity="0.8" />
        </svg>
      </div>
      {showText && (
        <span className={`font-bold gradient-markly bg-clip-text text-transparent ${textSizeClasses[size]}`}>
          Markly
        </span>
      )}
    </div>
  );
};

export default MarklyLogo;