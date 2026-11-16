import { useState } from 'react';
import { Film, Tv } from 'lucide-react';
import type { MediaItem } from '../types/media';

interface CinemaPosterProps {
  media: MediaItem;
  className?: string;
  sizes?: string;
  showEditorialTitleOverlay?: boolean;
  compact?: boolean;
}

/**
 * Aspect-ratio locked (2:3) poster artwork component.
 * Uses verified local artwork or TMDB poster URL when available, and gracefully
 * renders a curated minimalist typographic cinema poster when no image URL exists
 * or if an external image fails to load.
 */
export function CinemaPoster({
  media,
  className = '',
  showEditorialTitleOverlay = true,
  compact = false,
}: CinemaPosterProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const year = media.releaseDate ? media.releaseDate.slice(0, 4) : '';
  const hasRealImage = Boolean(media.posterUrl) && !imgFailed;

  return (
    <div
      className={`relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-[#17171D] ${className}`}
      style={
        !hasRealImage
          ? {
              background: `linear-gradient(155deg, ${media.posterTheme.gradientFrom} 0%, ${media.posterTheme.gradientTo} 100%)`,
            }
          : undefined
      }
    >
      {hasRealImage ? (
        <img
          src={media.posterUrl}
          alt={`Film- oder Serienposter zu ${media.title}`}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
        />
      ) : (
        <div
          className={`relative flex h-full w-full flex-col justify-between select-none ${
            compact ? 'p-3' : 'p-4'
          }`}
        >
          {/* Subtle geometric motif */}
          <PosterMotif motif={media.posterTheme.motif} color={media.posterTheme.accentLine} />

          {/* Keep top-right corner clear for floating card favorite/select button */}
          <div className="relative z-10 flex items-center gap-1.5 pr-11 text-[11px] font-medium tracking-wide text-[#A0A0AD]">
            <span className="inline-flex items-center gap-1">
              {media.mediaType === 'movie' ? (
                <Film className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Tv className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>{media.mediaType === 'movie' ? 'Film' : 'Serie'}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{year}</span>
          </div>

          {showEditorialTitleOverlay && (
            <div className="relative z-10 space-y-1.5 min-w-0">
              <div
                className="h-px w-8"
                style={{ backgroundColor: media.posterTheme.accentLine }}
                aria-hidden="true"
              />
              <p
                className={`font-display leading-tight font-semibold tracking-tight text-[#F5F5F7] break-words line-clamp-3 ${
                  compact ? 'text-[15px]' : 'text-base sm:text-lg'
                }`}
              >
                {media.title}
              </p>
              <p className="text-xs text-[#A0A0AD] truncate">{media.directorOrCreator}</p>
            </div>
          )}
        </div>
      )}

      {/* Subtle top-to-bottom edge vignette for depth */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#101014]/55 via-transparent to-transparent"
        aria-hidden="true"
      />
    </div>
  );
}

function PosterMotif({
  motif,
  color,
}: {
  motif: MediaItem['posterTheme']['motif'];
  color: string;
}) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
      viewBox="0 0 200 300"
      fill="none"
      aria-hidden="true"
    >
      {motif === 'orbit' && (
        <>
          <circle cx="115" cy="120" r="68" stroke={color} strokeWidth="0.9" />
          <circle cx="115" cy="120" r="42" stroke={color} strokeWidth="0.6" strokeDasharray="3 4" />
          <line x1="24" y1="220" x2="176" y2="68" stroke={color} strokeWidth="0.5" />
        </>
      )}
      {motif === 'monolith' && (
        <>
          <rect x="68" y="54" width="64" height="148" stroke={color} strokeWidth="0.9" />
          <line x1="100" y1="30" x2="100" y2="230" stroke={color} strokeWidth="0.5" />
        </>
      )}
      {motif === 'grid' && (
        <>
          <line x1="40" y1="60" x2="160" y2="60" stroke={color} strokeWidth="0.6" />
          <line x1="40" y1="120" x2="160" y2="120" stroke={color} strokeWidth="0.6" />
          <line x1="40" y1="180" x2="160" y2="180" stroke={color} strokeWidth="0.6" />
          <line x1="80" y1="40" x2="80" y2="210" stroke={color} strokeWidth="0.6" />
          <line x1="120" y1="40" x2="120" y2="210" stroke={color} strokeWidth="0.6" />
        </>
      )}
      {motif === 'horizon' && (
        <>
          <circle cx="100" cy="128" r="46" stroke={color} strokeWidth="0.9" />
          <line x1="18" y1="145" x2="182" y2="145" stroke={color} strokeWidth="0.8" />
          <line x1="36" y1="158" x2="164" y2="158" stroke={color} strokeWidth="0.5" />
        </>
      )}
      {motif === 'frame' && (
        <>
          <rect x="34" y="48" width="132" height="176" stroke={color} strokeWidth="0.7" />
          <rect x="48" y="62" width="104" height="148" stroke={color} strokeWidth="0.5" />
        </>
      )}
    </svg>
  );
}
