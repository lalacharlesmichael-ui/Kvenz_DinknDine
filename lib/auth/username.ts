const LEGACY_AUTH_EMAIL_DOMAIN = "auth.kvensplace.app";

function getAuthEmailDomain() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (supabaseUrl) {
      const hostname = new URL(supabaseUrl).hostname;

      if (hostname) {
        return hostname;
      }
    }
  } catch {
    // Fall through to the owned app fallback below.
  }

  return "kvensplace.app";
}

export function normalizeUsername(username: string) {
  return username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

export function usernameToAuthEmail(username: string) {
  const normalized = normalizeUsername(username);

  if (normalized.length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }

  return `${normalized}@${getAuthEmailDomain()}`;
}

export function usernameToAuthEmailCandidates(username: string) {
  const primaryEmail = usernameToAuthEmail(username);
  const legacyEmail = `${normalizeUsername(username)}@${LEGACY_AUTH_EMAIL_DOMAIN}`;

  return primaryEmail === legacyEmail ? [primaryEmail] : [primaryEmail, legacyEmail];
}
