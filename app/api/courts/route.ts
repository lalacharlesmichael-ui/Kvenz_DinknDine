import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type CourtCreateRequest = {
  close?: string;
  enabled?: boolean;
  image?: string;
  name?: string;
  nightPricePerHour?: number;
  nightStartsAt?: string;
  open?: string;
  pricePerHour?: number;
  slots?: string[];
  surface?: string;
  zone?: string;
};

type CourtUpdateRequest = {
  close?: string;
  enabled?: boolean;
  id?: string;
  image?: string;
  name?: string;
  nightPricePerHour?: number;
  nightStartsAt?: string;
  open?: string;
  pricePerHour?: number;
  slots?: string[];
  surface?: string;
  zone?: string;
};

function formatTimeHHMM(timeStr?: string, fallback = "06:00") {
  if (!timeStr || typeof timeStr !== "string") return fallback;
  const trimmed = timeStr.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{1}:\d{2}$/.test(trimmed)) return `0${trimmed}`;

  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = match12[2];
    const ampm = match12[3]?.toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, "0")}:${minute}`;
  }
  return fallback;
}

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

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const adminClient = getAdminSupabaseClient() ?? supabase;

    const { data: courtRows, error: courtError } = await adminClient
      .from("courts")
      .select(
        "id, name, surface, zone, price_per_hour, night_price_per_hour, night_starts_at, opens_at, closes_at, is_enabled, image_url",
      )
      .order("name", { ascending: true });

    if (courtError) {
      return NextResponse.json({ error: courtError.message }, { status: 400 });
    }

    const { data: slotRows, error: slotError } = await adminClient
      .from("court_slots")
      .select("court_id, start_time")
      .eq("is_enabled", true)
      .order("start_time", { ascending: true });

    if (slotError) {
      return NextResponse.json({ error: slotError.message }, { status: 400 });
    }

    const slotsByCourt = new Map<string, string[]>();
    for (const slot of slotRows ?? []) {
      const cid = String(slot.court_id);
      const list = slotsByCourt.get(cid) ?? [];
      const timeStr =
        typeof slot.start_time === "string"
          ? slot.start_time.slice(0, 5)
          : "08:00";
      list.push(timeStr);
      slotsByCourt.set(cid, list);
    }

    const courts = (courtRows ?? []).map((row) => ({
      close:
        typeof row.closes_at === "string"
          ? row.closes_at.slice(0, 5)
          : "22:00",
      enabled: Boolean(row.is_enabled),
      id: String(row.id),
      image:
        typeof row.image_url === "string" && row.image_url.trim().length > 0
          ? row.image_url
          : undefined,
      name: String(row.name),
      nightPricePerHour:
        row.night_price_per_hour != null
          ? Number(row.night_price_per_hour)
          : undefined,
      nightStartsAt:
        typeof row.night_starts_at === "string"
          ? row.night_starts_at.slice(0, 5)
          : "17:00",
      open:
        typeof row.opens_at === "string" ? row.opens_at.slice(0, 5) : "06:00",
      pricePerHour: Number(row.price_per_hour),
      slots: slotsByCourt.get(String(row.id)) ?? [],
      surface: String(row.surface ?? "standard"),
      zone: String(row.zone ?? ""),
    }));

    return NextResponse.json({ courts }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error fetching courts." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const adminClient = getAdminSupabaseClient();
    const dbClient = adminClient ?? supabase;

    if (!user && !adminClient) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as CourtCreateRequest;

    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { error: "Court name is required." },
        { status: 400 },
      );
    }

    const pricePerHour =
      Number(body.pricePerHour) >= 0 ? Number(body.pricePerHour) : 400;
    const nightPricePerHour =
      body.nightPricePerHour != null && Number(body.nightPricePerHour) >= 0
        ? Number(body.nightPricePerHour)
        : null;
    const nightStartsAt = formatTimeHHMM(body.nightStartsAt, "17:00");
    const opensAt = formatTimeHHMM(body.open, "06:00");
    let closesAt = formatTimeHHMM(body.close, "22:00");
    if (opensAt === closesAt) {
      closesAt = "23:59";
    }

    const surface =
      body.surface && typeof body.surface === "string"
        ? body.surface
        : "Standard court";
    const zone =
      body.zone && typeof body.zone === "string" ? body.zone : "Main area";
    const imageUrl =
      body.image && typeof body.image === "string" ? body.image : null;
    const isEnabled =
      body.enabled !== undefined ? Boolean(body.enabled) : true;

    const { data: newCourt, error: insertError } = await dbClient
      .from("courts")
      .insert({
        closes_at: closesAt,
        image_url: imageUrl,
        is_enabled: isEnabled,
        name: body.name.trim(),
        night_price_per_hour: nightPricePerHour,
        night_starts_at: nightStartsAt,
        opens_at: opensAt,
        price_per_hour: pricePerHour,
        surface,
        zone,
      })
      .select(
        "id, name, surface, zone, price_per_hour, night_price_per_hour, night_starts_at, opens_at, closes_at, is_enabled, image_url",
      )
      .single();

    if (insertError || !newCourt) {
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to create court." },
        { status: 400 },
      );
    }

    const courtId = String(newCourt.id);
    const slots =
      Array.isArray(body.slots) && body.slots.length > 0
        ? body.slots
        : ["06:00", "08:00", "10:00", "14:00", "16:00", "18:00", "20:00"];

    const slotInserts = slots.map((timeStr) => ({
      court_id: courtId,
      is_enabled: true,
      start_time: timeStr,
    }));

    await dbClient.from("court_slots").insert(slotInserts);

    return NextResponse.json(
      {
        court: {
          close:
            typeof newCourt.closes_at === "string"
              ? newCourt.closes_at.slice(0, 5)
              : closesAt,
          enabled: Boolean(newCourt.is_enabled),
          id: courtId,
          image: newCourt.image_url ?? undefined,
          name: String(newCourt.name),
          nightPricePerHour:
            newCourt.night_price_per_hour != null
              ? Number(newCourt.night_price_per_hour)
              : undefined,
          nightStartsAt:
            typeof newCourt.night_starts_at === "string"
              ? newCourt.night_starts_at.slice(0, 5)
              : nightStartsAt,
          open:
            typeof newCourt.opens_at === "string"
              ? newCourt.opens_at.slice(0, 5)
              : opensAt,
          pricePerHour: Number(newCourt.price_per_hour),
          slots,
          surface: String(newCourt.surface),
          zone: String(newCourt.zone),
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error creating court." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const adminClient = getAdminSupabaseClient();
    const dbClient = adminClient ?? supabase;

    if (!user && !adminClient) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as CourtUpdateRequest;

    if (!body.id || typeof body.id !== "string") {
      return NextResponse.json(
        { error: "Court ID is required." },
        { status: 400 },
      );
    }

    const patch: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim().length > 0) {
      patch.name = body.name.trim();
    }
    if (typeof body.surface === "string") {
      patch.surface = body.surface.trim();
    }
    if (typeof body.zone === "string") {
      patch.zone = body.zone.trim();
    }
    if (typeof body.pricePerHour === "number" && body.pricePerHour >= 0) {
      patch.price_per_hour = body.pricePerHour;
    }
    if (body.nightPricePerHour !== undefined) {
      patch.night_price_per_hour =
        body.nightPricePerHour != null && Number(body.nightPricePerHour) >= 0
          ? Number(body.nightPricePerHour)
          : null;
    }
    if (typeof body.nightStartsAt === "string") {
      patch.night_starts_at = formatTimeHHMM(body.nightStartsAt, "17:00");
    }
    if (typeof body.open === "string") {
      patch.opens_at = formatTimeHHMM(body.open, "06:00");
    }
    if (typeof body.close === "string") {
      patch.closes_at = formatTimeHHMM(body.close, "22:00");
    }
    if (
      patch.opens_at &&
      patch.closes_at &&
      patch.opens_at === patch.closes_at
    ) {
      patch.closes_at = "23:59";
    }
    if (typeof body.enabled === "boolean") {
      patch.is_enabled = body.enabled;
    }
    if (body.image !== undefined) {
      patch.image_url =
        typeof body.image === "string" && body.image.trim().length > 0
          ? body.image
          : null;
    }

    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await dbClient
        .from("courts")
        .update(patch)
        .eq("id", body.id);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 400 },
        );
      }
    }

    if (Array.isArray(body.slots)) {
      await dbClient.from("court_slots").delete().eq("court_id", body.id);
      if (body.slots.length > 0) {
        const slotInserts = body.slots.map((s) => ({
          court_id: body.id,
          is_enabled: true,
          start_time: s,
        }));
        await dbClient.from("court_slots").insert(slotInserts);
      }
    }

    const { data: updatedRow } = await dbClient
      .from("courts")
      .select(
        "id, name, surface, zone, price_per_hour, night_price_per_hour, night_starts_at, opens_at, closes_at, is_enabled, image_url",
      )
      .eq("id", body.id)
      .maybeSingle();

    return NextResponse.json(
      {
        court: updatedRow
          ? {
              close:
                typeof updatedRow.closes_at === "string"
                  ? updatedRow.closes_at.slice(0, 5)
                  : "22:00",
              enabled: Boolean(updatedRow.is_enabled),
              id: String(updatedRow.id),
              image: updatedRow.image_url ?? undefined,
              name: String(updatedRow.name),
              nightPricePerHour:
                updatedRow.night_price_per_hour != null
                  ? Number(updatedRow.night_price_per_hour)
                  : undefined,
              nightStartsAt:
                typeof updatedRow.night_starts_at === "string"
                  ? updatedRow.night_starts_at.slice(0, 5)
                  : "17:00",
              open:
                typeof updatedRow.opens_at === "string"
                  ? updatedRow.opens_at.slice(0, 5)
                  : "06:00",
              pricePerHour: Number(updatedRow.price_per_hour),
              slots: body.slots ?? [],
              surface: String(updatedRow.surface ?? "standard"),
              zone: String(updatedRow.zone ?? ""),
            }
          : undefined,
        success: true,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error updating court." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const adminClient = getAdminSupabaseClient();
    const dbClient = adminClient ?? supabase;

    if (!user && !adminClient) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Court ID is required." },
        { status: 400 },
      );
    }

    const { error: deleteError } = await dbClient
      .from("courts")
      .delete()
      .eq("id", id);

    if (deleteError) {
      const { error: disableError } = await dbClient
        .from("courts")
        .update({ is_enabled: false })
        .eq("id", id);

      if (disableError) {
        return NextResponse.json(
          { error: disableError.message },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error deleting court." },
      { status: 500 },
    );
  }
}
