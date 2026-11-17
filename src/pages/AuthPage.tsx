import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Film, Lock, Mail, User } from 'lucide-react';
import type { AuthView } from '../types/media';
import { resolveAppAssetUrl } from '../lib/assets';

interface AuthPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (
    displayName: string,
    email: string,
    password: string
  ) => Promise<{ requiresEmailConfirmation?: boolean }>;
  onResetPassword: (email: string) => Promise<void>;
  onDemoLogin: () => void;
}

export function AuthPage({
  onLogin,
  onRegister,
  onResetPassword,
  onDemoLogin,
}: AuthPageProps) {
  const [view, setView] = useState<AuthView>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  const switchView = (nextView: AuthView) => {
    setView(nextView);
    setErrorMessage(null);
    setConfirmationMessage(null);
  };

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setConfirmationMessage(null);

    if (!validateEmail(email)) {
      setErrorMessage('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }

    if (view === 'reset') {
      setIsSubmitting(true);
      try {
        await onResetPassword(email.trim());
        setConfirmationMessage(
          `Falls ein Konto für ${email.trim()} existiert, wurde ein Link zum Zurücksetzen des Passworts vorbereitet.`
        );
      } catch (err) {
        setErrorMessage((err as Error).message || 'Zurücksetzen fehlgeschlagen.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    if (view === 'register') {
      if (displayName.trim().length < 2) {
        setErrorMessage('Bitte gib deinen Namen oder Anzeigenamen ein (mindestens 2 Zeichen).');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Die eingegebenen Passwörter stimmen nicht überein.');
        return;
      }
      setIsSubmitting(true);
      try {
        const res = await onRegister(displayName.trim(), email.trim(), password);
        if (res.requiresEmailConfirmation) {
          setConfirmationMessage(
            `Konto erstellt! Bitte bestätige deine E-Mail-Adresse über den Link an ${email.trim()}.`
          );
        }
      } catch (err) {
        setErrorMessage((err as Error).message || 'Registrierung fehlgeschlagen.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      setErrorMessage((err as Error).message || 'Anmeldung fehlgeschlagen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#101014] text-[#F5F5F7] lg:grid lg:grid-cols-12">
      {/* Left Brand & Editorial Showcase Column */}
      <div className="relative hidden overflow-hidden border-r border-[#30303A] bg-[#17171D] lg:col-span-6 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <img
          src={resolveAppAssetUrl('/src/assets/images/cinema_hero_backdrop_1794870405404.jpg')}
          alt="CineMatch Kino-Atmosphäre"
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#101014] via-[#101014]/70 to-[#101014]/50"
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-center gap-2.5">
          <Film className="h-5 w-5 text-[#B29AF5]" aria-hidden="true" />
          <span className="font-display text-xl font-bold tracking-tight">CineMatch</span>
        </div>

        <div className="relative z-10 max-w-lg space-y-5">
          <p className="text-xs font-medium tracking-wide text-[#B29AF5]">
            Kuratierte Entdeckung für Film- und Serienliebhaber
          </p>
          <h1 className="font-display text-4xl leading-tight font-bold tracking-tight text-[#F5F5F7]">
            Finde Filme und Serien, die wirklich zu deinem Geschmack passen.
          </h1>
          <p className="text-base leading-relaxed text-[#A0A0AD]">
            Speichere deine Lieblingstitel, bewerte Empfehlungen mit einem Klick und erhalte
            transparente Vorschläge auf Basis realer Genres, Themen und Handschriften.
          </p>
        </div>

        <p className="relative z-10 text-xs text-[#A0A0AD]">
          Dieses Produkt nutzt die TMDB-API, wird jedoch weder von TMDB unterstützt noch
          zertifiziert.
        </p>
      </div>

      {/* Right Authentication Form Column */}
      <div className="flex min-h-screen flex-col justify-center px-5 py-10 sm:px-8 lg:col-span-6 lg:px-16">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div className="flex items-center justify-between lg:hidden">
            <span className="font-display text-xl font-bold tracking-tight text-[#F5F5F7]">
              CineMatch
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-2xl font-bold tracking-tight text-[#F5F5F7] sm:text-3xl">
              {view === 'login' && 'Willkommen zurück'}
              {view === 'register' && 'Konto erstellen'}
              {view === 'reset' && 'Passwort zurücksetzen'}
            </h2>
            <p className="text-sm text-[#A0A0AD]">
              {view === 'login' &&
                'Melde dich an, um auf deine Favoriten und persönlichen Empfehlungen zuzugreifen.'}
              {view === 'register' &&
                'Erstelle dein CineMatch-Profil und starte mit deinen ersten Lieblingsfilmen.'}
              {view === 'reset' &&
                'Gib deine E-Mail-Adresse ein, um einen Link zum Zurücksetzen zu erhalten.'}
            </p>
          </div>

          {/* Segmented Switch between Login & Register */}
          {view !== 'reset' && (
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-[#30303A] bg-[#17171D] p-1">
              <button
                type="button"
                onClick={() => switchView('login')}
                className={`min-h-[40px] rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  view === 'login'
                    ? 'bg-[#1E1E27] text-[#F5F5F7]'
                    : 'text-[#A0A0AD] hover:text-[#F5F5F7]'
                }`}
              >
                Anmelden
              </button>
              <button
                type="button"
                onClick={() => switchView('register')}
                className={`min-h-[40px] rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  view === 'register'
                    ? 'bg-[#1E1E27] text-[#F5F5F7]'
                    : 'text-[#A0A0AD] hover:text-[#F5F5F7]'
                }`}
              >
                Registrieren
              </button>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
            >
              {errorMessage}
            </div>
          )}

          {confirmationMessage ? (
            <div className="space-y-4 rounded-xl border border-[#30303A] bg-[#17171D] p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#B29AF5]" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#F5F5F7]">E-Mail-Hinweis</p>
                  <p className="text-sm leading-relaxed text-[#A0A0AD]">{confirmationMessage}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => switchView('login')}
                className="inline-flex min-h-[42px] w-full items-center justify-center rounded-lg border border-[#30303A] bg-[#1E1E27] px-4 py-2 text-sm font-medium text-[#F5F5F7] hover:border-[#9275E8]"
              >
                Zurück zur Anmeldung
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {view === 'register' && (
                <div className="space-y-1.5">
                  <label htmlFor="auth-name" className="block text-sm font-medium text-[#F5F5F7]">
                    Anzeigename
                  </label>
                  <div className="relative">
                    <User
                      className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#A0A0AD]"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-name"
                      type="text"
                      autoComplete="name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="z. B. Jonas Weber"
                      className="h-11 w-full rounded-lg border border-[#30303A] bg-[#17171D] pr-4 pl-10 text-sm text-[#F5F5F7] placeholder:text-[#A0A0AD]/60 focus:border-[#9275E8] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="auth-email" className="block text-sm font-medium text-[#F5F5F7]">
                  E-Mail-Adresse
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#A0A0AD]"
                    aria-hidden="true"
                  />
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@beispiel.de"
                    className="h-11 w-full rounded-lg border border-[#30303A] bg-[#17171D] pr-4 pl-10 text-sm text-[#F5F5F7] placeholder:text-[#A0A0AD]/60 focus:border-[#9275E8] focus:outline-none"
                  />
                </div>
              </div>

              {view !== 'reset' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="auth-password"
                      className="block text-sm font-medium text-[#F5F5F7]"
                    >
                      Passwort
                    </label>
                    {view === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchView('reset')}
                        className="text-xs font-medium text-[#B29AF5] hover:underline"
                      >
                        Passwort vergessen?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#A0A0AD]"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={view === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mindestens 6 Zeichen"
                      className="h-11 w-full rounded-lg border border-[#30303A] bg-[#17171D] pr-11 pl-10 text-sm text-[#F5F5F7] placeholder:text-[#A0A0AD]/60 focus:border-[#9275E8] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                      className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-[#A0A0AD] hover:text-[#F5F5F7]"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {view === 'register' && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="auth-password-confirm"
                    className="block text-sm font-medium text-[#F5F5F7]"
                  >
                    Passwort bestätigen
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#A0A0AD]"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-password-confirm"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Passwort wiederholen"
                      className="h-11 w-full rounded-lg border border-[#30303A] bg-[#17171D] pr-4 pl-10 text-sm text-[#F5F5F7] placeholder:text-[#A0A0AD]/60 focus:border-[#9275E8] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#9275E8] px-4 py-2.5 text-sm font-semibold text-[#101014] transition-colors hover:bg-[#B29AF5] disabled:opacity-60"
              >
                <span>
                  {isSubmitting
                    ? 'Wird verarbeitet…'
                    : view === 'login'
                      ? 'Anmelden'
                      : view === 'register'
                        ? 'Konto erstellen & starten'
                        : 'Link zum Zurücksetzen anfordern'}
                </span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>

              {view === 'reset' && (
                <button
                  type="button"
                  onClick={() => switchView('login')}
                  className="inline-flex min-h-[40px] w-full items-center justify-center text-sm font-medium text-[#A0A0AD] hover:text-[#F5F5F7]"
                >
                  Zurück zur Anmeldung
                </button>
              )}
            </form>
          )}

          {/* Direct demo exploration entry */}
          <div className="border-t border-[#30303A] pt-6 space-y-3">
            <p className="text-xs leading-relaxed text-[#A0A0AD]">
              Möchtest du die Oberfläche sofort mit realistischen Beispieldaten erkunden?
            </p>
            <button
              type="button"
              onClick={onDemoLogin}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-[#30303A] bg-[#17171D] px-4 py-2.5 text-sm font-medium text-[#F5F5F7] transition-colors hover:border-[#9275E8]/60 hover:bg-[#1E1E27]"
            >
              Mit Demo-Konto direkt fortfahren
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
