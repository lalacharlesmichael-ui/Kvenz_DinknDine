import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type BookingRequest = {
  addonComments?: unknown;
  amount?: unknown;
  ballQty?: unknown;
  courtId?: unknown;
  courtName?: unknown;
  date?: unknown;
  hours?: unknown;
  id?: unknown;
  paddleQty?: unknown;
  paymentMethod?: unknown;
  paymentReference?: unknown;
  receiptPath?: unknown;
  startTime?: unknown;
};

type BookingActionRequest = {
  action?: unknown;
  id?: unknown;
  rejectionReason?: unknown;
};

type RelatedObject = Record<string, unknown> | Record<string, unknown>[] | null;
type BookingRow = Record<string, unknown> & {
  court?: RelatedObject;
  player?: RelatedObject;
};

const PADDLE_RENTAL_PRICE = 50;
const PICKLEBALL_PRICE = 100;
const RECEIPT_SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60;
const MINUTES_PER_DAY = 24 * 60;
const bookingSelect = `
  id,
  court_id,
  player_id,
  booking_date,
  starts_at,
  ends_at,
  hours,
  amount,
  paddle_qty,
  ball_qty,
  addon_comments,
  status,
  payment_method,
  payment_status,
  payment_reference,
  receipt_path,
  rejection_reason,
  court:courts!bookings_court_id_fkey(name),
  player:profiles!bookings_player_id_fkey(full_name, username)
`;
const bookingAvailabilitySelect = `
  id,
  court_id,
  player_id,
  booking_date,
  starts_at,
  ends_at,
  hours,
  amount,
  status,
  payment_method,
  payment_status,
  court:courts!bookings_court_id_fkey(name)
`;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function addDays(date: string, days: number) {
  const parsedDate = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  parsedDate.setUTCDate(parsedDate.getUTCDate() + days);

  return parsedDate.toISOString().slice(0, 10);
}

function formatMinutesAsTime(totalMinutes: number) {
  const normalizedMinutes =
    ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalizedMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (normalizedMinutes % 60).toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}

function timeToMinutes(time: string) {
  const [startHour, startMin] = time.split(":").map(Number);

  return (startHour || 0) * 60 + (startMin || 0);
}

function courtCloseMinutes(open: string, close: string) {
  const openMinutes = timeToMinutes(open);
  const closeMinutes = timeToMinutes(close);

  if (closeMinutes === MINUTES_PER_DAY - 1) {
    return MINUTES_PER_DAY;
  }

  return closeMinutes <= openMinutes
    ? closeMinutes + MINUTES_PER_DAY
    : closeMinutes;
}

function formatDatabaseTime(value: unknown, fallback: string) {
  return typeof value === "string" && value.length >= 5
    ? value.slice(0, 5)
    : fallback;
}

function addHours(date: string, time: string, hours: number) {
  const totalStartMinutes = timeToMinutes(time);
  const totalEndMinutes = totalStartMinutes + hours * 60;
  const endDayOffset = Math.floor(totalEndMinutes / MINUTES_PER_DAY);
  const endDate = addDays(date, endDayOffset);
  const endTime = formatMinutesAsTime(totalEndMinutes);

  return {
    endsAt: `${endDate}T${endTime}:00+08:00`,
    startsAt: `${date}T${time}:00+08:00`,
  };
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function toText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toPositiveNumber(value: unknown) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : null;
}

function toOptionalNonNegativeNumber(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue) && numericValue >= 0
    ? numericValue
    : null;
}

function toNonNegativeInteger(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const numericValue = Number(value);

  return Number.isInteger(numericValue) && numericValue >= 0
    ? numericValue
    : null;
}

function toPaymentMethod(method: unknown) {
  if (method === "GCash") {
    return "gcash";
  }

  if (method === "Bank Transfer") {
    return "bank_transfer";
  }

  return null;
}

function fromPaymentMethod(method: unknown) {
  return method === "bank_transfer" ? "Bank Transfer" : "GCash";
}

function fromBookingStatus(status: unknown) {
  switch (status) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    case "completed":
      return "Completed";
    default:
      return "Pending";
  }
}

