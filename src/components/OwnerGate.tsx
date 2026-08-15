import { useCallback, useEffect, useState } from "react";
import { hasOwnerAccess, lockOwnerAccess, unlockOwnerAccess } from "../lib/ownerAccess";

type Props = {
  children: (lock: () => Promise<void>) => React.ReactNode;
};

export default function OwnerGate({ children }: Props) {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    hasOwnerAccess(controller.signal)
      .then(setAllowed)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Private-access check failed.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    return () => controller.abort();
  }, []);

  const unlock = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError(null);
    try {
      await unlockOwnerAccess(password);
      setPassword("");
      setAllowed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Private-access check failed.");
    } finally {
      setSubmitting(false);
    }
  }, [password]);

  const lock = useCallback(async () => {
    await lockOwnerAccess();
    setAllowed(false);
  }, []);

  if (checking) {
    return (
      <div className="page login-page" aria-live="polite">
        <div className="login-card access-card">
          <span className="spinner" /> Checking private access…
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="page login-page">
        <div className="login-card access-card">
          <div className="access-lock" aria-hidden>🔒</div>
          <h1>Private generator</h1>
          <p className="subtitle">This generator is locked for its owner. Generated media is not published by the app.</p>
          <form className="form" onSubmit={unlock}>
            <label className="block">
              <span>Private-access password</span>
              <input
                type="password"
                className="api-key-input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                autoFocus
              />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button type="submit" className="primary-button" disabled={submitting || !password}>
              {submitting ? <><span className="spinner" /> Unlocking…</> : "Unlock"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return children(lock);
}
