import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { setGrokApiKey } from "../lib/grokApi";
import { storeApiKey } from "../lib/apiKeyStorage";

export default function Login() {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) {
      setError("Please enter your API key.");
      return;
    }
    setError(null);
    storeApiKey(trimmed);
    setGrokApiKey(trimmed);
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";
    navigate(from, { replace: true });
  };

  return (
    <div className="page login-page">
    <div className="login-card">
      <h1>Connect xAI</h1>
      <p className="subtitle">Enter your xAI API key. It stays only in this browser tab and is cleared when the tab is closed or the app is locked.</p>

      <div className="login-help">
        <button
          type="button"
          className="login-help-toggle"
          onClick={() => setHelpOpen((o) => !o)}
          aria-expanded={helpOpen}
        >
          Help: What is an API key? {helpOpen ? "▴" : "▾"}
        </button>
        {helpOpen && (
          <div className="login-explanation">
            <p>
              <strong>What is this?</strong> It’s like a password that lets this app use xAI’s tools. The key stays in this tab, travels only through the app’s private proxy to xAI, and is never logged or saved by this app.
            </p>
            <p>
              <strong>How do I get one?</strong> Go to the{" "}
              <a href="https://console.x.ai" target="_blank" rel="noopener noreferrer">
                xAI Cloud Console
              </a>
              , sign in or sign up (you can use your X account), and create an API key in the dashboard.
            </p>
            <p>
              <strong>Cost.</strong> Using the API is paid — xAI charges you for image and video generation based on your usage.
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="form">
        <label className="block">
          <span>API key</span>
          <input
            type="password"
            className="api-key-input"
            placeholder="xAI API key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="primary-button">
          Continue
        </button>
      </form>
    </div>
    </div>
  );
}
