import { useMemo, useState, type FormEvent } from 'react';
import {
  BookmarkPlus,
  Check,
  Copy,
  Eye,
  Film,
  ListChecks,
  RefreshCw,
  Star,
  Trash2,
  Tv,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  FavoriteItem,
  FeedbackType,
  FriendConnection,
  MediaItem,
  MediaType,
  SharedWatchlistItem,
  UserProfile,
  UserRating,
} from '../types/media';
import { generateGroupRecommendations } from '../engine/groupMatchEngine';
import { CinemaPoster } from '../components/CinemaPoster';
import { EmptyState } from '../components/EmptyState';

interface SocialMatchPageProps {
  profile: UserProfile;
  isDemoMode: boolean;
  catalog: MediaItem[];
  userFavorites: FavoriteItem[];
  userRatings: UserRating[];
  connections: FriendConnection[];
  watchlist: SharedWatchlistItem[];
  selectedFriendId: string | null;
  migrationMissing?: boolean;
  isLoadingSocial?: boolean;
  onSelectFriend: (connectionId: string) => void;
  onSendFriendRequest: (username: string) => Promise<void>;
  onAcceptFriendRequest: (connectionId: string) => Promise<void>;
  onRemoveConnection: (connectionId: string) => Promise<void>;
  onAddToSharedWatchlist: (connectionId: string, media: MediaItem) => Promise<void>;
  onToggleWatchlistWatched: (itemId: string, watched: boolean) => Promise<void>;
  onRemoveWatchlistItem: (itemId: string) => Promise<void>;
  onOpenDetail: (media: MediaItem) => void;
  onFeedback: (media: MediaItem, feedback: FeedbackType) => void;
  onGoToDiscover: () => void;
}

