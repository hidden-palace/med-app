import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { RecentActivity } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function resolveActivityLimit(value: string | null): number {
  if (!value) {
    return 4;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 4;
  }

  return Math.min(parsed, 20);
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
      .select("id, is_active")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile || profile.is_active === false) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const activityLimit = resolveActivityLimit(url.searchParams.get("activityLimit"));

    const [
      { data: courseRows, error: coursesError },
      { data: moduleRows, error: modulesError },
      { data: progressRows, error: progressError },
      { count: validationCount, error: validationsError },
      { data: activityRows, error: activityError },
    ] = await Promise.all([
      supabaseAdmin
        .from("courses")
        .select("id, title, thumbnail, order_index")
        .eq("published", true)
        .order("order_index", { ascending: true }),
      supabaseAdmin
        .from("modules")
        .select("id, course_id, order_index")
        .eq("published", true),
      supabaseAdmin
        .from("user_progress")
        .select("course_id, module_id, completed, last_position")
        .eq("user_id", userData.user.id),
      supabaseAdmin
        .from("validation_history")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userData.user.id),
      supabaseAdmin
        .from("recent_activity")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(activityLimit),
    ]);

    if (coursesError) {
      throw coursesError;
    }
    if (modulesError) {
      throw modulesError;
    }
    if (progressError) {
      throw progressError;
    }
    if (validationsError) {
      throw validationsError;
    }
    if (activityError) {
      throw activityError;
    }

    const courses = (courseRows ?? []) as Array<{
      id: string;
      title: string;
      thumbnail: string | null;
      order_index: number | null;
    }>;

    const modules = (moduleRows ?? []) as Array<{
      id: string;
      course_id: string;
      order_index: number | null;
    }>;

    const progress = (progressRows ?? []) as Array<{
      course_id: string;
      module_id: string;
      completed: boolean;
      last_position: number | null;
    }>;

    const recentActivity = (activityRows ?? []) as RecentActivity[];

    const totalCourses = courses.length;
    const completedModules = progress.filter((row) => row.completed).length;
    const studyMinutes = completedModules * 30;
    const studyHoursValue = studyMinutes / 60;
    const studyHours =
      studyMinutes === 0
        ? "0 hrs"
        : studyHoursValue >= 1
        ? `${studyHoursValue.toFixed(1).replace(/\.0$/, "")} hrs`
        : `${studyMinutes} mins`;

    const modulesByCourse = new Map<string, Array<{ id: string; order_index: number | null }>>();
    for (const moduleRow of modules) {
      const list = modulesByCourse.get(moduleRow.course_id) ?? [];
      list.push({ id: moduleRow.id, order_index: moduleRow.order_index });
      modulesByCourse.set(moduleRow.course_id, list);
    }

    for (const list of modulesByCourse.values()) {
      list.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    }

    const courseProgress = courses.map((course) => {
      const courseModules = modulesByCourse.get(course.id) ?? [];
      const completedForCourse = progress.filter(
        (row) => row.course_id === course.id && row.completed,
      );
      const isStarted = progress.some(
        (row) =>
          row.course_id === course.id &&
          (row.completed || (row.last_position ?? 0) > 0),
      );

      const progressPercent =
        courseModules.length > 0
          ? Math.round((completedForCourse.length / courseModules.length) * 100)
          : 0;

      return {
        id: course.id,
        title: course.title,
        thumbnail: course.thumbnail,
        order_index: course.order_index ?? 0,
        totalModules: courseModules.length,
        completedModulesCount: completedForCourse.length,
        progress: Math.min(progressPercent, 100),
        isStarted,
      };
    });

    return NextResponse.json({
      stats: {
        totalCourses,
        completedModules,
        totalValidations: validationCount ?? 0,
        studyHours,
      },
      recentActivity,
      courseProgress,
    });
  } catch (error) {
    console.error("dashboard overview error:", error);
    return NextResponse.json(
      {
        error: "Failed to load dashboard data",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}