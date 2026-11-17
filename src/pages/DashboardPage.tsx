import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  Compass,
  Eye,
  Heart,
  RefreshCw,
  Search,
  Star,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import type {
  AppRoute,
  FavoriteItem,
  FeedbackType,
  MediaItem,
  RecommendationResult,
  UserRating,
} from '../types/media';
import { MediaCard } from '../components/MediaCard';
import { CinemaPoster } from '../components/CinemaPoster';
import { EmptyState } from '../components/EmptyState';

interface DashboardPageProps {
  displayName: string;
  favorites: FavoriteItem[];
  favoriteMediaItems: MediaItem[];
  movieRecommendations: RecommendationResult[];
  seriesRecommendations: RecommendationResult[];
  spotlightRecommendation?: RecommendationResult;
  ratingsByMediaId: Map<string, UserRating>;
  onNavigate: (route: AppRoute, options?: { initialQuery?: string }) => void;
  onOpenDetail: (media: MediaItem) => void;
  onToggleFavorite: (media: MediaItem) => void;
  onFeedback: (media: MediaItem, feedback: FeedbackType) => void;
  onRefreshRecommendations: () => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export function DashboardPage({
  displayName,
  favorites,
  favoriteMediaItems,
  movieRecommendations,
  seriesRecommendations,
  spotlightRecommendation,
  ratingsByMediaId,
  onNavigate,
  onOpenDetail,
  onToggleFavorite,
  onFeedback,
  onRefreshRecommendations,
}: DashboardPageProps) {
  const [quickQuery, setQuickQuery] = useState('');
  const favoriteIds = new Set(favorites.map((f) => f.mediaId));

  const handleQuickSearch = (event: FormEvent) => {
    event.preventDefault();
    onNavigate('discover', { initialQuery: quickQuery.trim() });
  };

  const recentFavorites = favoriteMediaItems.slice(0, 5);

  return (
    <div className="space-y-12">
      {/* Personalized Greeting & Quick Search Entry */}
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[#B29AF5]">Dein persönliches Kino-Briefing</p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[#F5F5F7] sm:text-4xl">
            {getGreeting()}, {displayName}
          </h1>
          <p className="text-sm text-[#A0A0AD] sm:text-base">
            {favorites.length > 0
              ? `Deine Empfehlungen basieren aktuell auf ${
                  favorites.length === 1
                    ? 'einem gespeicherten Favoriten'
                    : `${favorites.length} gespeicherten Favoriten`
                }.`
              : 'Füge deine ersten Lieblingsfilme oder -serien hinzu, um persönliche Vorschläge zu erhalten.'}
          </p>
        </div>

        <form onSubmit={handleQuickSearch} className="flex w-full gap-2 lg:max-w-md">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#A0A0AD]"
              aria-hidden="true"
            />
            <input
              type="text"
              inputMode="search"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              aria-label="Schnellsuche nach Filmen oder Serien"
              placeholder="Film oder Serie schnell suchen…"
              className="h-11 w-full rounded-lg border border-[#30303A] bg-[#17171D] pr-4 pl-10 text-sm text-[#F5F5F7] placeholder:text-[#A0A0AD]/60 focus:border-[#9275E8] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#30303A] bg-[#1E1E27] px-4 py-2 text-sm font-medium text-[#F5F5F7] transition-colors hover:border-[#9275E8] whitespace-nowrap shrink-0"
          >
            Suchen
          </button>
        </form>
      </section>

      {/* Prominent Spotlight Recommendation */}
      {spotlightRecommendation ? (
        <section aria-labelledby="spotlight-heading">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2
              id="spotlight-heading"
              className="font-display text-lg font-semibold text-[#F5F5F7]"
            >
              Top-Empfehlung für dich
            </h2>
            <button
              type="button"
              onClick={onRefreshRecommendations}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#30303A] bg-[#17171D] px-3 py-1.5 text-xs font-medium text-[#A0A0AD] transition-colors hover:border-[#9275E8]/60 hover:text-[#F5F5F7] whitespace-nowrap shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Neu mischen</span>
            </button>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-[#30303A] bg-[#17171D]">
            {/* Backdrop Artwork */}
            <div className="pointer-events-none absolute inset-0">
              <img
                src={
                  spotlightRecommendation.media.backdropUrl ??
                  '/src/assets/images/cinema_hero_backdrop_1794870405404.jpg'
                }
                alt=""
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover opacity-35"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#101014] via-[#101014]/88 to-[#101014]/55" />
            </div>

            <div className="relative z-10 grid grid-cols-1 gap-6 p-5 sm:p-8 lg:grid-cols-12 lg:items-center">
              <div className="hidden sm:block lg:col-span-3">
                <button
                  type="button"
                  onClick={() => onOpenDetail(spotlightRecommendation.media)}
                  aria-label={`Details zu „${spotlightRecommendation.media.title}“ öffnen`}
                  className="block w-full max-w-[200px] overflow-hidden rounded-xl border border-[#30303A] shadow-2xl transition-transform hover:scale-[1.02]"
                >
                  <CinemaPoster media={spotlightRecommendation.media} />
                </button>
              </div>

              <div className="space-y-4 lg:col-span-9">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-[#A0A0AD]">
                  <span className="text-[#B29AF5]">
                    {spotlightRecommendation.media.mediaType === 'movie' ? 'Film' : 'Serie'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {spotlightRecommendation.media.releaseDate.slice(0, 4)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{spotlightRecommendation.media.genres.join(', ')}</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[#F5F5F7]">
                    <Star className="h-3.5 w-3.5 fill-[#B29AF5] text-[#B29AF5]" aria-hidden="true" />
                    {spotlightRecommendation.media.voteAverage.toFixed(1).replace('.', ',')}
                  </span>
                </div>

                <div>
                  <h3 className="font-display text-2xl font-bold tracking-tight text-[#F5F5F7] sm:text-4xl">
                    {spotlightRecommendation.media.title}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#A0A0AD] sm:text-[15px]">
                    {spotlightRecommendation.media.overview}
                  </p>
                </div>

                {/* Transparent Score + Explanation */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span className="font-mono font-medium tabular-nums text-[#B29AF5]">
                    Interner Relevanz-Score: {spotlightRecommendation.score} / 100
                  </span>
                  <span className="text-[#A0A0AD]" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-[#F5F5F7]">{spotlightRecommendation.reason}</span>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => onOpenDetail(spotlightRecommendation.media)}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#9275E8] px-5 py-2.5 text-sm font-semibold text-[#101014] transition-colors hover:bg-[#B29AF5] whitespace-nowrap shrink-0"
                  >
                    <span>Details ansehen</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleFavorite(spotlightRecommendation.media)}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#30303A] bg-[#1E1E27]/90 px-4 py-2.5 text-sm font-medium text-[#F5F5F7] transition-colors hover:border-[#9275E8] whitespace-nowrap shrink-0"
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        favoriteIds.has(spotlightRecommendation.media.id)
                          ? 'fill-[#9275E8] text-[#B29AF5]'
                          : ''
                      }`}
                      aria-hidden="true"
                    />
                    <span>
                      {favoriteIds.has(spotlightRecommendation.media.id)
                        ? 'Gespeichert'
                        : 'Zu Favoriten'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onFeedback(spotlightRecommendation.media, 'like')}
                    aria-label={`„${spotlightRecommendation.media.title}“ positiv bewerten`}
                    className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      ratingsByMediaId.get(spotlightRecommendation.media.id)?.feedback === 'like'
                        ? 'border-[#9275E8] bg-[#9275E8]/20 text-[#F5F5F7]'
                        : 'border-[#30303A] bg-[#17171D]/90 text-[#A0A0AD] hover:text-[#F5F5F7]'
                    }`}
                  >
                    <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                    <span>Gefällt mir</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onFeedback(spotlightRecommendation.media, 'watched')}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#30303A] bg-[#17171D]/90 px-3.5 py-2 text-xs font-medium text-[#A0A0AD] transition-colors hover:text-[#F5F5F7] whitespace-nowrap shrink-0"
                  >
                    {ratingsByMediaId.get(spotlightRecommendation.media.id)?.feedback ===
                    'watched' ? (
                      <Check className="h-4 w-4 text-[#B29AF5]" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>Bereits gesehen</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onFeedback(spotlightRecommendation.media, 'dislike')}
                    aria-label={`„${spotlightRecommendation.media.title}“ nicht mehr empfehlen`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#30303A] bg-[#17171D]/90 px-3.5 py-2 text-xs font-medium text-[#A0A0AD] transition-colors hover:border-rose-500/40 hover:text-rose-200 whitespace-nowrap shrink-0"
                  >
                    <ThumbsDown className="h-4 w-4" aria-hidden="true" />
                    <span>Nicht mein Fall</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <EmptyState
          icon={<Compass className="h-6 w-6" />}
          title="Noch keine Empfehlungen verfügbar"
          description="Sobald du mindestens einen Lieblingsfilm oder eine Lieblingsserie gespeichert hast, erstellt CineMatch passende Empfehlungen für dich."
          actionLabel="Jetzt Titel entdecken"
          onAction={() => onNavigate('discover')}
        />
      )}

      {/* Recommended Movies */}
      {movieRecommendations.length > 0 && (
        <section aria-labelledby="rec-movies-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2
                id="rec-movies-heading"
                className="font-display text-xl font-semibold text-[#F5F5F7]"
              >
                Empfohlene Filme
              </h2>
              <p className="text-xs text-[#A0A0AD]">
                Gewichtet nach Genre, Themen, Regie, Erzählstil und Beliebtheit
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('discover')}
              className="text-xs font-medium text-[#B29AF5] hover:underline whitespace-nowrap shrink-0"
            >
              Alle entdecken
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {movieRecommendations.slice(0, 4).map((rec) => (
              <MediaCard
                key={rec.id}
                media={rec.media}
                isFavorite={favoriteIds.has(rec.media.id)}
                userFeedback={ratingsByMediaId.get(rec.media.id)?.feedback}
                recommendation={rec}
                onOpenDetail={onOpenDetail}
                onToggleFavorite={onToggleFavorite}
                onFeedback={onFeedback}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recommended Series */}
      {seriesRecommendations.length > 0 && (
        <section aria-labelledby="rec-series-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2
                id="rec-series-heading"
                className="font-display text-xl font-semibold text-[#F5F5F7]"
              >
                Empfohlene Serien
              </h2>
              <p className="text-xs text-[#A0A0AD]">
                Abgestimmt auf deine bisherigen Serien- und Filmfavoriten
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('discover')}
              className="text-xs font-medium text-[#B29AF5] hover:underline whitespace-nowrap shrink-0"
            >
              Mehr suchen
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {seriesRecommendations.slice(0, 4).map((rec) => (
              <MediaCard
                key={rec.id}
                media={rec.media}
                isFavorite={favoriteIds.has(rec.media.id)}
                userFeedback={ratingsByMediaId.get(rec.media.id)?.feedback}
                recommendation={rec}
                onOpenDetail={onOpenDetail}
                onToggleFavorite={onToggleFavorite}
                onFeedback={onFeedback}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recently Added Favorites */}
      <section aria-labelledby="recent-favs-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2
              id="recent-favs-heading"
              className="font-display text-xl font-semibold text-[#F5F5F7]"
            >
              Zuletzt hinzugefügte Favoriten
            </h2>
            <p className="text-xs text-[#A0A0AD]">
              Deine aktuell gespeicherte Grundlage für neue Empfehlungen
            </p>
          </div>
          {favorites.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('favorites')}
              className="text-xs font-medium text-[#B29AF5] hover:underline whitespace-nowrap shrink-0"
            >
              Alle {favorites.length} ansehen
            </button>
          )}
        </div>

        {recentFavorites.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {recentFavorites.map((item) => (
              <MediaCard
                key={item.id}
                media={item}
                isFavorite={favoriteIds.has(item.id)}
                onOpenDetail={onOpenDetail}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Heart className="h-6 w-6" />}
            title="Noch keine Favoriten gespeichert"
            description="Speichere Filme und Serien, die du liebst, damit sie hier erscheinen und deine Empfehlungen verbessern."
            actionLabel="Titel entdecken"
            onAction={() => onNavigate('discover')}
          />
        )}
      </section>
    </div>
  );
}