function fromPaymentStatus(status: unknown) {
  switch (status) {
    case "submitted":
      return "Submitted";
    case "verified":
      return "Verified";
    case "rejected":
      return "Rejected";
    default:
      return "Awaiting Proof";
  }
}

function relatedValue(value: RelatedObject | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatBookingTime(value: unknown) {
  const fallback =
    typeof value === "string" && value.length >= 16 ? value.slice(11, 16) : "00:00";
  const date = typeof value === "string" ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(date);
}

function isDirectReceiptSource(value: string) {
  return (
    value.startsWith("data:") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/")
  );
}

function receiptNameFromPath(value: unknown) {
  const receiptPath = toText(value);

  if (!receiptPath) {
    return "";
  }

  if (receiptPath.startsWith("data:")) {
    return "Uploaded receipt";
  }

  const pathWithoutQuery = receiptPath.split("?")[0] ?? receiptPath;

  return pathWithoutQuery.split("/").pop() ?? receiptPath;
}

async function receiptUrlFromPath(
  supabase: SupabaseClient,
  value: unknown,
) {
  const receiptPath = toText(value);

  if (!receiptPath) {
    return undefined;
  }

  if (isDirectReceiptSource(receiptPath)) {
    return receiptPath;
  }

  if (!receiptPath.includes("/")) {
    return undefined;
  }

  const { data, error } = await supabase.storage
    .from("payment-receipts")
    .createSignedUrl(
      receiptPath,
      RECEIPT_SIGNED_URL_EXPIRES_IN_SECONDS,
    );

  if (error || !data?.signedUrl) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      return `${supabaseUrl}/storage/v1/object/public/payment-receipts/${receiptPath}`;
    }
    return undefined;
  }

  return data.signedUrl;
}

function mapBookingRow(
  row: BookingRow,
  anonymous = false,
  receiptUrl?: string,
) {
  const court = relatedValue(row.court);
  const player = relatedValue(row.player);
  const username =
    typeof player?.username === "string" ? player.username : undefined;
  const fullName =
    typeof player?.full_name === "string" && player.full_name.trim().length > 0
      ? player.full_name
      : username;

  return {
    amount: Number(row.amount ?? 0),
    ballQty: Number(row.ball_qty ?? 0) || undefined,
    comments:
      typeof row.addon_comments === "string" && row.addon_comments.trim()
        ? row.addon_comments
        : undefined,
    courtId: String(row.court_id ?? ""),
    courtName: typeof court?.name === "string" ? court.name : "Court",
    date: String(row.booking_date ?? ""),
    endTime: formatBookingTime(row.ends_at),
    hours: Number(row.hours ?? 0),
    id: String(row.id ?? ""),
    paddleQty: Number(row.paddle_qty ?? 0) || undefined,
    paymentMethod: fromPaymentMethod(row.payment_method),
    paymentStatus: fromPaymentStatus(row.payment_status),
    player: anonymous ? "Reserved Player" : fullName || "Player",
    playerUsername: anonymous ? undefined : username,
    receiptName: anonymous ? "" : receiptNameFromPath(row.receipt_path),
    receiptUrl: anonymous ? undefined : receiptUrl,
    reference:
      !anonymous && typeof row.payment_reference === "string"
        ? row.payment_reference
        : "",
    rejectionReason:
      typeof row.rejection_reason === "string" ? row.rejection_reason : undefined,
    startTime: formatBookingTime(row.starts_at),
    status: fromBookingStatus(row.status),
  };
}

