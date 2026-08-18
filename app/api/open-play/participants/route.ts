import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  OpenPlayParticipant,
  PaymentMethod,
  PaymentStatus,
  SkillLevel,
} from "@/lib/demo-data";

type ParticipantCreateRequest = {
  amount?: unknown;
  paymentReference?: unknown;
  receiptPath?: unknown;
  sessionId?: unknown;
  skillLevel?: unknown;
};

type ParticipantActionRequest = {
  action?: unknown;
  id?: unknown;
};

type RelatedObject = Record<string, unknown> | Record<string, unknown>[] | null;
type ParticipantRow = Record<string, unknown> & {
  player?: RelatedObject;
};
type OpenPlayApplicantSkillLevel = Exclude<SkillLevel, "All Levels">;

const RECEIPT_SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const skillLevelMap: Record<string, OpenPlayApplicantSkillLevel> = {
  advanced: "Advanced",
  beginner: "Beginner",
  intermediate: "Intermediate",
  novice: "Novice",
};

const skillLevelDbMap: Record<OpenPlayApplicantSkillLevel, string> = {
  Advanced: "advanced",
  Beginner: "beginner",
  Intermediate: "intermediate",
  Novice: "novice",
};

const paymentMethodMap: Record<string, PaymentMethod> = {
  bank_transfer: "Bank Transfer",
  gcash: "GCash",
};

const paymentStatusMap: Record<string, PaymentStatus> = {
  awaiting_proof: "Awaiting Proof",
  rejected: "Rejected",
  submitted: "Submitted",
  verified: "Verified",
};

const participantSelect = `
  id,
  session_id,
  player_id,
  skill_level,
  status,
  payment_method,
  payment_amount,
  payment_reference,
  receipt_path,
  payment_status,
  player:profiles!open_play_participants_player_id_fkey(full_name, username)
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

function toNonNegativeNumber(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }

  return numberValue;
}

function relatedValue(value: RelatedObject) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function nameFromUsername(username: string) {
  return username.replace(/[_-]+/g, " ").trim() || "KVENS Player";
}

function fromDbSkillLevel(value: unknown): OpenPlayApplicantSkillLevel {
  return skillLevelMap[String(value)] ?? "Beginner";
}

function fromDbRegistrationStatus(value: unknown): OpenPlayParticipant["status"] {
  if (value === "approved" || value === "registered") return "Approved";
  if (value === "rejected" || value === "cancelled") return "Rejected";

  return "Pending";
}

function fromDbPaymentMethod(value: unknown): PaymentMethod {
  return paymentMethodMap[String(value)] ?? "GCash";
}

function fromDbPaymentStatus(value: unknown): PaymentStatus {
  return paymentStatusMap[String(value)] ?? "Awaiting Proof";
}

function toDbSkillLevel(value: unknown) {
  return skillLevelDbMap[value as OpenPlayApplicantSkillLevel] ?? "beginner";
}

async function receiptUrlFromPath(
  supabase: SupabaseClient,
  receiptPath?: string,
) {
  if (!receiptPath || receiptPath.startsWith("data:")) {
    return receiptPath || undefined;
  }

  if (receiptPath.startsWith("http://") || receiptPath.startsWith("https://")) {
    return receiptPath;
  }

  const { data, error } = await supabase.storage
    .from("payment-receipts")
    .createSignedUrl(receiptPath, RECEIPT_SIGNED_URL_EXPIRES_IN_SECONDS);

  if (!error && data?.signedUrl) {
    return data.signedUrl;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/payment-receipts/${receiptPath}`;
  }

  return undefined;
}

async function mapParticipantRow(
  supabase: SupabaseClient,
  row: ParticipantRow,
) {
  const player = relatedValue(row.player as RelatedObject);
  const username =
    typeof player?.username === "string" ? player.username : undefined;
  const playerName =
    typeof player?.full_name === "string" && player.full_name.trim().length > 0
      ? player.full_name
      : username
        ? nameFromUsername(username)
        : "Open-play player";
  const receiptPath =
    typeof row.receipt_path === "string" ? row.receipt_path : "";

  return {
    amount: Number(row.payment_amount ?? 0),
    id: String(row.id),
    paymentMethod: fromDbPaymentMethod(row.payment_method),
    paymentReference:
      typeof row.payment_reference === "string" ? row.payment_reference : "",
    paymentStatus: fromDbPaymentStatus(row.payment_status),
    playerName,
    playerUsername: username,
    receiptName: receiptPath,
    receiptUrl: await receiptUrlFromPath(supabase, receiptPath),
    sessionId: String(row.session_id),
    skillLevel: fromDbSkillLevel(row.skill_level),
    status: fromDbRegistrationStatus(row.status),
  } satisfies OpenPlayParticipant;
}

async function mapParticipantRows(
  supabase: SupabaseClient,
  rows: ParticipantRow[],
) {
  return Promise.all(rows.map((row) => mapParticipantRow(supabase, row)));
}

async function notifyParticipant(
  supabase: SupabaseClient,
  participant: ParticipantRow,
  title: string,
  body: string,
) {
  const playerId = String(participant.player_id ?? "");

  if (!playerId) {
    return;
  }

  await supabase.from("notifications").insert({
    body,
    recipient_id: playerId,
    title,
  });
}

