import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

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

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalUsers, error: totalUsersError },
      { count: totalCourses, error: totalCoursesError },
      { count: totalValidations, error: totalValidationsError },
      { count: activeSessions, error: activeSessionsError },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("courses").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("validation_history")
        .select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .gte("last_sign_in_at", oneDayAgo),
    ]);

    if (totalUsersError) {
      throw totalUsersError;
    }
    if (totalCoursesError) {
      throw totalCoursesError;
    }
    if (totalValidationsError) {
      throw totalValidationsError;
    }
    if (activeSessionsError) {
      throw activeSessionsError;
    }

    return NextResponse.json({
      totalUsers: totalUsers ?? 0,
      totalCourses: totalCourses ?? 0,
      totalValidations: totalValidations ?? 0,
      activeSessions: activeSessions ?? 0,
    });
  } catch (error) {
    console.error("admin stats error:", error);
    return NextResponse.json(
      {
        error: "Failed to load admin stats",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}