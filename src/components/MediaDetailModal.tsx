import { useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  Eye,
  Film,
  Heart,
  Star,
  ThumbsDown,
  ThumbsUp,
  Tv,
  Users,
  X,
} from 'lucide-react';
import type { FeedbackType, MediaItem, RecommendationResult } from '../types/media';
import { fetchMediaDetails } from '../services/tmdbService';
import { CinemaPoster } from './CinemaPoster';

interface MediaDetailModalProps {
  media: MediaItem | null;
  isFavorite: boolean;
  userFeedback?: FeedbackType;
  recommendation?: RecommendationResult;
  onClose: () => void;
  onToggleFavorite: (media: MediaItem) => void;
  onFeedback: (media: MediaItem, feedback: FeedbackType) => void;
  onMediaEnriched?: (enriched: MediaItem, candidates: MediaItem[]) => void;
}

function formatGermanDate(isoDate: string): string {
  if (!isoDate) return 'Unbekannt';
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
}

export function MediaDetailModal({
  media,
  isFavorite,
  userFeedback,
  recommendation,
  onClose,
  onToggleFavorite,
  onFeedback,
  onMediaEnriched,
}: MediaDetailModalProps) {
  const [backdropFailed, setBackdropFailed] = useState(false);
  const [detailedMedia, setDetailedMedia] = useState<MediaItem | null>(media);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    setBackdropFailed(false);
    setDetailedMedia(media);
  }, [media]);

  useEffect(() => {
    if (!media) return;
    const controller = new AbortController();
    let active = true;
    setIsLoadingDetails(true);

    fetchMediaDetails(media.mediaType, media.tmdbId, controller.signal)
      .then((res) => {
        if (!active) return;
        setIsLoadingDetails(false);
        if (res.item) {
          // Preserve locally generated artwork if live payload has none
          const merged: MediaItem = {
            ...media,
            ...res.item,
            posterUrl: res.item.posterUrl ?? media.posterUrl,
            backdropUrl: res.item.backdropUrl ?? media.backdropUrl,
          };
          setDetailedMedia(merged);
          onMediaEnriched?.(merged, res.recommendations);
        }
      })
      .catch((err: unknown) => {
        if (!active || (err as Error)?.name === 'AbortError') return;
        setIsLoadingDetails(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [media, onMediaEnriched]);

  useEffect(() => {
    if (!media) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [media, onClose]);

  const activeMedia = detailedMedia ?? media;
  if (!activeMedia) return null;

  const hasBackdrop = Boolean(activeMedia.backdropUrl) && !backdropFailed;
  const durationText =
    activeMedia.mediaType === 'movie' && activeMedia.runtimeMinutes
      ? `${activeMedia.runtimeMinutes} Min.`
      : activeMedia.seasonsCount
        ? `${activeMedia.seasonsCount} ${
            activeMedia.seasonsCount === 1 ? 'Staffel' : 'Staffeln'
          }${activeMedia.episodesCount ? ` · ${activeMedia.episodesCount} Episoden` : ''}`
        : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-detail-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-[#30303A] bg-[#17171D] shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Detailansicht schließen"
          className="absolute top-4 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-lg border border-[#30303A] bg-[#101014]/85 text-[#F5F5F7] backdrop-blur-md transition-colors hover:border-[#9275E8] hover:text-[#B29AF5]"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Backdrop header */}
        <div className="relative h-48 w-full overflow-hidden bg-[#101014] sm:h-64">
          {hasBackdrop ? (
            <img
              src={activeMedia.backdropUrl}
              alt={`Szenenbild zu ${activeMedia.title}`}
              referrerPolicy="no-referrer"
              onError={() => setBackdropFailed(true)}
              className="h-full w-full object-cover opacity-75"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background: `linear-gradient(135deg, ${activeMedia.posterTheme.gradientFrom} 0%, #101014 85%)`,
              }}
              aria-hidden="true"
            />
          )}
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#17171D] via-[#17171D]/55 to-transparent"
            aria-hidden="true"
          />
        </div>

        {/* Main Detail Content */}
        <div className="relative -mt-20 px-5 pb-8 sm:-mt-24 sm:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="w-32 shrink-0 sm:w-44">
              <CinemaPoster media={activeMedia} className="border border-[#30303A] shadow-xl" />
            </div>

            <div className="flex-1 space-y-2 pb-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#A0A0AD]">
                <span className="inline-flex items-center gap-1.5 text-[#B29AF5]">
                  {activeMedia.mediaType === 'movie' ? (
                    <Film className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Tv className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {activeMedia.mediaType === 'movie' ? 'Film' : 'Serie'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeMedia.genres.join(' / ')}</span>
              </div>

              <h2
                id="media-detail-title"
                className="font-display text-2xl font-bold tracking-tight text-[#F5F5F7] sm:text-3xl"
              >
                {activeMedia.title}
              </h2>

              {activeMedia.originalTitle && activeMedia.originalTitle !== activeMedia.title && (
                <p className="text-sm text-[#A0A0AD]">
                  Originaltitel: {activeMedia.originalTitle}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-sm text-[#A0A0AD]">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-[#A0A0AD]" aria-hidden="true" />
                  <span>{formatGermanDate(activeMedia.releaseDate)}</span>
                </span>
                {durationText && (
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Clock className="h-4 w-4 text-[#A0A0AD]" aria-hidden="true" />
                    <span>{durationText}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 font-medium text-[#F5F5F7] tabular-nums">
                  <Star className="h-4 w-4 fill-[#B29AF5] text-[#B29AF5]" aria-hidden="true" />
                  <span>{activeMedia.voteAverage.toFixed(1).replace('.', ',')} / 10</span>
                </span>
              </div>
            </div>
          </div>

          {/* Primary Actions Bar */}
          <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-[#30303A] py-4">
            <button
              type="button"
              onClick={() => onToggleFavorite(activeMedia)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                isFavorite
                  ? 'border border-[#9275E8] bg-[#9275E8]/15 text-[#F5F5F7] hover:bg-[#9275E8]/25'
                  : 'bg-[#9275E8] text-[#101014] hover:bg-[#B29AF5]'
              }`}
            >
              <Heart
                className={`h-4 w-4 ${isFavorite ? 'fill-[#9275E8] text-[#B29AF5]' : ''}`}
                aria-hidden="true"
              />
              <span>{isFavorite ? 'In deinen Favoriten' : 'Zu Favoriten hinzufügen'}</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onFeedback(activeMedia, 'like')}
                aria-pressed={userFeedback === 'like'}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  userFeedback === 'like'
                    ? 'border-[#9275E8] bg-[#9275E8]/20 text-[#F5F5F7]'
                    : 'border-[#30303A] bg-[#1E1E27] text-[#A0A0AD] hover:text-[#F5F5F7]'
                }`}
              >
                <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                <span>Gefällt mir</span>
              </button>

              <button
                type="button"
                onClick={() => onFeedback(activeMedia, 'watched')}
                aria-pressed={userFeedback === 'watched'}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  userFeedback === 'watched'
                    ? 'border-[#9275E8] bg-[#9275E8]/20 text-[#F5F5F7]'
                    : 'border-[#30303A] bg-[#1E1E27] text-[#A0A0AD] hover:text-[#F5F5F7]'
                }`}
              >
                {userFeedback === 'watched' ? (
                  <Check className="h-4 w-4 text-[#B29AF5]" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
                <span>Bereits gesehen</span>
              </button>

              <button
                type="button"
                onClick={() => onFeedback(activeMedia, 'dislike')}
                aria-pressed={userFeedback === 'dislike'}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  userFeedback === 'dislike'
                    ? 'border-rose-500/60 bg-rose-500/15 text-rose-200'
                    : 'border-[#30303A] bg-[#1E1E27] text-[#A0A0AD] hover:text-rose-200'
                }`}
              >
                <ThumbsDown className="h-4 w-4" aria-hidden="true" />
                <span>Nicht mein Fall</span>
              </button>
            </div>
          </div>

          {/* Recommendation Explanation when applicable */}
          {recommendation && (
            <div className="mt-5 rounded-xl border border-[#30303A] bg-[#1E1E27] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-[#B29AF5]">Empfehlungsbegründung</p>
                <span className="font-mono text-xs tabular-nums text-[#A0A0AD]">
                  Interner Relevanz-Score: {recommendation.score} / 100
                </span>
              </div>
              <p className="mt-1.5 text-sm text-[#F5F5F7]">{recommendation.reason}</p>
            </div>
          )}

          {/* Overview & Credits */}
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-3 md:col-span-2">
              <h3 className="font-display text-base font-semibold text-[#F5F5F7]">Handlung</h3>
              <p className="text-sm leading-relaxed text-[#A0A0AD] sm:text-[15px]">
                {activeMedia.overview}
              </p>
            </div>

            <div className="space-y-4 border-t border-[#30303A] pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6">
              <div>
                <p className="text-xs font-medium text-[#A0A0AD]">
                  {activeMedia.mediaType === 'movie' ? 'Regie' : 'Schöpfer / Showrunner'}
                </p>
                <p className="mt-1 text-sm font-medium text-[#F5F5F7]">
                  {isLoadingDetails && activeMedia.directorOrCreator.includes('unbekannt')
                    ? 'Wird geladen…'
                    : activeMedia.directorOrCreator}
                </p>
              </div>

              <div>
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A0A0AD]">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Hauptbesetzung</span>
                </p>
                {isLoadingDetails && activeMedia.cast.length === 0 ? (
                  <p className="mt-1.5 text-xs text-[#A0A0AD]">Besetzung wird geladen…</p>
                ) : activeMedia.cast.length > 0 ? (
                  <ul className="mt-1.5 space-y-1 text-sm text-[#F5F5F7]">
                    {activeMedia.cast.map((actor) => (
                      <li key={actor}>{actor}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-xs text-[#A0A0AD]">Keine Besetzungsdaten verfügbar.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
