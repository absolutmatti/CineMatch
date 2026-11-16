import { Check, Eye, Heart, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { FeedbackType, MediaItem, RecommendationResult } from '../types/media';
import { CinemaPoster } from './CinemaPoster';

interface MediaCardProps {
  media: MediaItem;
  isFavorite: boolean;
  userFeedback?: FeedbackType;
  recommendation?: RecommendationResult;
  onOpenDetail: (media: MediaItem) => void;
  onToggleFavorite: (media: MediaItem) => void;
  onFeedback?: (media: MediaItem, feedback: FeedbackType) => void;
}

/**
 * Primary film/series card following zero-pill metadata discipline and single-elevation borders.
 */
export function MediaCard({
  media,
  isFavorite,
  userFeedback,
  recommendation,
  onOpenDetail,
  onToggleFavorite,
  onFeedback,
}: MediaCardProps) {
  const year = media.releaseDate ? media.releaseDate.slice(0, 4) : '—';
  const typeLabel = media.mediaType === 'movie' ? 'Film' : 'Serie';
  const primaryGenres = media.genres.slice(0, 2).join(', ');

  return (
    <article className="group flex min-w-0 flex-col rounded-xl border border-[#30303A] bg-[#1E1E27] p-3 transition-colors duration-150 hover:border-[#49495A]">
      <div className="relative">
        <button
          type="button"
          onClick={() => onOpenDetail(media)}
          aria-label={`Details zu „${media.title}“ öffnen`}
          className="block w-full overflow-hidden rounded-lg text-left focus-visible:outline-none"
        >
          <CinemaPoster media={media} />
        </button>

        {/* Favorite toggle button with accessible >= 44px mobile touch target */}
        <button
          type="button"
          onClick={() => onToggleFavorite(media)}
          aria-label={
            isFavorite
              ? `„${media.title}“ aus Favoriten entfernen`
              : `„${media.title}“ zu Favoriten hinzufügen`
          }
          aria-pressed={isFavorite}
          className={`absolute top-2 right-2 z-10 flex h-11 w-11 items-center justify-center rounded-lg border backdrop-blur-md transition-colors duration-150 ${
            isFavorite
              ? 'border-[#9275E8]/60 bg-[#9275E8]/25 text-[#F5F5F7]'
              : 'border-[#30303A] bg-[#101014]/75 text-[#A0A0AD] hover:border-[#9275E8]/50 hover:text-[#F5F5F7]'
          }`}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-[#9275E8] text-[#B29AF5]' : ''}`} />
        </button>
      </div>

      <div className="mt-3 flex min-w-0 flex-1 flex-col justify-between gap-2.5">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onOpenDetail(media)}
            className="text-left font-display text-base font-semibold leading-snug text-[#F5F5F7] transition-colors hover:text-[#B29AF5] line-clamp-1"
          >
            {media.title}
          </button>

          {/* Unboxed metadata with typographic separators */}
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[#A0A0AD]">
            <span>{typeLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{year}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 tabular-nums text-[#F5F5F7]">
              <Star className="h-3 w-3 fill-[#B29AF5] text-[#B29AF5]" aria-hidden="true" />
              {media.voteAverage.toFixed(1).replace('.', ',')}
            </span>
          </div>

          <p className="mt-1 text-xs text-[#A0A0AD] truncate">{primaryGenres}</p>
        </div>

        {recommendation && (
          <div className="border-t border-[#30303A] pt-2.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[#A0A0AD]">Relevanz-Score</span>
              <span className="font-mono font-medium tabular-nums text-[#B29AF5]">
                {recommendation.score} / 100
              </span>
            </div>
            <p className="text-xs leading-relaxed text-[#A0A0AD] line-clamp-2">
              {recommendation.reason}
            </p>

            {onFeedback && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => onFeedback(media, 'like')}
                  aria-label={`Empfehlung „${media.title}“ gefällt mir`}
                  aria-pressed={userFeedback === 'like'}
                  className={`flex min-h-[36px] min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                    userFeedback === 'like'
                      ? 'border-[#9275E8] bg-[#9275E8]/20 text-[#F5F5F7]'
                      : 'border-[#30303A] bg-[#17171D] text-[#A0A0AD] hover:border-[#4A4A5A] hover:text-[#F5F5F7]'
                  }`}
                >
                  <ThumbsUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Top</span>
                </button>
                <button
                  type="button"
                  onClick={() => onFeedback(media, 'watched')}
                  aria-label={`„${media.title}“ als bereits gesehen markieren`}
                  aria-pressed={userFeedback === 'watched'}
                  className="flex min-h-[36px] min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-[#30303A] bg-[#17171D] px-2 py-1.5 text-xs font-medium text-[#A0A0AD] transition-colors hover:border-[#4A4A5A] hover:text-[#F5F5F7]"
                >
                  {userFeedback === 'watched' ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#B29AF5]" aria-hidden="true" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate">Gesehen</span>
                </button>
                <button
                  type="button"
                  onClick={() => onFeedback(media, 'dislike')}
                  aria-label={`Empfehlung „${media.title}“ ausblenden`}
                  className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-[#30303A] bg-[#17171D] px-2 py-1.5 text-xs text-[#A0A0AD] transition-colors hover:border-rose-500/40 hover:text-rose-300"
                  title="Nicht mein Fall"
                >
                  <ThumbsDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
