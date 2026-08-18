import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  OpenPlayFormat,
  OpenPlaySession,
  SkillLevel,
} from "@/lib/demo-data";

type OpenPlaySessionRequest = {
  courtIds?: unknown;
  date?: unknown;
  fee?: unknown;
  formats?: unknown;
  hours?: unknown;
  maxPlayers?: unknown;
  skillLevels?: unknown;
  startTime?: unknown;
  title?: unknown;
};

type SessionRow = Record<string, unknown>;
type SessionCourtRow = Record<string, unknown>;
type CourtRow = Record<string, unknown>;
type ParticipantRow = Record<string, unknown>;

const skillLevelMap: Record<string, SkillLevel> = {
  advanced: "Advanced",
  all_levels: "All Levels",
  beginner: "Beginner",
  intermediate: "Intermediate",
  novice: "Novice",
};

const skillLevelDbMap: Record<SkillLevel, string> = {
  Advanced: "advanced",
  "All Levels": "all_levels",
  Beginner: "beginner",
  Intermediate: "intermediate",
  Novice: "novice",
};

const openPlayFormatMap: Record<string, OpenPlayFormat> = {
  mens_doubles: "Men's Doubles",
  mixed_doubles: "Mixed Doubles",
  womens_doubles: "Women's Doubles",
};

const openPlayFormatDbMap: Record<OpenPlayFormat, string> = {
  "Men's Doubles": "mens_doubles",
  "Mixed Doubles": "mixed_doubles",
  "Women's Doubles": "womens_doubles",
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const sessionSelect = `
  id,
  title,
  court_id,
  session_date,
  starts_at,
  ends_at,
  skill_level,
  skill_levels,
  formats,
  max_players,
  fee,
  status
`;

function getAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getCurrentUserAndRole() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { isManager: false, supabase, user: null };
  }

  const { data: isManager } = await supabase.rpc("is_manager");

  return { isManager: Boolean(isManager), supabase, user };
}

function toText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toPositiveInteger(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return null;
  }

  return numberValue;
}

function toNonNegativeNumber(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }

  return numberValue;
}

function formatTimeHHMM(timeStr: unknown, fallback = "08:00") {
  if (typeof timeStr !== "string") return fallback;
  const trimmed = timeStr.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{1}:\d{2}$/.test(trimmed)) return `0${trimmed}`;

  return fallback;
}

function addHours(time: string, hoursToAdd: number) {
  const [rawHours, rawMinutes] = time.split(":").map(Number);
  const totalMinutes = (rawHours || 0) * 60 + (rawMinutes || 0) + hoursToAdd * 60;
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}

function fromDbSkillLevel(value: unknown): SkillLevel {
  return skillLevelMap[String(value)] ?? "All Levels";
}

function fromDbFormat(value: unknown): OpenPlayFormat {
  return openPlayFormatMap[String(value)] ?? "Mixed Doubles";
}

function fromDbStatus(value: unknown): OpenPlaySession["status"] {
  if (value === "full") return "Full";
  if (value === "closed" || value === "completed") return "Closed";

  return "Scheduled";
}

function toDbSkillLevels(value: unknown) {
  if (!Array.isArray(value)) {
    return ["all_levels"];
  }

  const skillLevels = value
    .map((item) => skillLevelDbMap[item as SkillLevel])
    .filter((item): item is string => Boolean(item));

  if (skillLevels.includes("all_levels")) {
    return ["all_levels"];
  }

  return skillLevels.length > 0 ? skillLevels : ["all_levels"];
}

function toDbFormats(value: unknown) {
  if (!Array.isArray(value)) {
    return ["mixed_doubles"];
  }

  const formats = value
    .map((item) => openPlayFormatDbMap[item as OpenPlayFormat])
    .filter((item): item is string => Boolean(item));

  return formats.length > 0 ? formats : ["mixed_doubles"];
}