async function mapBookingRowWithReceiptUrl(
  supabase: SupabaseClient,
  row: BookingRow,
  anonymous = false,
) {
  const receiptUrl = anonymous
    ? undefined
    : await receiptUrlFromPath(supabase, row.receipt_path);

  return mapBookingRow(row, anonymous, receiptUrl);
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
  const { isManager, supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const detailQuery = supabase
    .from("bookings")
    .select(bookingSelect)
    .order("created_at", { ascending: false });
  const detailResult = isManager
    ? await detailQuery
    : await detailQuery.eq("player_id", user.id);

  if (detailResult.error) {
    return NextResponse.json(
      { error: detailResult.error.message },
      { status: 400 },
    );
  }

  const bookings = await Promise.all(
    (detailResult.data ?? []).map((row) =>
      mapBookingRowWithReceiptUrl(supabase, row as BookingRow),
    ),
  );

  if (!isManager) {
    const adminSupabase = getAdminSupabaseClient();

    if (adminSupabase) {
      const availabilityResult = await adminSupabase
        .from("bookings")
        .select(bookingAvailabilitySelect)
        .in("status", ["pending", "approved"])
        .neq("player_id", user.id)
        .order("booking_date", { ascending: true });

      if (availabilityResult.error) {
        return NextResponse.json(
          { error: availabilityResult.error.message },
          { status: 400 },
        );
      }

      bookings.push(
        ...(availabilityResult.data ?? []).map((row) =>
          mapBookingRow(row as BookingRow, true),
        ),
      );
    }
  }

  const uniqueBookings = Array.from(
    new Map(bookings.map((booking) => [booking.id, booking])).values(),
  );

  return NextResponse.json({ bookings: uniqueBookings });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = (await request.json()) as BookingRequest;
  const bookingId = toText(body.id);
  const courtId = toText(body.courtId);
  const courtName = toText(body.courtName);
  const bookingDate = toText(body.date);
  const startTime = toText(body.startTime);
  const hours = toPositiveNumber(body.hours);
  const paymentMethod = toPaymentMethod(body.paymentMethod);
  const paymentReference = toText(body.paymentReference);
  const receiptPath = toText(body.receiptPath);
  const addonComments = toText(body.addonComments);
  const paddleQty = toNonNegativeInteger(body.paddleQty);
  const ballQty = toNonNegativeInteger(body.ballQty);
  const requestedAmount = toOptionalNonNegativeNumber(body.amount);

  if (bookingId && !uuidPattern.test(bookingId)) {
    return NextResponse.json(
      { error: "Booking id must be a valid UUID." },
      { status: 400 },
    );
  }

  if (
    !courtId ||
    !bookingDate ||
    !startTime ||
    !hours ||
    !paymentMethod ||
    !paymentReference ||
    paddleQty === null ||
    ballQty === null ||
    requestedAmount === null
  ) {
    return NextResponse.json(
      { error: "Missing booking details." },
      { status: 400 },
    );
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      { full_name: "", id: user.id, role: "player" },
      { ignoreDuplicates: true, onConflict: "id" },
    );

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message },
      { status: 400 },
    );
  }

  const { data: courtById, error: courtByIdError } = await supabase
    .from("courts")
    .select(
      "id, price_per_hour, night_price_per_hour, night_starts_at, opens_at, closes_at",
    )
    .eq("id", courtId)
    .eq("is_enabled", true)
    .maybeSingle();

  if (courtByIdError) {
    return NextResponse.json(
      { error: courtByIdError.message },
      { status: 400 },
    );
  }

  const { data: courtByName, error: courtByNameError } =
    !courtById && courtName
      ? await supabase
          .from("courts")
          .select(
            "id, price_per_hour, night_price_per_hour, night_starts_at, opens_at, closes_at",
          )
          .eq("name", courtName)
          .eq("is_enabled", true)
          .limit(1)
          .maybeSingle()
      : { data: null, error: null };

  if (courtByNameError) {
    return NextResponse.json(
      { error: courtByNameError.message },
      { status: 400 },
    );
  }

  const court = courtById
      ? {
          id: courtId,
          closes_at: courtById.closes_at,
          night_price_per_hour: courtById.night_price_per_hour,
          night_starts_at: courtById.night_starts_at,
          opens_at: courtById.opens_at,
          price_per_hour: courtById.price_per_hour,
        }
      : courtByName;

  if (!court) {
    return NextResponse.json(
      {
        error:
          "Selected court is not configured in Supabase. Run the court seed SQL, then refresh the booking page.",
      },
      { status: 400 },
    );
  }

  const pricePerHour = Number(court.price_per_hour);

  if (!Number.isFinite(pricePerHour) || pricePerHour < 0) {
    return NextResponse.json(
      { error: "Selected court has an invalid price." },
      { status: 400 },
    );
  }

  const courtOpenTime = formatDatabaseTime(court.opens_at, "06:00");
  const courtCloseTime = formatDatabaseTime(court.closes_at, "22:00");
  const requestedStartMinutes = timeToMinutes(startTime);
  const requestedEndMinutes = requestedStartMinutes + hours * 60;

  if (
    requestedStartMinutes < timeToMinutes(courtOpenTime) ||
    requestedEndMinutes > courtCloseMinutes(courtOpenTime, courtCloseTime)
  ) {
    return NextResponse.json(
      { error: "Booking is outside operating hours." },
      { status: 400 },
    );
  }

  const nightPrice = court.night_price_per_hour != null ? Number(court.night_price_per_hour) : pricePerHour;
  const nightStartStr = typeof court.night_starts_at === "string" ? court.night_starts_at.slice(0, 5) : "17:00";
  const [nHour, nMin] = nightStartStr.split(":").map(Number);
  const nightStartMins = (nHour || 17) * 60 + (nMin || 0);

  const [sHour, sMin] = startTime.split(":").map(Number);
  const startMins = (sHour || 0) * 60 + (sMin || 0);

  let calculatedCourtTotal = 0;
  for (let i = 0; i < hours; i++) {
    const slotMins = startMins + i * 60;
    if (slotMins >= nightStartMins) {
      calculatedCourtTotal += nightPrice;
    } else {
      calculatedCourtTotal += pricePerHour;
    }
  }

  const courtAmount = roundCurrency(calculatedCourtTotal);
  const paddleAmount = roundCurrency(paddleQty * PADDLE_RENTAL_PRICE);
  const ballAmount = roundCurrency(ballQty * PICKLEBALL_PRICE);
  const totalAmount = roundCurrency(courtAmount + paddleAmount + ballAmount);

  if (
    typeof requestedAmount === "number" &&
    Math.abs(requestedAmount - totalAmount) > 0.01
  ) {
    return NextResponse.json(
      { error: "Booking total changed. Please refresh and review the amount." },
      { status: 409 },
    );
  }

  const { endsAt, startsAt } = addHours(bookingDate, startTime, hours);
  const insertPayload = {
    addon_comments: addonComments || null,
    amount: totalAmount,
    ball_amount: ballAmount,
    ball_qty: ballQty,
    booking_date: bookingDate,
    court_amount: courtAmount,
    court_id: court.id,
    ends_at: endsAt,
    hold_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    hours,
    paddle_amount: paddleAmount,
    paddle_qty: paddleQty,
    payment_amount: totalAmount,
    payment_method: paymentMethod,
    payment_reference: paymentReference,
    payment_status: receiptPath ? "submitted" : "awaiting_proof",
    player_id: user.id,
    receipt_path: receiptPath || null,
    starts_at: startsAt,
    status: "pending",
    ...(bookingId ? { id: bookingId } : {}),
  };

  const { data, error } = await supabase
    .from("bookings")
    .insert(insertPayload)
    .select(bookingSelect)
    .single();

  if (error) {
    const errorMessage = error.message.toLowerCase();
    const isMissingBookingColumn =
      error.code === "PGRST204" ||
      errorMessage.includes("addon_comments") ||
      errorMessage.includes("paddle_qty") ||
      errorMessage.includes("ball_qty") ||
      errorMessage.includes("court_amount");
    const isOverlap =
      error.code === "23P01" || errorMessage.includes("overlap");

    return NextResponse.json(
      {
        error: isMissingBookingColumn
          ? "Booking database columns are missing. Run the booking SQL migration, then try again."
          : isOverlap
            ? "That court time is already locked or held."
            : error.message,
      },
      { status: isOverlap ? 409 : 400 },
    );
  }

  const adminSupabase = getAdminSupabaseClient() || supabase;
  const courtDisplayName = courtName || "Court";

  // Notify player of submitted booking
  await adminSupabase.from("notifications").insert({
    body: `Booking for ${courtDisplayName} on ${bookingDate} at ${startTime} was submitted.`,
    recipient_id: user.id,
    title: "Booking Placed",
  });

  // Notify admins of new booking request
  const { data: adminProfiles } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (adminProfiles && adminProfiles.length > 0) {
    const playerIdentifier =
      user.user_metadata?.full_name ||
      user.user_metadata?.username ||
      "A player";

    const adminNotifications = adminProfiles.map((admin) => ({
      body: `New booking submitted by ${playerIdentifier} for ${courtDisplayName} on ${bookingDate} at ${startTime}.`,
      recipient_id: admin.id,
      title: "New Booking Request",
    }));

    await adminSupabase.from("notifications").insert(adminNotifications);
  }

  return NextResponse.json(
    {
      booking: await mapBookingRowWithReceiptUrl(
        supabase,
        data as BookingRow,
      ),
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const { supabase, user } = await getCurrentUserAndRole();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = (await request.json()) as BookingActionRequest;
  const id = toText(body.id);
  const action = toText(body.action);

  if (!id || !uuidPattern.test(id)) {
    return NextResponse.json(
      { error: "Booking id must be a valid UUID." },
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
        rejection_reason:
          toText(body.rejectionReason) || "Payment details need manager follow-up.",
        status: "rejected",
      };
      break;
    case "cancel":
      updatePayload = {
        status: "cancelled",
      };
      break;
    case "complete":
      updatePayload = {
        status: "completed",
      };
      break;
    case "verify":
      updatePayload = {
        payment_status: "verified",
        verified_at: now,
        verified_by: user.id,
      };
      break;
    default:
      return NextResponse.json(
        { error: "Unknown booking action." },
        { status: 400 },
      );
  }

  const { data, error } = await supabase
    .from("bookings")
    .update(updatePayload)
    .eq("id", id)
    .select(bookingSelect)
    .single();

  if (error) {
    const errorMessage = error.message.toLowerCase();
    const isOverlap =
      error.code === "23P01" || errorMessage.includes("overlap");

    return NextResponse.json(
      {
        error: isOverlap
          ? "That court time is already locked or held."
          : error.message,
      },
      { status: isOverlap ? 409 : 400 },
    );
  }

  const adminSupabase = getAdminSupabaseClient() || supabase;
  const bookingPlayerId = String((data as BookingRow).player_id ?? "");
  const courtObj = relatedValue((data as BookingRow).court as RelatedObject);
  const courtDisplayName =
    typeof courtObj?.name === "string" ? courtObj.name : "Court";
  const bDate = String((data as BookingRow).booking_date ?? "");
  const bTime = formatBookingTime((data as BookingRow).starts_at);

  if (bookingPlayerId) {
    let notifTitle = "";
    let notifBody = "";

    switch (action) {
      case "approve":
      case "verify":
        notifTitle = "Booking Approved";
        notifBody = `Your booking for ${courtDisplayName} on ${bDate} at ${bTime} has been approved!`;
        break;
      case "reject":
        notifTitle = "Booking Rejected";
        notifBody = `Your booking for ${courtDisplayName} on ${bDate} at ${bTime} was rejected. Reason: ${toText(body.rejectionReason) || "Payment details need manager follow-up."}`;
        break;
      case "cancel":
        notifTitle = "Booking Cancelled";
        notifBody = `Your booking for ${courtDisplayName} on ${bDate} at ${bTime} was cancelled.`;
        break;
      case "complete":
        notifTitle = "Booking Completed";
        notifBody = `Your booking for ${courtDisplayName} on ${bDate} at ${bTime} is now complete. Thanks for playing!`;
        break;
    }

    if (notifTitle && notifBody) {
      await adminSupabase.from("notifications").insert({
        body: notifBody,
        recipient_id: bookingPlayerId,
        title: notifTitle,
      });
    }
  }

  return NextResponse.json({
    booking: await mapBookingRowWithReceiptUrl(supabase, data as BookingRow),
  });
}
