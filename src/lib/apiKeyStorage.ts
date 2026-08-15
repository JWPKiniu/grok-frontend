const API_KEY_STORAGE = "grok-api-key";
const LEGACY_COOKIE = "grok-api-key";

function clearLegacyCookie(): void {
  document.cookie = `${LEGACY_COOKIE}=; path=/; max-age=0; SameSite=Strict`;
}

export function getStoredApiKey(): string | null {
  clearLegacyCookie();
  return sessionStorage.getItem(API_KEY_STORAGE);
}

export function storeApiKey(key: string): void {
  clearLegacyCookie();
  sessionStorage.setItem(API_KEY_STORAGE, key.trim());
}

export function clearStoredApiKey(): void {
  clearLegacyCookie();
  sessionStorage.removeItem(API_KEY_STORAGE);
}