function mapSessions(
  sessionRows: SessionRow[],
  sessionCourtRows: SessionCourtRow[],
  courtRows: CourtRow[],
  participantRows: ParticipantRow[],
) {
  const courtsById = new Map(
    courtRows.map((court) => [
      String(court.id),
      typeof court.name === "string" ? court.name : "Court",
    ]),
  );
  const courtsBySessionId = new Map<string, string[]>();
  const playersBySessionId = new Map<string, number>();

  for (const sessionCourt of sessionCourtRows) {
    const sessionId = String(sessionCourt.session_id ?? "");
    const courtId = String(sessionCourt.court_id ?? "");

    if (!sessionId || !courtId) {
      continue;
    }

    const courtIds = courtsBySessionId.get(sessionId) ?? [];
    courtIds.push(courtId);
    courtsBySessionId.set(sessionId, courtIds);
  }

  for (const participant of participantRows) {
    const sessionId = String(participant.session_id ?? "");

    if (!sessionId) {
      continue;
    }

    playersBySessionId.set(
      sessionId,
      (playersBySessionId.get(sessionId) ?? 0) + 1,
    );
  }

  return sessionRows.map((row): OpenPlaySession => {
    const sessionId = String(row.id);
    const primaryCourtId = String(row.court_id);
    const linkedCourtIds = courtsBySessionId.get(sessionId) ?? [];
    const courtIds = linkedCourtIds.length > 0 ? linkedCourtIds : [primaryCourtId];
    const courtNames = courtIds
      .map((courtId) => courtsById.get(courtId))
      .filter((name): name is string => Boolean(name));
    const rawSkillLevels = Array.isArray(row.skill_levels)
      ? row.skill_levels
      : [row.skill_level];
    const skillLevels = rawSkillLevels.map(fromDbSkillLevel);
    const formats: OpenPlayFormat[] = Array.isArray(row.formats)
      ? row.formats.map(fromDbFormat)
      : ["Mixed Doubles"];

    return {
      courtId: primaryCourtId,
      courtIds,
      courtName: courtNames.join(", ") || courtsById.get(primaryCourtId) || "Court",
      courtNames,
      date: String(row.session_date ?? ""),
      endTime:
        typeof row.ends_at === "string" ? row.ends_at.slice(0, 5) : "18:00",
      fee: Number(row.fee ?? 0),
      formats,
      id: sessionId,
      joinedPlayers: playersBySessionId.get(sessionId) ?? 0,
      maxPlayers: Number(row.max_players ?? 0),
      skillLevel: fromDbSkillLevel(row.skill_level),
      skillLevels,
      startTime:
        typeof row.starts_at === "string" ? row.starts_at.slice(0, 5) : "16:00",
      status: fromDbStatus(row.status),
      title: String(row.title ?? "Open Play"),
    };
  });
}

async function loadSessions(dbClient: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data: sessionRows, error: sessionError } = await dbClient
    .from("open_play_sessions")
    .select(sessionSelect)
    .order("session_date", { ascending: true })
    .order("starts_at", { ascending: true });

  if (sessionError) {
    return { error: sessionError, sessions: [] as OpenPlaySession[] };
  }

  const sessionIds = (sessionRows ?? []).map((row) => String(row.id));
  const primaryCourtIds = (sessionRows ?? []).map((row) => String(row.court_id));

  if (sessionIds.length === 0) {
    return { error: null, sessions: [] as OpenPlaySession[] };
  }

  const [sessionCourtResult, participantResult] = await Promise.all([
    dbClient
      .from("open_play_session_courts")
      .select("session_id, court_id")
      .in("session_id", sessionIds),
    dbClient
      .from("open_play_participants")
      .select("session_id")
      .in("session_id", sessionIds)
      .in("status", ["approved", "registered"]),
  ]);

  if (sessionCourtResult.error) {
    return {
      error: sessionCourtResult.error,
      sessions: [] as OpenPlaySession[],
    };
  }

  if (participantResult.error) {
    return {
      error: participantResult.error,
      sessions: [] as OpenPlaySession[],
    };
  }

  const linkedCourtIds = (sessionCourtResult.data ?? []).map((row) =>
    String(row.court_id),
  );
  const courtIds = Array.from(new Set([...primaryCourtIds, ...linkedCourtIds]));
  const courtResult =
    courtIds.length > 0
      ? await dbClient.from("courts").select("id, name").in("id", courtIds)
      : { data: [], error: null };

  if (courtResult.error) {
    return { error: courtResult.error, sessions: [] as OpenPlaySession[] };
  }

  return {
    error: null,
    sessions: mapSessions(
      sessionRows ?? [],
      sessionCourtResult.data ?? [],
      courtResult.data ?? [],
      participantResult.data ?? [],
    ),
  };
}

