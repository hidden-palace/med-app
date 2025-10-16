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
  session_id: string | null;
  token?: string | null;
  current?: boolean;
};

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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
      console.warn(
        "force-single-session: SUPABASE_SERVICE_ROLE_KEY is not configured. Skipping refresh token revocation.",
      );
    } else {
      const adminHeaders = {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      };

      const refreshTokensResponse = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${payload.userId}/refresh_tokens`,
        {
          headers: adminHeaders,
          cache: "no-store",
        },
      );

      if (!refreshTokensResponse.ok) {
        const message = await refreshTokensResponse.text();
        throw new Error(
          `Failed to load refresh tokens: ${refreshTokensResponse.status} ${message}`,
        );
      }

      const refreshTokens =
        (await refreshTokensResponse.json()) as AdminRefreshToken[];

      const tokensToRevoke: Array<{ token: AdminRefreshToken; index: number }> =
        [];

      refreshTokens.forEach((token, index) => {
        const matchesSessionId =
          sessionId && token.session_id && token.session_id === sessionId;
        const matchesHash =
          refreshTokenHash && token.token && token.token === refreshTokenHash;

        const shouldKeep =
          matchesSessionId ||
          matchesHash ||
          (!sessionId && !refreshTokenHash && token.current === true);

        if (shouldKeep) {
          return;
        }

        tokensToRevoke.push({ token, index });
      });

      if (
        refreshTokens.length > 0 &&
        tokensToRevoke.length === refreshTokens.length
      ) {
        const currentIndex = refreshTokens.findIndex(
          (token) => token.current === true,
        );
        if (currentIndex >= 0) {
          const revokeIndex = tokensToRevoke.findIndex(
            (entry) => entry.index === currentIndex,
          );
          if (revokeIndex >= 0) {
            tokensToRevoke.splice(revokeIndex, 1);
          }
        }
        if (tokensToRevoke.length === refreshTokens.length) {
          tokensToRevoke.pop();
        }
      }

      await Promise.all(
        tokensToRevoke.map(async ({ token }) => {
          if (!token.session_id) {
            return;
          }

          const revokeResponse = await fetch(
            `${supabaseUrl}/auth/v1/admin/users/${payload.userId}/refresh_tokens/${token.session_id}`,
            {
              method: "DELETE",
              headers: adminHeaders,
            },
          );

          if (!revokeResponse.ok) {
            const message = await revokeResponse.text();
            throw new Error(
              `Failed to revoke session ${token.session_id}: ${revokeResponse.status} ${message}`,
            );
          }
        }),
      );
    }

    const sessionFingerprint =
      typeof payload.sessionFingerprint === "string" &&
      payload.sessionFingerprint.trim().length > 0
        ? payload.sessionFingerprint.trim()
        : randomUUID();

    const supabaseProfileClient = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      : supabaseUserClient;

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