export async function GET() {
  const { isManager, supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const query = supabase
    .from("open_play_participants")
    .select(participantSelect)
    .order("created_at", { ascending: false });
  const result = isManager ? await query : await query.eq("player_id", user.id);

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  const storageClient = getAdminSupabaseClient() ?? supabase;
  const applicants = await mapParticipantRows(
    storageClient,
    (result.data ?? []) as ParticipantRow[],
  );

  return NextResponse.json({ applicants });
}

export async function POST(request: Request) {
  const { supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = (await request.json()) as ParticipantCreateRequest;
  const sessionId = toText(body.sessionId);
  const skillLevel = toDbSkillLevel(body.skillLevel);
  const paymentReference = toText(body.paymentReference);
  const receiptPath = toText(body.receiptPath);
  const requestedAmount = toNonNegativeNumber(body.amount);

  if (
    !sessionId ||
    !uuidPattern.test(sessionId) ||
    !paymentReference ||
    !receiptPath ||
    requestedAmount === null
  ) {
    return NextResponse.json(
      { error: "Missing open-play payment details." },
      { status: 400 },
    );
  }

  const dbClient = getAdminSupabaseClient() ?? supabase;
  const { data: session, error: sessionError } = await dbClient
    .from("open_play_sessions")
    .select("id, title, fee, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 400 });
  }

  if (!session || session.status !== "scheduled") {
    return NextResponse.json(
      { error: "Open-play session is not available." },
      { status: 400 },
    );
  }

  const amount = Number(session.fee ?? requestedAmount);

  const { error: profileError } = await dbClient
    .from("profiles")
    .upsert(
      { full_name: "", id: user.id, role: "player" },
      { ignoreDuplicates: true, onConflict: "id" },
    );

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const { data: existing, error: existingError } = await dbClient
    .from("open_play_participants")
    .select("id, status, payment_status")
    .eq("session_id", sessionId)
    .eq("player_id", user.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 400 });
  }

  if (
    existing &&
    ["approved", "registered"].includes(String(existing.status)) &&
    existing.payment_status === "verified"
  ) {
    return NextResponse.json(
      { error: "You are already approved for this open-play session." },
      { status: 409 },
    );
  }

  if (existing && String(existing.status) !== "pending") {
    const { error: deleteError } = await dbClient
      .from("open_play_participants")
      .delete()
      .eq("id", existing.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }
  }

  const payload = {
    payment_amount: amount,
    payment_method: "gcash",
    payment_reference: paymentReference,
    payment_status: "submitted",
    player_id: user.id,
    receipt_path: receiptPath,
    session_id: sessionId,
    skill_level: skillLevel,
    status: "pending",
  };

  const writeResult =
    existing && String(existing.status) === "pending"
      ? await dbClient
          .from("open_play_participants")
          .update(payload)
          .eq("id", existing.id)
          .select(participantSelect)
          .single()
      : await dbClient
          .from("open_play_participants")
          .insert(payload)
          .select(participantSelect)
          .single();

  if (writeResult.error || !writeResult.data) {
    return NextResponse.json(
      {
        error:
          writeResult.error?.message ??
          "Open-play payment could not be submitted.",
      },
      { status: 400 },
    );
  }

  const applicant = await mapParticipantRow(
    getAdminSupabaseClient() ?? supabase,
    writeResult.data as ParticipantRow,
  );

  return NextResponse.json({ applicant }, { status: 201 });
}

export async function PATCH(request: Request) {
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

  const body = (await request.json()) as ParticipantActionRequest;
  const id = toText(body.id);
  const action = toText(body.action);

  if (!id || !uuidPattern.test(id)) {
    return NextResponse.json(
      { error: "Open-play applicant ID is required." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  let updatePayload: Record<string, unknown>;

  switch (action) {
    case "approve":
      updatePayload = {
        payment_status: "verified",
        status: "approved",
        verified_at: now,
        verified_by: user.id,
      };
      break;
    case "reject":
      updatePayload = {
        payment_status: "rejected",
        status: "rejected",
      };
      break;
    default:
      return NextResponse.json(
        { error: "Unknown open-play applicant action." },
        { status: 400 },
      );
  }

  const dbClient = getAdminSupabaseClient() ?? supabase;
  const { data, error } = await dbClient
    .from("open_play_participants")
    .update(updatePayload)
    .eq("id", id)
    .select(participantSelect)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Open-play applicant could not be updated." },
      { status: 400 },
    );
  }

  const participant = data as ParticipantRow;
  const title =
    action === "approve" ? "Open Play Approved" : "Open Play Rejected";
  const message =
    action === "approve"
      ? "Your open-play payment was verified and your slot is approved."
      : "Your open-play payment proof was rejected. Please submit a new proof.";

  await notifyParticipant(dbClient, participant, title, message);

  const applicant = await mapParticipantRow(dbClient, participant);

  return NextResponse.json({ applicant });
}

export async function DELETE(request: Request) {
  const { isManager, supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id || !uuidPattern.test(id)) {
    return NextResponse.json(
      { error: "Open-play applicant ID is required." },
      { status: 400 },
    );
  }

  const dbClient = getAdminSupabaseClient() ?? supabase;
  const deleteQuery = dbClient.from("open_play_participants").delete().eq("id", id);
  const result = isManager ? await deleteQuery : await deleteQuery.eq("player_id", user.id);

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
