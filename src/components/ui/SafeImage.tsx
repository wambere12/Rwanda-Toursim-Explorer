import React, { useState } from 'react';
import { Mountain } from 'lucide-react';

interface SafeImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackLabel,
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`bg-gradient-to-br from-[#123D2B] via-[#16865B]/80 to-[#123D2B] flex flex-col items-center justify-center p-4 text-[#FAF9F5] ${className}`}
        role="img"
        aria-label={alt}
      >
        <Mountain className="w-8 h-8 opacity-80 mb-2" />
        <span className="text-xs font-medium text-center opacity-90 line-clamp-2">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
      loading="lazy"
    />
  );
};
