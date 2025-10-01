import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ValidationStatusFilter = "all" | "completed" | "processing" | "failed" | "archived";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
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

function resolveLimit(value: string | null): number {
  const fallback = 50;
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, 200);
}

function normalizeStatusParam(value: string | null): ValidationStatusFilter {
  if (!value) {
    return "all";
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "completed" ||
    normalized === "processing" ||
    normalized === "failed" ||
    normalized === "archived"
  ) {
    return normalized;
  }

  return "all";
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = parseAuthorizationHeader(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing access token" },
        { status: 401 },
      );
    }

    const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

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
      data: userData,
      error: userError,
    } = await supabaseUserClient.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdminClient();

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile || profile.role !== "admin" || profile.is_active === false) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const limit = resolveLimit(url.searchParams.get("limit"));
    const statusFilter = normalizeStatusParam(url.searchParams.get("status"));

    let query = supabaseAdmin
      .from("validation_history")
      .select("*, profiles(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      items: data ?? [],
    });
  } catch (error) {
    console.error("admin validations error:", error);
    return NextResponse.json(
      {
        error: "Failed to load validation history",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}