export async function GET() {
  const { supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const dbClient = getAdminSupabaseClient() ?? supabase;
  const { error, sessions } = await loadSessions(dbClient);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
  const { isManager, supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  if (!isManager) {
    return NextResponse.json(
      { error: "Manager access is required." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as OpenPlaySessionRequest;
  const title = toText(body.title);
  const date = toText(body.date);
  const startTime = formatTimeHHMM(body.startTime, "");
  const hours = toPositiveInteger(body.hours);
  const maxPlayers = toPositiveInteger(body.maxPlayers);
  const fee = toNonNegativeNumber(body.fee);
  const courtIds = Array.isArray(body.courtIds)
    ? body.courtIds.map(toText).filter((id) => uuidPattern.test(id))
    : [];
  const skillLevels = toDbSkillLevels(body.skillLevels);
  const formats = toDbFormats(body.formats);

  if (
    !title ||
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !startTime ||
    !hours ||
    !maxPlayers ||
    fee === null ||
    courtIds.length === 0
  ) {
    return NextResponse.json(
      { error: "Missing open-play session details." },
      { status: 400 },
    );
  }

  const dbClient = getAdminSupabaseClient() ?? supabase;
  const { data: selectedCourts, error: courtError } = await dbClient
    .from("courts")
    .select("id, name")
    .in("id", courtIds);

  if (courtError) {
    return NextResponse.json({ error: courtError.message }, { status: 400 });
  }

  if (!selectedCourts || selectedCourts.length === 0) {
    return NextResponse.json(
      { error: "Selected courts are not configured in Supabase." },
      { status: 400 },
    );
  }

  const validCourtIds = selectedCourts.map((court) => String(court.id));
  const primaryCourtId = validCourtIds[0];

  const { data: session, error: insertError } = await dbClient
    .from("open_play_sessions")
    .insert({
      court_id: primaryCourtId,
      created_by: user.id,
      ends_at: addHours(startTime, hours),
      fee,
      formats,
      max_players: maxPlayers,
      session_date: date,
      skill_level: skillLevels[0],
      skill_levels: skillLevels,
      starts_at: startTime,
      status: "scheduled",
      title,
    })
    .select(sessionSelect)
    .single();

  if (insertError || !session) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create open-play session." },
      { status: 400 },
    );
  }

  const { data: sessionCourts, error: sessionCourtError } = await dbClient
    .from("open_play_session_courts")
    .insert(
      validCourtIds.map((courtId) => ({
        court_id: courtId,
        session_id: session.id,
      })),
    )
    .select("session_id, court_id");

  if (sessionCourtError) {
    await dbClient.from("open_play_sessions").delete().eq("id", session.id);

    return NextResponse.json(
      { error: sessionCourtError.message },
      { status: 400 },
    );
  }

  const mappedSession = mapSessions(
    [session],
    sessionCourts ?? [],
    selectedCourts ?? [],
    [],
  )[0];

  return NextResponse.json({ session: mappedSession }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { isManager, supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  if (!isManager) {
    return NextResponse.json(
      { error: "Manager access is required." },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id || !uuidPattern.test(id)) {
    return NextResponse.json(
      { error: "Open-play session ID is required." },
      { status: 400 },
    );
  }

  const dbClient = getAdminSupabaseClient() ?? supabase;
  const { error } = await dbClient
    .from("open_play_sessions")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
