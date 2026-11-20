import "server-only";
import { google } from "googleapis";
import type { Credentials } from "google-auth-library";
import { nowIso } from "@/lib/db";
import {
  deleteOAuthAccount,
  getOAuthAccount,
  saveOAuthAccount,
  type OAuthAccountRecord,
} from "@/lib/db/repo";
import { decrypt, encrypt } from "@/lib/crypto";
import { googleConfigured, googleOAuth, GOOGLE_SCOPES } from "@/lib/config";
import type { GoogleConnection } from "@/lib/types";

export type StoredGoogleAccount = {
  owner: string;
  email: string | null;
  scopes: string[];
  tokens: Credentials;
  connectedAt: string;
};

export class GoogleNotConfiguredError extends Error {
  constructor() {
    super("Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
    this.name = "GoogleNotConfiguredError";
  }
}

export class GoogleNotConnectedError extends Error {
  constructor() {
    super("Google Workspace is not connected for this workspace.");
    this.name = "GoogleNotConnectedError";
  }
}

export class GoogleReconnectRequiredError extends Error {
  constructor(detail = "Google access expired or was revoked.") {
    super(detail);
    this.name = "GoogleReconnectRequiredError";
  }
}

export function createOAuthClient() {
  if (!googleConfigured) throw new GoogleNotConfiguredError();
  return new google.auth.OAuth2(googleOAuth.clientId, googleOAuth.clientSecret, googleOAuth.redirectUri);
}

export function buildConsentUrl(state: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: GOOGLE_SCOPES,
    state,
    login_hint: process.env.HIREVOICE_GOOGLE_HINT || undefined,
  });
}

export async function exchangeCode(code: string): Promise<{
  tokens: Credentials;
  email: string | null;
  scopes: string[];
}> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  let email: string | null = null;
  try {
    const info = await google.oauth2({ version: "v2", auth: client }).userinfo.get();
    email = info.data.email ?? null;
  } catch {
    /* email is nice to have, not required */
  }

  const scopes = (tokens.scope ?? GOOGLE_SCOPES.join(" "))
    .split(/\s+/)
    .map((scope) => scope.replace("https://www.googleapis.com/auth/", ""))
    .filter(Boolean);

  return { tokens, email, scopes };
}

export async function saveGoogleAccount(
  owner: string,
  tokens: Credentials,
  email: string | null,
  scopes: string[],
) {
  const at = nowIso();
  const existing = await getOAuthAccount(owner, "google");

  // Keep the refresh token when Google omits it on a repeat consent.
  let merged = tokens;
  if (existing && !tokens.refresh_token) {
    const previous = decrypt(existing.tokens);
    if (previous) {
      try {
        const parsed = JSON.parse(previous) as Credentials;
        merged = { ...parsed, ...tokens, refresh_token: parsed.refresh_token };
      } catch {
        /* keep new tokens */
      }
    }
  }

  const expiry = typeof merged.expiry_date === "number" ? merged.expiry_date : null;
  const record: OAuthAccountRecord = {
    owner,
    provider: "google",
    email: email ?? existing?.email ?? null,
    tokens: encrypt(JSON.stringify(merged)),
    scopes: scopes.join(" "),
    expiry,
    createdAt: existing?.createdAt ?? at,
    updatedAt: at,
  };
  await saveOAuthAccount(record);
}

export async function getGoogleAccount(owner: string): Promise<StoredGoogleAccount | null> {
  const row = await getOAuthAccount(owner, "google");
  if (!row) return null;
  const decrypted = decrypt(row.tokens);
  if (!decrypted) return null;
  try {
    const tokens = JSON.parse(decrypted) as Credentials;
    return {
      owner: row.owner,
      email: row.email,
      scopes: row.scopes.split(" ").filter(Boolean),
      tokens,
      connectedAt: row.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function deleteGoogleAccount(owner: string) {
  const account = await getGoogleAccount(owner);
  if (account?.tokens.refresh_token || account?.tokens.access_token) {
    const client = createOAuthClient();
    client.setCredentials(account.tokens);
    client.revokeCredentials().catch(() => {
      /* revocation is best effort */
    });
  }
  await deleteOAuthAccount(owner, "google");
}

/** Returns an OAuth2 client with a fresh access token, or throws. */
export async function getAuthorizedClient(owner: string) {
  const account = await getGoogleAccount(owner);
  if (!account) throw new GoogleNotConnectedError();

  const client = createOAuthClient();
  client.setCredentials(account.tokens);

  client.on("tokens", (fresh) => {
    const merged = { ...account.tokens, ...fresh };
    void saveGoogleAccount(owner, merged, account.email, account.scopes).catch(() => {
      /* a background refresh write must not break the request */
    });
  });

  try {
    await client.getAccessToken();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("invalid_grant") || message.includes("invalid_request")) {
      await deleteGoogleAccount(owner);
      throw new GoogleReconnectRequiredError();
    }
    throw error;
  }

  return { client, account };
}

export async function googleConnection(owner: string): Promise<GoogleConnection> {
  const account = await getGoogleAccount(owner);
  return {
    configured: googleConfigured,
    connected: Boolean(account),
    email: account?.email ?? null,
    scopes: account?.scopes ?? [],
    connectedAt: account?.connectedAt ?? null,
  };
}

export async function hasScope(owner: string, scope: string) {
  const account = await getGoogleAccount(owner);
  if (!account) return false;
  return account.scopes.some((entry) => entry === scope || entry.endsWith(scope));
}
