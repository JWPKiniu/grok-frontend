import { useEffect } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { clearStoredApiKey, getStoredApiKey } from "./lib/apiKeyStorage";
import { setGrokApiKey } from "./lib/grokApi";
import ImageToImage from "./pages/ImageToImage";
import ImageToVideo from "./pages/ImageToVideo";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import TextToImage from "./pages/TextToImage";
import "./App.css";

const SITE_TITLE = "Private Grok Studio";
const PAGE_TITLES: Record<string, string> = {
  "/": "Image to Image",
  "/login": "xAI key",
  "/text-to-image": "Text to Image",
  "/image-to-video": "Image to Video",
};

function usePageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const pageTitle = PAGE_TITLES[pathname];
    document.title = pageTitle ? `${pageTitle} — ${SITE_TITLE}` : `Not found — ${SITE_TITLE}`;
  }, [pathname]);
}

type ProtectedLayoutProps = {
  children: React.ReactNode;
  onLock: () => Promise<void>;
};

function ProtectedLayout({ children, onLock }: ProtectedLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const key = getStoredApiKey();

  useEffect(() => {
    if (!key) {
      navigate("/login", { state: { from: { pathname: location.pathname } }, replace: true });
    } else {
      setGrokApiKey(key);
    }
  }, [key, location.pathname, navigate]);

  if (!key) return null;

  const clearApiKey = () => {
    clearStoredApiKey();
    setGrokApiKey(null);
    navigate("/login");
  };

  const lockApp = async () => {
    clearStoredApiKey();
    setGrokApiKey(null);
    try {
      await onLock();
    } catch {
      window.location.reload();
    }
  };

  return (
    <>
      <nav className="nav">
        <span className="nav-brand">Private Grok</span>
        <NavLink to="/" end>Image to Image</NavLink>
        <NavLink to="/text-to-image">Text to Image</NavLink>
        <NavLink to="/image-to-video">Image to Video</NavLink>
        <div className="nav-actions">
          <button type="button" className="nav-logout" onClick={clearApiKey}>Clear API key</button>
          <button type="button" className="nav-lock" onClick={() => void lockApp()}>Lock</button>
        </div>
      </nav>
      <main>{children}</main>
    </>
  );
}

type AppProps = {
  onLock: () => Promise<void>;
};

function App({ onLock }: AppProps) {
  usePageTitle();
  const protect = (page: React.ReactNode) => (
    <ProtectedLayout onLock={onLock}>{page}</ProtectedLayout>
  );

  return (
    <div className="app-layout">
      <div className="app-content">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={protect(<ImageToImage />)} />
          <Route path="/text-to-image" element={protect(<TextToImage />)} />
          <Route path="/image-to-video" element={protect(<ImageToVideo />)} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
