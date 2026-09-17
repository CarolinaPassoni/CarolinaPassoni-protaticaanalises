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
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadedSrc(null);

    if (!src || typeof window === 'undefined') return;

    // Só coloca a imagem no DOM depois de confirmar que ela realmente carregou.
    // Assim URLs externas inválidas/bloqueadas nunca exibem o ícone quebrado.
    const probe = new Image();
    probe.referrerPolicy = 'no-referrer';
    probe.onload = () => {
      if (!cancelled) setLoadedSrc(src);
    };
    probe.onerror = () => {
      if (!cancelled) setLoadedSrc(null);
    };
    probe.src = src;

    return () => {
      cancelled = true;
      probe.onload = null;
      probe.onerror = null;
    };
  }, [src]);

  if (!src || loadedSrc !== src) {
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
      src={loadedSrc}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setLoadedSrc(null)}
    />
  );
};

export default SafeLogo;
