import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type ForceSingleSessionPayload = {
  userId: string;
  sessionId: string;
};

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }
  return url;
}

function getAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured');
  }
  return key;
}

function getServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }
  return key;
}

function parseAuthorizationHeader(request: NextRequest): string | null {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!header) {
    return null;
  }

  const match = header.match(/^Bearer\s+(.*)$/i);
  return match ? match[1] : null;
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = parseAuthorizationHeader(request);
    if (!accessToken) {
      return NextResponse.json({ error: 'Missing access token' }, { status: 401 });
    }

    const payload = (await request.json()) as ForceSingleSessionPayload | null;
    if (!payload?.userId || !payload?.sessionId) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.id !== payload.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const adminHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    };

    const refreshTokensResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${payload.userId}/refresh_tokens`,
      {
        headers: adminHeaders,
        cache: 'no-store',
      }
    );

    if (!refreshTokensResponse.ok) {
      const message = await refreshTokensResponse.text();
      throw new Error(`Failed to load refresh tokens: ${refreshTokensResponse.status} ${message}`);
    }

    const refreshTokens = (await refreshTokensResponse.json()) as Array<{
      session_id: string | null;
    }>;

    const tokensToRevoke = refreshTokens.filter((token) => token.session_id && token.session_id !== payload.sessionId);

    await Promise.all(
      tokensToRevoke.map(async (token) => {
        const revokeResponse = await fetch(
          `${supabaseUrl}/auth/v1/admin/users/${payload.userId}/refresh_tokens/${token.session_id}`,
          {
            method: 'DELETE',
            headers: adminHeaders,
          }
        );

        if (!revokeResponse.ok) {
          const message = await revokeResponse.text();
          throw new Error(`Failed to revoke session ${token.session_id}: ${revokeResponse.status} ${message}`);
        }
      })
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('force-single-session error:', error);
    return NextResponse.json(
      {
        error: 'Failed to enforce single session',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
