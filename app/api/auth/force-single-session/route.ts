import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "crypto";

export const runtime = "nodejs";

type ForceSingleSessionPayload = {
  userId: string;
  sessionId?: string | null;
  refreshToken?: string | null;
  sessionFingerprint?: string | null;
};

type AdminRefreshToken = {
  id: string;
  session_id: string | null;
  token?: string | null;
  current?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeAdminRefreshToken(
  value: unknown,
): AdminRefreshToken | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = value.id;
  if (typeof id !== "string" || id.trim().length === 0) {
    return null;
  }

  const sessionIdValue = value.session_id;
  const sessionId =
    typeof sessionIdValue === "string" && sessionIdValue.trim().length > 0
      ? sessionIdValue
      : null;

  const tokenValue = value.token;
  const token =
    typeof tokenValue === "string" && tokenValue.trim().length > 0
      ? tokenValue
      : null;

  const currentValue = value.current;
  const current = typeof currentValue === "boolean" ? currentValue : false;

  return {
    id,
    session_id: sessionId,
    token,
    current,
  };
}

function extractRefreshTokens(payload: unknown): AdminRefreshToken[] {
  if (Array.isArray(payload)) {
    return payload
      .map(normalizeAdminRefreshToken)
      .filter((token): token is AdminRefreshToken => token !== null);
  }

  if (!isRecord(payload)) {
    return [];
  }

  const candidateKeys = [
    "refresh_tokens",
    "tokens",
    "data",
    "sessions",
  ] as const;

  for (const key of candidateKeys) {
    const candidate = payload[key];
    if (Array.isArray(candidate)) {
      return candidate
        .map(normalizeAdminRefreshToken)
        .filter((token): token is AdminRefreshToken => token !== null);
    }
  }

  return [];
}

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }
  return url;
}

function getAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured");
  }
  return key;
}

function getServiceRoleKey() {
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = typeof rawKey === "string" ? rawKey.trim() : rawKey;
  if (!key) {
    return null;
  }
  return key;
}

function parseAuthorizationHeader(request: NextRequest): string | null {
  const header =
    request.headers.get("authorization") ??
    request.headers.get("Authorization");
  if (!header) {
    return null;
  }

  const match = header.match(/^Bearer\s+(.*)$/i);
  return match ? match[1] : null;
}

function normalizeSessionId(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return null;
}

function normalizeRefreshToken(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return null;
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = parseAuthorizationHeader(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing access token" },
        { status: 401 },
      );
    }

    const payload = (await request.json()) as ForceSingleSessionPayload | null;
    if (!payload?.userId) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const sessionId = normalizeSessionId(payload.sessionId);
    const refreshToken = normalizeRefreshToken(payload.refreshToken);
    const refreshTokenHash = refreshToken
      ? hashRefreshToken(refreshToken)
      : null;

    const supabaseUrl = getSupabaseUrl();
    const anonKey = getAnonKey();
    const serviceRoleKey = getServiceRoleKey();

    const supabaseUserClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUserClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.id !== payload.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Single-session enforcement is unavailable. SUPABASE_SERVICE_ROLE_KEY is missing.",
        },
        { status: 503 },
      );
    }

    const adminHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    };

    let revocationWarning: string | null = null;

    try {
      const refreshTokensResponse = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${payload.userId}/refresh_tokens`,
        {
          headers: adminHeaders,
          cache: "no-store",
        },
      );

      if (refreshTokensResponse.status === 404) {
        revocationWarning =
          "Refresh-token admin endpoint is unavailable (404).";
      } else if (!refreshTokensResponse.ok) {
        const message = await refreshTokensResponse.text();
        revocationWarning = `Failed to load refresh tokens: ${refreshTokensResponse.status} ${message}`;
      } else {
        const refreshTokensPayload = (await refreshTokensResponse.json()) as unknown;
        const refreshTokens = extractRefreshTokens(refreshTokensPayload);

        const tokenIdsToKeep = new Set<string>();

        refreshTokens.forEach((token) => {
          const matchesSessionId =
            sessionId && token.session_id && token.session_id === sessionId;
          const matchesHash =
            refreshTokenHash && token.token && token.token === refreshTokenHash;
          const matchesRawToken =
            refreshToken && token.token && token.token === refreshToken;

          if (
            matchesSessionId ||
            matchesHash ||
            matchesRawToken ||
            token.current === true
          ) {
            tokenIdsToKeep.add(token.id);
          }
        });

        let tokensToRevoke = refreshTokens.filter(
          (token) => !tokenIdsToKeep.has(token.id),
        );

        if (
          refreshTokens.length > 0 &&
          tokensToRevoke.length === refreshTokens.length
        ) {
          // If we would revoke every token, keep the most recent one as a safety net.
          const tokenToKeep =
            refreshTokens.find((token) => token.current === true) ??
            refreshTokens[0];
          tokenIdsToKeep.add(tokenToKeep.id);
          tokensToRevoke = refreshTokens.filter(
            (token) => !tokenIdsToKeep.has(token.id),
          );
        }

        const revokeFailures: string[] = [];

        await Promise.all(
          tokensToRevoke.map(async (token) => {
            const revokeResponse = await fetch(
              `${supabaseUrl}/auth/v1/admin/users/${payload.userId}/refresh_tokens/${encodeURIComponent(token.id)}`,
              {
                method: "DELETE",
                headers: adminHeaders,
              },
            );

            if (!revokeResponse.ok) {
              const message = await revokeResponse.text();
              revokeFailures.push(
                `Failed to revoke refresh token ${token.session_id ?? "[unknown session]"}: ${revokeResponse.status} ${message}`,
              );
            }
          }),
        );

        if (revokeFailures.length > 0) {
          revocationWarning = revokeFailures.join(" | ");
        }
      }
    } catch (revocationError) {
      revocationWarning =
        revocationError instanceof Error
          ? revocationError.message
          : String(revocationError);
    }

    if (revocationWarning) {
      console.warn(
        "force-single-session: continuing without full refresh token revocation",
        revocationWarning,
      );
    }

    const sessionFingerprint =
      typeof payload.sessionFingerprint === "string" &&
      payload.sessionFingerprint.trim().length > 0
        ? payload.sessionFingerprint.trim()
        : randomUUID();

    const supabaseProfileClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { error: updateError } = await supabaseProfileClient
      .from("profiles")
      .update({
        active_session_hash: sessionFingerprint,
        active_session_updated_at: new Date().toISOString(),
      })
      .eq("id", payload.userId);

    if (updateError) {
      throw new Error(
        `Failed to record active session: ${updateError.message}`,
      );
    }

    if (revocationWarning) {
      return NextResponse.json(
        {
          ok: true,
          warning:
            "Session hash updated, but refresh token pruning was only partially applied.",
          details: revocationWarning,
        },
        { status: 200 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("force-single-session error:", error);
    return NextResponse.json(
      {
        error: "Failed to enforce single session",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
