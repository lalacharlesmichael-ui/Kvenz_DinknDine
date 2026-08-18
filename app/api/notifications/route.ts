import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { normalizeUsername } from "@/lib/auth/username";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type NotificationCreateRequest = {
  body?: unknown;
  message?: unknown;
  targetUsername?: unknown;
  title?: unknown;
};

type NotificationUpdateRequest = {
  id?: unknown;
  markAll?: unknown;
};

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

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatNotificationTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  }).format(date);
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

export async function GET() {
  const { supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const currentUsername = currentProfile?.username || "";

  const { data, error } = await supabase
    .from("notifications")
    .select("id, recipient_id, title, body, read_at, created_at")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const notifications = (data ?? []).map((row) => ({
    body: row.body,
    createdAt: formatNotificationTime(row.created_at),
    id: row.id,
    message: row.body,
    readAt: row.read_at ? String(row.read_at) : null,
    recipientId: row.recipient_id,
    timestamp: row.created_at,
    title: row.title || "Notification",
    username: currentUsername,
  }));

  return NextResponse.json({ notifications });
}

export async function POST(request: Request) {
  const { isManager, supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = (await request.json()) as NotificationCreateRequest;
  const messageText = toText(body.message) || toText(body.body);
  const titleText = toText(body.title) || "Notification";
  const targetUsernameRaw = toText(body.targetUsername);

  if (!messageText) {
    return NextResponse.json(
      { error: "Notification content is required." },
      { status: 400 },
    );
  }

  let recipientId = user.id;
  let recipientUsername = "";

  if (targetUsernameRaw) {
    const normalizedTarget = normalizeUsername(targetUsernameRaw);
    const adminSupabase = getAdminSupabaseClient() || supabase;

    const { data: recipientProfile } = await adminSupabase
      .from("profiles")
      .select("id, username")
      .ilike("username", normalizedTarget)
      .maybeSingle();

    if (recipientProfile) {
      recipientId = recipientProfile.id;
      recipientUsername = recipientProfile.username || targetUsernameRaw;
    }
  }

  const clientToUse =
    recipientId !== user.id && !isManager
      ? getAdminSupabaseClient() || supabase
      : supabase;

  const insertPayload = {
    body: messageText,
    recipient_id: recipientId,
    title: titleText,
  };

  const { data, error } = await clientToUse
    .from("notifications")
    .insert(insertPayload)
    .select("id, recipient_id, title, body, read_at, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const notification = {
    body: data.body,
    createdAt: formatNotificationTime(data.created_at),
    id: data.id,
    message: data.body,
    readAt: data.read_at ? String(data.read_at) : null,
    recipientId: data.recipient_id,
    timestamp: data.created_at,
    title: data.title || "Notification",
    username: recipientUsername || targetUsernameRaw,
  };

  return NextResponse.json({ notification }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = (await request.json()) as NotificationUpdateRequest;
  const id = toText(body.id);
  const markAll = Boolean(body.markAll);
  const now = new Date().toISOString();

  if (markAll) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("recipient_id", user.id)
      .is("read_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  }

  if (!id) {
    return NextResponse.json(
      { error: "Notification id or markAll flag is required." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: now })
    .eq("id", id)
    .eq("recipient_id", user.id)
    .select("id, recipient_id, title, body, read_at, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    notification: {
      body: data.body,
      createdAt: formatNotificationTime(data.created_at),
      id: data.id,
      message: data.body,
      readAt: data.read_at ? String(data.read_at) : null,
      recipientId: data.recipient_id,
      timestamp: data.created_at,
      title: data.title || "Notification",
    },
    success: true,
  });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get("id");
  const clearAllParam = searchParams.get("clearAll") === "true";

  if (clearAllParam) {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("recipient_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  }

  if (!idParam) {
    return NextResponse.json(
      { error: "Notification id or clearAll parameter is required." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", idParam)
    .eq("recipient_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
