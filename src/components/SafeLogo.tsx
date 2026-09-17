import React, { useEffect, useState } from 'react';

interface SafeLogoProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  fallbackClassName?: string;
}

export const SafeLogo: React.FC<SafeLogoProps> = ({
  src,
  alt,
  className = '',
  fallback,
  fallbackClassName = '',
}) => {
  const [failed, setFailed] = useState(!src);

  useEffect(() => {
    setFailed(!src);
  }, [src]);

  if (failed || !src) {
    return (
      <div
        className={fallbackClassName}
        role="img"
        aria-label={alt}
        title={alt}
      >
        {fallback ?? alt.slice(0, 3).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
};

export default SafeLogo;