export function SocialMatchPage({
  profile,
  isDemoMode,
  catalog,
  userFavorites,
  userRatings,
  connections,
  watchlist,
  selectedFriendId,
  migrationMissing = false,
  isLoadingSocial = false,
  onSelectFriend,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onRemoveConnection,
  onAddToSharedWatchlist,
  onToggleWatchlistWatched,
  onRemoveWatchlistItem,
  onOpenDetail,
  onFeedback,
  onGoToDiscover,
}: SocialMatchPageProps) {
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [copiedUsername, setCopiedUsername] = useState(false);

  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | MediaType>('all');
  const [shuffleOffset, setShuffleOffset] = useState<string[]>([]);

  const acceptedConnections = useMemo(
    () => connections.filter((c) => c.status === 'accepted'),
    [connections]
  );
  const incomingRequests = useMemo(
    () => connections.filter((c) => c.status === 'pending' && c.direction === 'incoming'),
    [connections]
  );
  const outgoingRequests = useMemo(
    () => connections.filter((c) => c.status === 'pending' && c.direction === 'outgoing'),
    [connections]
  );

  const activeConnection = useMemo(() => {
    if (acceptedConnections.length === 0) return null;
    return (
      acceptedConnections.find((c) => c.id === selectedFriendId) ?? acceptedConnections[0]
    );
  }, [acceptedConnections, selectedFriendId]);

  const activeWatchlist = useMemo(() => {
    if (!activeConnection) return [];
    return watchlist.filter((item) => item.friendshipId === activeConnection.id);
  }, [watchlist, activeConnection]);

  const watchlistMediaIds = useMemo(
    () => new Set(activeWatchlist.map((w) => w.mediaId)),
    [activeWatchlist]
  );

  const matchSummary = useMemo(() => {
    if (!activeConnection) return null;
    return generateGroupRecommendations({
      catalog,
      userA: {
        id: profile.id,
        displayName: profile.displayName,
        favorites: userFavorites,
        ratings: userRatings,
      },
      userB: {
        id: activeConnection.friend.id,
        displayName: activeConnection.friend.displayName,
        favorites: activeConnection.favorites,
        ratings: activeConnection.ratings,
      },
      mediaTypeFilter,
      previouslyShownIds: shuffleOffset,
      limit: 8,
    });
  }, [
    activeConnection,
    catalog,
    profile.id,
    profile.displayName,
    userFavorites,
    userRatings,
    mediaTypeFilter,
    shuffleOffset,
  ]);

  const catalogMap = useMemo(() => new Map(catalog.map((m) => [m.id, m])), [catalog]);

  const handleCopyUsername = async () => {
    try {
      await navigator.clipboard.writeText(`@${profile.username}`);
      setCopiedUsername(true);
      window.setTimeout(() => setCopiedUsername(false), 2200);
    } catch {
      // Clipboard API unavailable in restricted contexts
    }
  };

  const handleSendInvite = async (event: FormEvent) => {
    event.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);

    const cleaned = inviteUsername.trim().replace(/^@+/, '');
    if (cleaned.length < 2) {
      setInviteError('Bitte gib einen gültigen Benutzernamen (mindestens 2 Zeichen) ein.');
      return;
    }

    setIsSending(true);
    try {
      await onSendFriendRequest(cleaned);
      setInviteUsername('');
      setInviteSuccess(
        isDemoMode
          ? `@${cleaned} wurde zu deinen Demo-Verbindungen hinzugefügt.`
          : `Anfrage an @${cleaned} wurde gesendet.`
      );
      window.setTimeout(() => setInviteSuccess(null), 3500);
    } catch (err) {
      setInviteError((err as Error).message || 'Anfrage konnte nicht gesendet werden.');
    } finally {
      setIsSending(false);
    }
  };

  const handleShuffle = () => {
    if (!matchSummary) return;
    const topIds = matchSummary.recommendations.slice(0, 4).map((r) => r.media.id);
    setShuffleOffset((prev) => Array.from(new Set([...prev, ...topIds])));
  };

  const friendFirstName =
    activeConnection?.friend.displayName.split(' ')[0] ?? 'Partner';

  return (
    <div className="space-y-10">
      {/* Header & Own Username Share */}
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[#B29AF5]">Gemeinsamer Filmabend</p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[#F5F5F7] sm:text-4xl">
            Duo-Match
          </h1>
          <p className="max-w-2xl text-sm text-[#A0A0AD] sm:text-base">
            Verbinde dich mit Freundinnen oder Freunden und entdecke Filme und Serien, die eure
            Geschmäcker fair ausbalancieren.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#30303A] bg-[#17171D] px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-[11px] text-[#A0A0AD]">Dein Benutzername zum Teilen</p>
            <p className="font-mono text-sm font-medium text-[#F5F5F7]">@{profile.username}</p>
          </div>
          <button
            type="button"
            onClick={handleCopyUsername}
            aria-label="Eigenen Benutzernamen kopieren"
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#30303A] bg-[#1E1E27] px-3 py-1.5 text-xs font-medium text-[#F5F5F7] transition-colors hover:border-[#9275E8] whitespace-nowrap shrink-0"
          >
            {copiedUsername ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#B29AF5]" aria-hidden="true" />
                <span>Kopiert</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Kopieren</span>
              </>
            )}
          </button>
        </div>
      </section>

      {migrationMissing && (
        <div
          role="status"
          className="rounded-xl border border-[#9275E8]/40 bg-[#1E1E27] p-4 text-sm text-[#F5F5F7]"
        >
          <p className="font-medium text-[#B29AF5]">
            Datenbank-Migration für Duo-Match ausstehend
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#A0A0AD]">
            Führe im Supabase SQL-Editor die Migration{' '}
            <code className="font-mono text-[#F5F5F7]">003_social_matching.sql</code> aus, um
            Freundschaftsverbindungen und gemeinsame Watchlists dauerhaft zu speichern.
          </p>
        </div>
      )}

      {/* Connections & Friend Invite Panel */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Invite by username */}
        <div className="space-y-4 rounded-2xl border border-[#30303A] bg-[#17171D] p-5 sm:p-6 lg:col-span-5">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-semibold text-[#F5F5F7]">
              Mit Freunden verbinden
            </h2>
            <p className="text-xs text-[#A0A0AD]">
              {isDemoMode
                ? 'Teste die Einladung im Demo-Modus z. B. mit @tom.richter.'
                : 'Gib den CineMatch-Benutzernamen der anderen Person ein.'}
            </p>
          </div>

          <form onSubmit={handleSendInvite} className="flex flex-col gap-2.5 sm:flex-row">
            <input
              type="text"
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              aria-label="Freund über Benutzernamen einladen"
              placeholder="@benutzername"
              className="h-11 min-h-[44px] w-full rounded-lg border border-[#30303A] bg-[#1E1E27] px-3.5 text-sm text-[#F5F5F7] placeholder:text-[#A0A0AD]/60 focus:border-[#9275E8] focus:outline-none sm:flex-1"
            />
            <button
              type="submit"
              disabled={isSending}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#9275E8] px-4 py-2 text-xs font-semibold text-[#101014] transition-colors hover:bg-[#B29AF5] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              <span>{isSending ? 'Sendet…' : 'Anfrage senden'}</span>
            </button>
          </form>

          {inviteError && (
            <p role="alert" className="text-xs text-rose-300">
              {inviteError}
            </p>
          )}
          {inviteSuccess && (
            <p role="status" className="text-xs text-[#B29AF5]">
              {inviteSuccess}
            </p>
          )}

          {/* Incoming & Outgoing Pending Requests */}
          {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
            <div className="space-y-2 border-t border-[#30303A] pt-4">
              <p className="text-xs font-medium text-[#A0A0AD]">Offene Anfragen</p>
              <ul className="divide-y divide-[#30303A]">
                {incomingRequests.map((req) => (
                  <li
                    key={req.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-1 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#F5F5F7] truncate">
                        {req.friend.displayName}
                      </p>
                      <p className="font-mono text-xs text-[#A0A0AD]">
                        @{req.friend.username} · Eingehend
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onAcceptFriendRequest(req.id)}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#9275E8] px-3 py-1.5 text-xs font-semibold text-[#101014] transition-colors hover:bg-[#B29AF5] whitespace-nowrap shrink-0"
                      >
                        <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Annehmen</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveConnection(req.id)}
                        aria-label={`Anfrage von ${req.friend.displayName} ablehnen`}
                        className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg border border-[#30303A] bg-[#1E1E27] px-2.5 py-1.5 text-xs text-[#A0A0AD] transition-colors hover:text-rose-200"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}

                {outgoingRequests.map((req) => (
                  <li
                    key={req.id}
                    className="flex items-center justify-between gap-2 py-2.5 first:pt-1 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#F5F5F7] truncate">
                        {req.friend.displayName}
                      </p>
                      <p className="font-mono text-xs text-[#A0A0AD]">
                        @{req.friend.username} · Ausstehend
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveConnection(req.id)}
                      className="inline-flex min-h-[38px] items-center rounded-lg border border-[#30303A] bg-[#1E1E27] px-3 py-1.5 text-xs text-[#A0A0AD] transition-colors hover:text-rose-200 whitespace-nowrap shrink-0"
                    >
                      Zurückziehen
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Connected Friends Selector */}
        <div className="space-y-4 rounded-2xl border border-[#30303A] bg-[#17171D] p-5 sm:p-6 lg:col-span-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#F5F5F7]">
                Aktive Duo-Partner
              </h2>
              <p className="text-xs text-[#A0A0AD]">
                Wähle eine Verbindung aus, um gemeinsame Empfehlungen zu berechnen.
              </p>
            </div>
            <span className="font-mono text-xs tabular-nums text-[#A0A0AD] whitespace-nowrap shrink-0">
              {acceptedConnections.length}{' '}
              {acceptedConnections.length === 1 ? 'Verbindung' : 'Verbindungen'}
            </span>
          </div>

          {isLoadingSocial ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="h-20 animate-pulse rounded-xl border border-[#30303A] bg-[#1E1E27]" />
              <div className="h-20 animate-pulse rounded-xl border border-[#30303A] bg-[#1E1E27]" />
            </div>
          ) : acceptedConnections.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {acceptedConnections.map((conn) => {
                const isSelected = activeConnection?.id === conn.id;
                const initials = conn.friend.displayName
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase() ?? '')
                  .join('');

                return (
                  <div
                    key={conn.id}
                    className={`flex items-center justify-between gap-2 rounded-xl border p-3.5 transition-colors ${
                      isSelected
                        ? 'border-[#9275E8] bg-[#1E1E27]'
                        : 'border-[#30303A] bg-[#101014]/50 hover:border-[#9275E8]/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectFriend(conn.id);
                        setShuffleOffset([]);
                      }}
                      aria-pressed={isSelected}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border font-display text-sm font-bold ${
                          isSelected
                            ? 'border-[#9275E8] bg-[#9275E8]/20 text-[#F5F5F7]'
                            : 'border-[#30303A] bg-[#1E1E27] text-[#B29AF5]'
                        }`}
                      >
                        {initials || <Users className="h-4 w-4" aria-hidden="true" />}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-semibold text-[#F5F5F7] truncate">
                          {conn.friend.displayName}
                        </p>
                        <p className="font-mono text-xs text-[#A0A0AD] truncate">
                          @{conn.friend.username}
                        </p>
                        <p className="font-mono text-[11px] tabular-nums text-[#B29AF5]">
                          {conn.favorites.length}{' '}
                          {conn.favorites.length === 1 ? 'Favorit' : 'Favoriten'}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemoveConnection(conn.id)}
                      aria-label={`Verbindung mit ${conn.friend.displayName} trennen`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#A0A0AD] transition-colors hover:bg-[#17171D] hover:text-rose-200"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="Noch keine aktiven Verbindungen"
              description="Sende links eine Anfrage über den Benutzernamen oder nimm eine eingehende Anfrage an, um gemeinsame Empfehlungen freizuschalten."
            />
          )}
        </div>
      </section>

      {/* Active Duo-Match Recommendations & Shared Watchlist */}
      {activeConnection && matchSummary && (
        <>
          {/* Shared Taste Analysis */}
          <section className="space-y-5 rounded-2xl border border-[#30303A] bg-[#17171D] p-5 sm:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-[#B29AF5]">Gemeinsame Schnittmenge</p>
                <h2 className="font-display text-2xl font-bold text-[#F5F5F7]">
                  Du &amp; {activeConnection.friend.displayName}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div
                  role="group"
                  aria-label="Duo-Empfehlungen nach Medientyp filtern"
                  className="flex items-center gap-1 rounded-xl border border-[#30303A] bg-[#101014] p-1"
                >
                  {(
                    [
                      { id: 'all', label: 'Alle' },
                      { id: 'movie', label: 'Filme' },
                      { id: 'tv', label: 'Serien' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMediaTypeFilter(tab.id)}
                      aria-pressed={mediaTypeFilter === tab.id}
                      className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        mediaTypeFilter === tab.id
                          ? 'bg-[#9275E8] text-[#101014]'
                          : 'text-[#A0A0AD] hover:text-[#F5F5F7]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleShuffle}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-[#30303A] bg-[#1E1E27] px-3.5 py-2 text-xs font-medium text-[#F5F5F7] transition-colors hover:border-[#9275E8] whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Neu mischen</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 border-t border-[#30303A] pt-5 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs text-[#A0A0AD]">Gemeinsame Lieblingsgenres</p>
                <p className="text-sm font-medium text-[#F5F5F7]">
                  {matchSummary.sharedGenres.length > 0
                    ? matchSummary.sharedGenres
                        .slice(0, 4)
                        .map((g) => g.genre)
                        .join(' · ')
                    : 'Noch keine direkte Genre-Überschneidung'}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-[#A0A0AD]">Gemeinsame Favoriten</p>
                {matchSummary.sharedFavorites.length > 0 ? (
                  <p className="text-sm font-medium text-[#F5F5F7]">
                    {matchSummary.sharedFavorites.map((m) => m.title).join(' · ')}
                  </p>
                ) : (
                  <p className="text-sm text-[#A0A0AD]">
                    Noch keine identischen Favoriten gespeichert
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-xs text-[#A0A0AD]">Filterstatus</p>
                <p className="font-mono text-sm tabular-nums text-[#F5F5F7]">
                  {matchSummary.excludedCount}{' '}
                  {matchSummary.excludedCount === 1
                    ? 'bereits gesehener/abgelehnter Titel'
                    : 'bereits gesehene/abgelehnte Titel'}{' '}
                  ausgeblendet
                </p>
              </div>
            </div>
          </section>

          {/* Balanced Duo Recommendations Grid */}
          <section aria-labelledby="duo-recs-heading" className="space-y-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2
                  id="duo-recs-heading"
                  className="font-display text-xl font-semibold text-[#F5F5F7]"
                >
                  Ausbalancierte Duo-Empfehlungen
                </h2>
                <p className="text-xs text-[#A0A0AD]">
                  Harmonisch gewichtet, damit weder dein Geschmack noch der von {friendFirstName}{' '}
                  dominiert – inklusive Ausschluss von Titeln, die mindestens eine Person schon
                  kennt.
                </p>
              </div>
            </div>

            {activeConnection.favorites.length === 0 ? (
              <EmptyState
                icon={<Users className="h-6 w-6" />}
                title={`${activeConnection.friend.displayName} hat noch keine Favoriten`}
                description="Sobald ihr beide mindestens einen Lieblingsfilm oder eine Lieblingsserie gespeichert habt, berechnet CineMatch eure gemeinsamen Empfehlungen."
              />
            ) : userFavorites.length === 0 ? (
              <EmptyState
                icon={<Film className="h-6 w-6" />}
                title="Speichere zuerst eigene Favoriten"
                description="Um deinen Geschmack mit dem deiner Verbindung abzugleichen, benötigt CineMatch mindestens einen eigenen Favoriten."
                actionLabel="Titel entdecken"
                onAction={onGoToDiscover}
              />
            ) : matchSummary.recommendations.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {matchSummary.recommendations.map((rec) => {
                  const onWatchlist = watchlistMediaIds.has(rec.media.id);
                  const year = rec.media.releaseDate ? rec.media.releaseDate.slice(0, 4) : '—';

                  return (
                    <article
                      key={rec.id}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-[#30303A] bg-[#1E1E27] transition-colors hover:border-[#9275E8]/60"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenDetail(rec.media)}
                        aria-label={`Details zu „${rec.media.title}“ öffnen`}
                        className="relative block w-full overflow-hidden text-left"
                      >
                        <CinemaPoster media={rec.media} />
                      </button>

                      <div className="flex flex-1 flex-col justify-between gap-4 p-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#A0A0AD]">
                            <span className="inline-flex items-center gap-1 text-[#B29AF5]">
                              {rec.media.mediaType === 'movie' ? (
                                <Film className="h-3 w-3" aria-hidden="true" />
                              ) : (
                                <Tv className="h-3 w-3" aria-hidden="true" />
                              )}
                              {rec.media.mediaType === 'movie' ? 'Film' : 'Serie'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{year}</span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[#F5F5F7]">
                              <Star
                                className="h-3 w-3 fill-[#B29AF5] text-[#B29AF5]"
                                aria-hidden="true"
                              />
                              {rec.media.voteAverage.toFixed(1).replace('.', ',')}
                            </span>
                          </div>

                          <h3 className="font-display text-base font-semibold leading-snug text-[#F5F5F7]">
                            <button
                              type="button"
                              onClick={() => onOpenDetail(rec.media)}
                              className="text-left transition-colors hover:text-[#B29AF5]"
                            >
                              {rec.media.title}
                            </button>
                          </h3>

                          <p className="text-xs text-[#A0A0AD] line-clamp-1">
                            {rec.media.genres.slice(0, 3).join(' · ')}
                          </p>

                          {/* Balanced Score Breakdown */}
                          <div className="space-y-1 border-t border-[#30303A] pt-2.5">
                            <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                              <span className="text-[#B29AF5]">Duo-Score: {rec.score}/100</span>
                              <span className="text-[#A0A0AD]">
                                Du {rec.userAScore} · {friendFirstName} {rec.userBScore}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-[#A0A0AD] line-clamp-2">
                              {rec.reason}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={onWatchlist}
                            onClick={() => onAddToSharedWatchlist(activeConnection.id, rec.media)}
                            className={`inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                              onWatchlist
                                ? 'border border-[#9275E8]/50 bg-[#9275E8]/15 text-[#B29AF5]'
                                : 'bg-[#9275E8] text-[#101014] hover:bg-[#B29AF5]'
                            }`}
                          >
                            {onWatchlist ? (
                              <>
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Auf Watchlist</span>
                              </>
                            ) : (
                              <>
                                <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Auf Watchlist</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => onFeedback(rec.media, 'watched')}
                            aria-label={`„${rec.media.title}“ als bereits gesehen markieren`}
                            title="Bereits gesehen"
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#30303A] bg-[#17171D] text-[#A0A0AD] transition-colors hover:border-[#9275E8] hover:text-[#F5F5F7]"
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<RefreshCw className="h-6 w-6" />}
                title="Keine weiteren ungesehenen Duo-Treffer im Filter"
                description="Setze den Medientyp-Filter auf „Alle“ oder entdecke weitere Titel über die Suche, um euren gemeinsamen Pool zu erweitern."
                actionLabel="Mehr Titel entdecken"
                onAction={onGoToDiscover}
              />
            )}
          </section>

          {/* Shared Watchlist */}
          <section aria-labelledby="shared-watchlist-heading" className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2
                  id="shared-watchlist-heading"
                  className="font-display text-xl font-semibold text-[#F5F5F7]"
                >
                  Gemeinsame Watchlist mit {activeConnection.friend.displayName}
                </h2>
                <p className="text-xs text-[#A0A0AD]">
                  Titel, die ihr euch für kommende Film- und Serienabende vorgemerkt habt
                </p>
              </div>
              <span className="font-mono text-xs tabular-nums text-[#A0A0AD]">
                {activeWatchlist.length} {activeWatchlist.length === 1 ? 'Titel' : 'Titel'}
              </span>
            </div>

            {activeWatchlist.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {activeWatchlist.map((entry) => {
                  const resolvedMedia =
                    catalogMap.get(entry.mediaId) ??
                    entry.mediaSnapshot ?? {
                      id: entry.mediaId,
                      tmdbId: entry.tmdbId,
                      mediaType: entry.mediaType,
                      title: entry.title,
                      releaseDate: '',
                      overview: 'Details werden bei Auswahl geladen.',
                      genres: ['Drama'],
                      keywords: [],
                      storyCharacteristics: [],
                      directorOrCreator: 'Unbekannt',
                      cast: [],
                      voteAverage: 0,
                      popularity: 50,
                      posterUrl: entry.posterUrl,
                      posterTheme: {
                        gradientFrom: '#1C1B29',
                        gradientTo: '#101016',
                        accentLine: '#9275E8',
                        motif: 'frame',
                      },
                    };

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-4 rounded-2xl border border-[#30303A] bg-[#1E1E27] p-3.5"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenDetail(resolvedMedia)}
                        aria-label={`Details zu „${entry.title}“ öffnen`}
                        className="w-16 shrink-0 overflow-hidden rounded-lg border border-[#30303A]"
                      >
                        <CinemaPoster media={resolvedMedia} />
                      </button>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-[#A0A0AD]">
                          <span className="text-[#B29AF5]">
                            {entry.mediaType === 'movie' ? 'Film' : 'Serie'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Von {entry.addedByName}</span>
                          {entry.watched && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#F5F5F7]">Gesehen</span>
                            </>
                          )}
                        </div>

                        <h3 className="font-display text-base font-semibold text-[#F5F5F7] truncate">
                          <button
                            type="button"
                            onClick={() => onOpenDetail(resolvedMedia)}
                            className="text-left transition-colors hover:text-[#B29AF5]"
                          >
                            {entry.title}
                          </button>
                        </h3>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => onToggleWatchlistWatched(entry.id, !entry.watched)}
                            aria-pressed={entry.watched}
                            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                              entry.watched
                                ? 'border-[#9275E8] bg-[#9275E8]/20 text-[#F5F5F7]'
                                : 'border-[#30303A] bg-[#17171D] text-[#A0A0AD] hover:text-[#F5F5F7]'
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>
                              {entry.watched ? 'Gesehen' : 'Als gesehen markieren'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onRemoveWatchlistItem(entry.id)}
                            aria-label={`„${entry.title}“ von der gemeinsamen Watchlist entfernen`}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#30303A] bg-[#17171D] px-2.5 py-1.5 text-xs text-[#A0A0AD] transition-colors hover:text-rose-200 whitespace-nowrap shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Entfernen</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<ListChecks className="h-6 w-6" />}
                title="Eure gemeinsame Watchlist ist noch leer"
                description="Füge oben direkt aus euren Duo-Empfehlungen Filme oder Serien hinzu, die ihr zusammen ansehen möchtet."
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
