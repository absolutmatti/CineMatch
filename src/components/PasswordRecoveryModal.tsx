import { useState, type FormEvent } from 'react';
import { CheckCircle2, Eye, EyeOff, Lock, X } from 'lucide-react';

interface PasswordRecoveryModalProps {
  isOpen: boolean;
  onSavePassword: (newPassword: string) => Promise<void>;
  onClose: () => void;
}

export function PasswordRecoveryModal({
  isOpen,
  onSavePassword,
  onClose,
}: PasswordRecoveryModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 6) {
      setErrorMessage('Das neue Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Die eingegebenen Passwörter stimmen nicht überein.');
      return;
    }

    setIsSaving(true);
    try {
      await onSavePassword(newPassword);
      setIsCompleted(true);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setErrorMessage((err as Error).message || 'Das Passwort konnte nicht aktualisiert werden.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-recovery-title"
    >
      <div className="relative w-full max-w-md space-y-5 rounded-2xl border border-[#30303A] bg-[#17171D] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Passwort-Dialog schließen"
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-lg border border-[#30303A] bg-[#1E1E27] text-[#A0A0AD] transition-colors hover:text-[#F5F5F7]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="space-y-1.5 pr-8">
          <p className="text-xs font-medium text-[#B29AF5]">Konto-Wiederherstellung</p>
          <h2
            id="password-recovery-title"
            className="font-display text-xl font-bold tracking-tight text-[#F5F5F7]"
          >
            Neues Passwort festlegen
          </h2>
          <p className="text-sm text-[#A0A0AD]">
            Wähle ein neues Passwort für dein CineMatch-Konto.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
          >
            {errorMessage}
          </div>
        )}

        {isCompleted ? (
          <div className="space-y-4 rounded-xl border border-[#30303A] bg-[#1E1E27] p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#B29AF5]" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#F5F5F7]">Passwort aktualisiert</p>
                <p className="text-xs leading-relaxed text-[#A0A0AD]">
                  Dein neues Passwort wurde erfolgreich gespeichert. Du bist weiterhin angemeldet.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[42px] w-full items-center justify-center rounded-lg bg-[#9275E8] px-4 py-2 text-sm font-semibold text-[#101014] transition-colors hover:bg-[#B29AF5]"
            >
              Weiter zu CineMatch
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="recovery-new-password"
                className="block text-sm font-medium text-[#F5F5F7]"
              >
                Neues Passwort
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#A0A0AD]"
                  aria-hidden="true"
                />
                <input
                  id="recovery-new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mindestens 6 Zeichen"
                  className="h-11 w-full rounded-lg border border-[#30303A] bg-[#1E1E27] pr-11 pl-10 text-sm text-[#F5F5F7] placeholder:text-[#A0A0AD]/60 focus:border-[#9275E8] focus:outline-none"
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

            <div className="space-y-1.5">
              <label
                htmlFor="recovery-confirm-password"
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
                  id="recovery-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Passwort wiederholen"
                  className="h-11 w-full rounded-lg border border-[#30303A] bg-[#1E1E27] pr-4 pl-10 text-sm text-[#F5F5F7] placeholder:text-[#A0A0AD]/60 focus:border-[#9275E8] focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#9275E8] px-4 py-2.5 text-sm font-semibold text-[#101014] transition-colors hover:bg-[#B29AF5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Wird gespeichert…' : 'Neues Passwort speichern'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
