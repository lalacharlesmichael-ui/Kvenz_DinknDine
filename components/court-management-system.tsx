"use client";

import Image from "next/image";
import {
  Banknote,
  Bell,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  FileImage,
  Gauge,
  LayoutDashboard,
  Lock,
  LogIn,
  LogOut,
  Megaphone,
  Pencil,
  Phone,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Trophy,
  Upload,
  UserPlus,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/form";
import {
  paymentSettings,
  type Booking,
  type BookingStatus,
  type Court,
  type Event as CourtEvent,
  type OpenPlayMatch,
  type OpenPlayFormat,
  type OpenPlayParticipant,
  type OpenPlaySession,
  type PaymentMethod,
  type PaymentStatus,
  type Role,
  type SkillLevel,
  type Tournament,
} from "@/lib/app-data";
import {
  normalizeUsername,
  usernameToAuthEmailCandidates,
} from "@/lib/auth/username";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type PlayerTab = "book" | "bookings" | "open-play" | "tournaments" | "events";
type AdminTab =
  | "dashboard"
  | "requests"
  | "courts"
  | "open-play"
  | "reports"
  | "settings";
type BadgeVariant =
  | "default"
  | "warning"
  | "success"
  | "destructive"
  | "neutral"
  | "info";

type BlockedSlot = {
  id: string;
  courtId: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
};

type PersonalNotification = {
  id: string;
  username: string;
  message: string;
  createdAt: string;
  title?: string;
  readAt?: string | null;
};

type PaymentSettingsState = typeof paymentSettings;
type AuthMode = "login" | "register";
type SignedInUser = {
  fullName: string;
  username: string;
  role: Role;
};
type BookingAction = "approve" | "reject" | "cancel" | "complete" | "verify";
type OpenPlayApplicantSkillLevel = Exclude<SkillLevel, "All Levels">;
type MatchSkillLevel = OpenPlayApplicantSkillLevel;
type OpenPlayApplicantAction = "approve" | "reject" | "remove";
type CompetitionRound = OpenPlayMatch["round"];
type TournamentParticipantRecord = {
  id: string;
  tournamentId: string;
  playerName: string;
  playerUsername?: string;
  status: "Pending" | "Approved" | "Rejected";
};
type TournamentMatch = {
  id: string;
  tournamentId: string;
  round: CompetitionRound;
  playerOne: string;
  playerTwo: string;
  teamOnePlayers?: string[];
  teamTwoPlayers?: string[];
  score: string;
  winner?: string;
};

const OPEN_PLAY_SKILL_OPTIONS: SkillLevel[] = [
  "All Levels",
  "Beginner",
  "Novice",
  "Intermediate",
  "Advanced",
];
const OPEN_PLAY_FORMAT_OPTIONS: OpenPlayFormat[] = [
  "Men's Doubles",
  "Women's Doubles",
  "Mixed Doubles",
];
const OPEN_PLAY_APPLICANT_SKILL_OPTIONS: OpenPlayApplicantSkillLevel[] = [
  "Beginner",
  "Novice",
  "Intermediate",
  "Advanced",
];
const COMPETITION_ROUNDS: CompetitionRound[] = [
  "Elimination",
  "Semifinals",
  "Finals",
];

const today = "2026-08-16";
const DEFAULT_BOOKING_DATE = "2026-08-20";
const noConfiguredCourt: Court = {
  close: "00:00",
  enabled: false,
  id: "",
  name: "No court configured",
  open: "00:00",
  pricePerHour: 0,
  slots: [],
  surface: "",
  zone: "",
};

const DEFAULT_COURT_IMAGES = [
  {
    label: "Blue & Green Acrylic",
    url: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=1200&auto=format&fit=crop",
  },
  {
    label: "Outdoor Hardcourt",
    url: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=1200&auto=format&fit=crop",
  },
  {
    label: "Covered Arena",
    url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1200&auto=format&fit=crop",
  },
  {
    label: "Indoor Lighting",
    url: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1200&auto=format&fit=crop",
  },
];

const currency = new Intl.NumberFormat("en-PH", {
  currency: "PHP",
  maximumFractionDigits: 0,
  style: "currency",
});
const MINUTES_PER_DAY = 24 * 60;

function formatCurrency(value: number) {
  return currency.format(value);
}

function formatTime12Hour(time24: string): string {
  if (!time24 || typeof time24 !== "string") return time24;
  const parts = time24.trim().split(":");
  if (parts.length < 2) return time24;

  const rawHours = parseInt(parts[0], 10);
  const minutes = parts[1].slice(0, 2).padStart(2, "0");
  if (isNaN(rawHours)) return time24;

  const normalizedHours = rawHours % 24;
  const ampm = normalizedHours >= 12 ? "PM" : "AM";
  let hours = normalizedHours % 12;
  if (hours === 0) hours = 12;

  return `${hours}:${minutes} ${ampm}`;
}

function formatTimeRange12Hour(start24: string, end24: string): string {
  return `${formatTime12Hour(start24)} - ${formatTime12Hour(end24)}`;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function addHours(time: string, hoursToAdd: number) {
  const totalMinutes = timeToMinutes(time) + hoursToAdd * 60;
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");

  return `${hours}:${minutes}`;
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

function rangeEndMinutes(start: string, end: string) {
  const startMinutes = timeToMinutes(start);
  let endMinutes = timeToMinutes(end);

  if (endMinutes <= startMinutes) {
    endMinutes += MINUTES_PER_DAY;
  }

  return endMinutes;
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

function rangesOverlap(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
) {
  const firstStartMinutes = timeToMinutes(firstStart);
  const firstEndMinutes = rangeEndMinutes(firstStart, firstEnd);
  const secondStartMinutes = timeToMinutes(secondStart);
  const secondEndMinutes = rangeEndMinutes(secondStart, secondEnd);

  return (
    firstStartMinutes < secondEndMinutes &&
    secondStartMinutes < firstEndMinutes
  );
}

function getCompleteCourtSlots(court: Court): string[] {
  const openMin = timeToMinutes(court.open || "06:00");
  const closeMin = courtCloseMinutes(
    court.open || "06:00",
    court.close || "22:00",
  );
  const slots: string[] = [];

  for (let m = openMin; m < closeMin; m += 60) {
    slots.push(formatMinutesAsTime(m));
  }

  if (court.slots && court.slots.length > 0) {
    const set = new Set([...slots, ...court.slots]);
    return Array.from(set).sort();
  }

  return slots;
}

function statusVariant(
  status: BookingStatus | PaymentStatus | string,
): BadgeVariant {
  if (
    ["Approved", "Verified", "Completed", "Open", "Scheduled"].includes(status)
  ) {
    return "success";
  }

  if (
    ["Pending", "Submitted", "Awaiting Proof", "Draft", "In Progress"].includes(
      status,
    )
  ) {
    return "warning";
  }

  if (["Rejected", "Cancelled", "Closed"].includes(status)) {
    return "destructive";
  }

  if (status === "Full") {
    return "neutral";
  }

  return "default";
}

function createBookingId(bookings: Booking[]) {
  return `BKG-${1043 + bookings.length}`;
}

function nameFromUsername(username: string) {
  return username.replace(/[_-]+/g, " ").trim() || "KVENS Player";
}

function formatSessionCourts(session: OpenPlaySession) {
  const courtNames = session.courtNames?.filter(Boolean);

  return courtNames && courtNames.length > 0
    ? courtNames.join(", ")
    : session.courtName;
}

function formatSessionSkillLevels(session: OpenPlaySession) {
  const skillLevels = session.skillLevels?.filter(Boolean);

  return skillLevels && skillLevels.length > 0
    ? skillLevels.join(", ")
    : session.skillLevel;
}

function formatSessionFormats(session: OpenPlaySession) {
  const formats = session.formats?.filter(Boolean);

  return formats && formats.length > 0 ? formats.join(", ") : "Doubles";
}

function getOpenPlaySkillChoices(
  session: OpenPlaySession,
): OpenPlayApplicantSkillLevel[] {
  const sessionSkillLevels =
    session.skillLevels
      ?.filter(
        (level): level is OpenPlayApplicantSkillLevel =>
          level !== "All Levels",
      )
      .filter((level) => OPEN_PLAY_APPLICANT_SKILL_OPTIONS.includes(level)) ??
    [];

  return sessionSkillLevels.length > 0
    ? sessionSkillLevels
    : OPEN_PLAY_APPLICANT_SKILL_OPTIONS;
}

function getDefaultOpenPlaySkillLevel(session: OpenPlaySession) {
  return getOpenPlaySkillChoices(session)[0] ?? "Beginner";
}

function safeNormalizeUsername(value: string, fallback = "player_user") {
  try {
    return normalizeUsername(value);
  } catch {
    return fallback;
  }
}

function shufflePlayers(players: OpenPlayParticipant[]) {
  return [...players].sort(() => Math.random() - 0.5);
}

function shuffleNames(players: string[]) {
  return [...players].sort(() => Math.random() - 0.5);
}

function pairNames<T>(items: T[]) {
  const pairs: Array<[T, T | undefined]> = [];

  for (let index = 0; index < items.length; index += 2) {
    pairs.push([items[index], items[index + 1]]);
  }

  return pairs;
}

function teamLabel(players: string[]) {
  return players.filter(Boolean).join(" / ") || "Bye";
}

function playersFromTeamLabel(label: string) {
  return label === "Bye"
    ? []
    : label
        .split("/")
        .map((player) => player.trim())
        .filter(Boolean);
}

function doublesTeams(playerNames: string[]) {
  const teams: string[][] = [];

  for (let index = 0; index + 1 < playerNames.length; index += 2) {
    teams.push([playerNames[index], playerNames[index + 1]]);
  }

  return teams;
}

function isPlayerPickedInOtherSlot(
  playerName: string,
  currentValue: string,
  selectedPlayers: string[],
) {
  return playerName !== currentValue && selectedPlayers.includes(playerName);
}

function matchNeedsWinner<
  TMatch extends {
    playerTwo: string;
    winner?: string;
  },
>(match: TMatch) {
  return match.playerTwo !== "Bye" && !match.winner;
}

function competitionChampion<
  TMatch extends {
    round: CompetitionRound;
    winner?: string;
  },
>(matches: TMatch[]) {
  return matches.find((match) => match.round === "Finals" && match.winner)
    ?.winner;
}

function DoublesTeamBoard({
  compact = false,
  teamOne,
  teamTwo,
}: {
  compact?: boolean;
  teamOne: string;
  teamTwo: string;
}) {
  return (
    <div
      className={
        compact
          ? "grid gap-2"
          : "mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center"
      }
    >
      <div className="rounded-md border border-stone-200 bg-white p-3">
        <p className="text-xs font-bold uppercase text-stone-500">Team 1</p>
        <p className="mt-1 font-semibold text-stone-950">{teamOne}</p>
      </div>
      <div className="text-center text-xs font-bold uppercase text-stone-500">
        vs
      </div>
      <div className="rounded-md border border-stone-200 bg-white p-3">
        <p className="text-xs font-bold uppercase text-stone-500">Team 2</p>
        <p className="mt-1 font-semibold text-stone-950">{teamTwo}</p>
      </div>
    </div>
  );
}

function getReceiptSrc(receiptName?: string, receiptUrl?: string) {
  if (receiptUrl && receiptUrl.trim().length > 0) {
    return receiptUrl.trim();
  }

  if (!receiptName || receiptName.trim().length === 0) return null;
  const name = receiptName.trim();

  // If it's a data URL (uploaded file), direct URL, or local path
  if (
    name.startsWith("data:") ||
    name.startsWith("http://") ||
    name.startsWith("https://") ||
    name.startsWith("/")
  ) {
    return name;
  }

  // If it's a Supabase storage path like "userId/bookingId/filename.png"
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (name.includes("/")) {
    if (supabaseUrl) {
      return `${supabaseUrl}/storage/v1/object/public/payment-receipts/${name}`;
    }
  }

  // Legacy receipt-name fallbacks for older local records.
  if (name.includes("maria")) {
    return "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=800&auto=format&fit=crop";
  }
  if (name.includes("carlo") || name.includes("pdf")) {
    return "https://images.unsplash.com/photo-1554224154-26032ffc0d07?q=80&w=800&auto=format&fit=crop";
  }
  if (name.includes("elena") || name.includes("gcash")) {
    return "https://images.unsplash.com/photo-1556742049-0a67daf4005a?q=80&w=800&auto=format&fit=crop";
  }

  return null;
}

function isImageReceiptSource(src: string, receiptName = "") {
  if (!src) return false;
  const source = src.toLowerCase();
  const name = receiptName.toLowerCase();
  const imageExtensionPattern = /\.(png|jpe?g|webp|gif|bmp|avif)(?:$|[?#])/;

  return (
    source.startsWith("data:image/") ||
    source.startsWith("data:") ||
    imageExtensionPattern.test(source) ||
    /\.(png|jpe?g|webp|gif|bmp|avif)$/.test(name) ||
    source.includes("unsplash.com") ||
    source.includes("/storage/v1/object/")
  );
}

function createNotificationId() {
  return `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

function createTimestampId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

function formatDatabaseTime(value: unknown, fallback = "08:00") {
  return typeof value === "string" && value.length >= 5
    ? value.slice(0, 5)
    : fallback;
}

function calculateCourtBookingPrice(
  court: Court,
  startTime: string,
  hours: number,
): number {
  const dayRate = court.pricePerHour;
  const nightRate =
    court.nightPricePerHour != null && Number.isFinite(court.nightPricePerHour)
      ? court.nightPricePerHour
      : dayRate;
  const nightStartStr = court.nightStartsAt || "17:00";
  const [nHour, nMin] = nightStartStr.split(":").map(Number);
  const nightStartMins = (nHour || 17) * 60 + (nMin || 0);

  const [sHour, sMin] = startTime.split(":").map(Number);
  const startMins = (sHour || 0) * 60 + (sMin || 0);

  let total = 0;
  for (let i = 0; i < hours; i++) {
    const slotMins = startMins + i * 60;
    if (slotMins >= nightStartMins) {
      total += nightRate;
    } else {
      total += dayRate;
    }
  }

  return total;
}

function paymentQrPath(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return paymentSettings.qrCode;
  }

  return value.startsWith("/") ? value : `/images/${value}`;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-stone-100">
      <div
        className="h-full rounded-full bg-lime-400"
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

function NavButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors",
        active
          ? "bg-black text-lime-200"
          : "bg-white text-stone-700 hover:bg-stone-100",
      )}
      type="button"
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: typeof CalendarCheck;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-stone-600">{label}</span>
        <span
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-md",
            accent,
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-stone-950">{value}</p>
    </div>
  );
}

function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge variant={statusVariant(status)}>{status}</Badge>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PaymentInfoCard({
  paymentInfo,
}: {
  paymentInfo: PaymentSettingsState;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-lime-700" aria-hidden="true" />
          Payment Details
        </CardTitle>
        <CardDescription>
          Manual verification after receipt upload.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[104px_1fr] gap-4">
          <Image
            src={paymentInfo.qrCode}
            alt="Payment QR code"
            width={104}
            height={104}
            className="rounded-lg border border-stone-200"
          />
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-stone-950">GCash</p>
            <p className="text-stone-600">{paymentInfo.gcashNumber}</p>
            <p className="font-semibold text-stone-950">Bank</p>
            <p className="text-stone-600">
              {paymentInfo.bankName} · {paymentInfo.bankAccountNumber}
            </p>
            <p className="text-stone-600">{paymentInfo.bankAccountName}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AuthPanel({
  authMode,
  fullName,
  message,
  password,
  phone,
  signedInUser,
  supabaseReady,
  username,
  onAuthModeChange,
  onFullNameChange,
  onLogout,
  onPasswordChange,
  onPhoneChange,
  onUsernameChange,
  onSubmit,
}: {
  authMode: AuthMode;
  fullName: string;
  message: string;
  password: string;
  phone: string;
  signedInUser: SignedInUser | null;
  supabaseReady: boolean;
  username: string;
  onAuthModeChange: (mode: AuthMode) => void;
  onFullNameChange: (value: string) => void;
  onLogout: () => void | Promise<void>;
  onPasswordChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (signedInUser) {
    return (
      <Card className="border-lime-200 bg-white">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-black text-lime-200">
              {signedInUser.role === "admin" ? (
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              ) : (
                <UserRound className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-stone-950">
                  {signedInUser.fullName}
                </p>
                <Badge
                  variant={signedInUser.role === "admin" ? "default" : "info"}
                >
                  {signedInUser.role === "admin"
                    ? "Admin/Manager"
                    : "Player/User"}
                </Badge>
              </div>
              <p className="text-sm text-stone-600">@{signedInUser.username}</p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={onLogout}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log out
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-lime-200 bg-white">
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Account Access</CardTitle>
            <CardDescription>
              Login or create an account with username and password. Manager
              roles are assigned in the database.
            </CardDescription>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-stone-100 p-1">
            <button
              className={cn(
                "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors",
                authMode === "login"
                  ? "bg-black text-lime-200"
                  : "text-stone-700 hover:bg-white",
              )}
              type="button"
              aria-pressed={authMode === "login"}
              onClick={() => onAuthModeChange("login")}
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Login
            </button>
            <button
              className={cn(
                "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors",
                authMode === "register"
                  ? "bg-black text-lime-200"
                  : "text-stone-700 hover:bg-white",
              )}
              type="button"
              aria-pressed={authMode === "register"}
              onClick={() => onAuthModeChange("register")}
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Register
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!supabaseReady && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
            Account access is temporarily unavailable. Please contact the
            administrator.
          </p>
        )}
        <form
          className="grid gap-4 lg:grid-cols-4 lg:items-end"
          onSubmit={onSubmit}
        >
          {authMode === "register" && (
            <>
              <Field>
                <Label htmlFor="auth-name">Full Name</Label>
                <div className="relative">
                  <UserRound
                    className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-stone-400"
                    aria-hidden="true"
                  />
                  <Input
                    id="auth-name"
                    className="pl-9"
                    disabled={!supabaseReady}
                    placeholder="Juan Dela Cruz"
                    value={fullName}
                    onChange={(event) => onFullNameChange(event.target.value)}
                    required
                  />
                </div>
              </Field>

              <Field>
                <Label htmlFor="auth-phone">Phone</Label>
                <div className="relative">
                  <Phone
                    className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-stone-400"
                    aria-hidden="true"
                  />
                  <Input
                    id="auth-phone"
                    className="pl-9"
                    disabled={!supabaseReady}
                    placeholder="0917 000 0000"
                    value={phone}
                    onChange={(event) => onPhoneChange(event.target.value)}
                  />
                </div>
              </Field>
            </>
          )}

          <Field>
            <Label htmlFor="auth-username">Username</Label>
            <div className="relative">
              <UserRound
                className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-stone-400"
                aria-hidden="true"
              />
              <Input
                id="auth-username"
                className="pl-9"
                autoComplete="username"
                disabled={!supabaseReady}
                pattern="[A-Za-z0-9_]{3,32}"
                placeholder="juan_player"
                value={username}
                onChange={(event) => onUsernameChange(event.target.value)}
                required
              />
            </div>
          </Field>

          <Field>
            <Label htmlFor="auth-password">Password</Label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-stone-400"
                aria-hidden="true"
              />
              <Input
                id="auth-password"
                className="pl-9"
                disabled={!supabaseReady}
                type="password"
                minLength={6}
                placeholder="At least 6 characters"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                required
              />
            </div>
          </Field>

          <Button
            className="w-full lg:w-auto"
            type="submit"
            disabled={!supabaseReady}
          >
            {authMode === "login" ? (
              <LogIn className="h-4 w-4" aria-hidden="true" />
            ) : (
              <UserPlus className="h-4 w-4" aria-hidden="true" />
            )}
            {authMode === "login" ? "Login" : "Create Account"}
          </Button>
        </form>

        {message && (
          <p className="mt-4 rounded-lg border border-lime-200 bg-lime-50 p-3 text-sm font-medium text-lime-900">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function LandingHero({
  onLogin,
  onRegister,
}: {
  onLogin: () => void;
  onRegister: () => void;
}) {
  return (
    <section
      id="landing"
      className="relative isolate min-h-[84svh] overflow-hidden bg-black text-white"
    >
      <Image
        src="/kvenz.jpg"
        alt="KVENS PLACE DINK & DINE logo"
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-black/55" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-[84svh] w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/kvenz.jpg"
              alt="KVENS PLACE DINK & DINE logo"
              width={72}
              height={72}
              className="h-14 w-14 rounded-md border border-lime-300/50 object-cover shadow-lg shadow-lime-500/20"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-lime-300">
                Pickleball
              </p>
              <p className="text-sm font-semibold text-white">
                KVENS PLACE DINK &amp; DINE
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-6 rounded-md border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-stone-100 backdrop-blur lg:flex">
            <a
              className="transition-colors hover:text-lime-200"
              href="#landing"
            >
              Home
            </a>
            <a
              className="transition-colors hover:text-lime-200"
              href="#features"
            >
              Features
            </a>
            <a
              className="transition-colors hover:text-lime-200"
              href="#auth-gateway"
            >
              Access
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="border-lime-300/60 bg-white/10 text-white hover:bg-white/20"
              type="button"
              variant="outline"
              onClick={onLogin}
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Login
            </Button>
            <Button
              className="hidden bg-lime-300 text-black hover:bg-lime-200 sm:inline-flex"
              type="button"
              onClick={onRegister}
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Register
            </Button>
          </div>
        </nav>

        <div className="flex flex-1 items-center py-12">
          <div className="max-w-3xl">
            <Badge className="border-lime-300/40 bg-lime-300/15 text-lime-200">
              Court bookings, open play, tournaments, and events
            </Badge>
            <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[1.02] text-white sm:text-6xl lg:text-7xl">
              KVENS PLACE DINK &amp; DINE
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-200 sm:text-xl">
              A clean booking and club-management hub for players and managers,
              built around simple reservations, manual payment verification, and
              easy program registration.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                className="bg-lime-300 text-black hover:bg-lime-200"
                size="lg"
                type="button"
                onClick={onLogin}
              >
                <CalendarClock className="h-5 w-5" aria-hidden="true" />
                Login to Book
              </Button>
              <Button
                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                size="lg"
                type="button"
                variant="outline"
                onClick={onRegister}
              >
                <UserPlus className="h-5 w-5" aria-hidden="true" />
                Create Account
              </Button>
            </div>
          </div>
        </div>

        <div id="features" className="grid gap-3 pb-4 sm:grid-cols-3">
          {[
            ["Fast Booking", "Court, date, time, fee, receipt, approval."],
            ["Programs", "Open play, events, and manual tournaments."],
            [
              "Manager Tools",
              "Requests, payments, courts, reports, and posts.",
            ],
          ].map(([title, body]) => (
            <div
              className="rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur"
              key={title}
            >
              <p className="text-sm font-bold text-lime-200">{title}</p>
              <p className="mt-1 text-sm leading-6 text-stone-200">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CourtManagementSystem() {
  const supabaseReady = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );

  const [role, setRole] = useState<Role>("player");
  const [playerTab, setPlayerTab] = useState<PlayerTab>("book");
  const [adminTab, setAdminTab] = useState<AdminTab>("dashboard");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authFullName, setAuthFullName] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [signedInUser, setSignedInUser] = useState<SignedInUser | null>(null);
  const [managedCourts, setManagedCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [managedSessions, setManagedSessions] =
    useState<OpenPlaySession[]>([]);
  const [openPlayApplicants, setOpenPlayApplicants] = useState<
    OpenPlayParticipant[]
  >([]);
  const [openPlayMatchups, setOpenPlayMatchups] =
    useState<OpenPlayMatch[]>([]);
  const [selectedOpenPlaySessionId, setSelectedOpenPlaySessionId] =
    useState("");
  const [managedTournaments, setManagedTournaments] =
    useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [tournamentRegistrations, setTournamentRegistrations] = useState<
    TournamentParticipantRecord[]
  >([]);
  const [tournamentMatchups, setTournamentMatchups] = useState<
    TournamentMatch[]
  >([]);
  const [managedEvents, setManagedEvents] = useState<CourtEvent[]>([]);
  const [announcementList, setAnnouncementList] = useState<string[]>([]);
  const [paymentInfo, setPaymentInfo] =
    useState<PaymentSettingsState>(paymentSettings);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [bookingDataLoaded, setBookingDataLoaded] = useState(!supabaseReady);
  const [bookingDataMessage, setBookingDataMessage] = useState("");

  const [selectedCourtId, setSelectedCourtId] = useState("");
  const [selectedDate, setSelectedDate] = useState(DEFAULT_BOOKING_DATE);
  const [selectedStart, setSelectedStart] = useState("08:00");
  const [selectedHours, setSelectedHours] = useState(2);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("GCash");
  const [reference, setReference] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptName, setReceiptName] = useState("");
  const [receiptDataUrl, setReceiptDataUrl] = useState("");
  const [paddleQty, setPaddleQty] = useState(0);
  const [ballQty, setBallQty] = useState(0);
  const [addonComments, setAddonComments] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [confirmationTone, setConfirmationTone] = useState<"error" | "success">(
    "success",
  );

  const [bookingStep, setBookingStep] = useState(1);
  const [notifications, setNotifications] = useState<PersonalNotification[]>(
    [],
  );
  const [openPlayPaymentSessionId, setOpenPlayPaymentSessionId] = useState("");
  const [openPlayPaymentReference, setOpenPlayPaymentReference] = useState("");
  const [openPlayReceiptFile, setOpenPlayReceiptFile] = useState<File | null>(
    null,
  );
  const [openPlayReceiptName, setOpenPlayReceiptName] = useState("");
  const [openPlayReceiptDataUrl, setOpenPlayReceiptDataUrl] = useState("");
  const [openPlaySkillLevel, setOpenPlaySkillLevel] =
    useState<OpenPlayApplicantSkillLevel>("Beginner");
  const [openPlaySubmitPending, setOpenPlaySubmitPending] = useState(false);
  const [openPlayStatusMessage, setOpenPlayStatusMessage] = useState("");
  const [openPlayStatusSessionId, setOpenPlayStatusSessionId] = useState("");
  const [openPlayStatusTone, setOpenPlayStatusTone] = useState<
    "error" | "success"
  >("success");
  const [registeredEvents, setRegisteredEvents] = useState<string[]>([]);

  const [adminSearch, setAdminSearch] = useState("");
  const [adminDate, setAdminDate] = useState("");
  const [adminStatus, setAdminStatus] = useState<"All" | BookingStatus>("All");
  const [adminPayment, setAdminPayment] = useState<"All" | PaymentMethod>(
    "All",
  );
  const [activeHeaderPopover, setActiveHeaderPopover] = useState<
    "payment" | "notifications" | "announcements" | null
  >(null);

  const [newCourtName, setNewCourtName] = useState("");
  const [newCourtSurface, setNewCourtSurface] = useState("Cushioned acrylic");
  const [newCourtZone, setNewCourtZone] = useState("Main area");
  const [newCourtOpen, setNewCourtOpen] = useState("06:00");
  const [newCourtClose, setNewCourtClose] = useState("22:00");
  const [newCourtPrice, setNewCourtPrice] = useState(400);
  const [newCourtNightPrice, setNewCourtNightPrice] = useState<
    number | undefined
  >(500);
  const [newCourtNightStartsAt, setNewCourtNightStartsAt] = useState("17:00");
  const [newCourtImage, setNewCourtImage] = useState("");

  const [editingCourt, setEditingCourt] = useState<Court | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<{
    player: string;
    src: string;
    title: string;
  } | null>(null);

  const [slotCourtId, setSlotCourtId] = useState("");
  const [newSlot, setNewSlot] = useState("21:00");
  const [blockDate, setBlockDate] = useState("2026-08-22");
  const [blockStart, setBlockStart] = useState("13:00");
  const [blockHours, setBlockHours] = useState(1);
  const [blockReason, setBlockReason] = useState("Private use");

  const [newSessionTitle, setNewSessionTitle] = useState("Skills Mixer");
  const [newSessionCourtIds, setNewSessionCourtIds] = useState<string[]>([]);
  const [newSessionDate, setNewSessionDate] = useState("2026-08-30");
  const [newSessionStart, setNewSessionStart] = useState("16:00");
  const [newSessionHours, setNewSessionHours] = useState(2);
  const [newSessionSkillLevels, setNewSessionSkillLevels] = useState<
    SkillLevel[]
  >(["All Levels"]);
  const [newSessionFormats, setNewSessionFormats] = useState<
    OpenPlayFormat[]
  >(["Mixed Doubles"]);
  const [newSessionMaxPlayers, setNewSessionMaxPlayers] = useState(12);
  const [newSessionFee, setNewSessionFee] = useState(200);
  const [newTournamentName, setNewTournamentName] = useState("Doubles Tune-up");
  const [manualOpenPlayTeamOneFirst, setManualOpenPlayTeamOneFirst] =
    useState("");
  const [manualOpenPlayTeamOneSecond, setManualOpenPlayTeamOneSecond] =
    useState("");
  const [manualOpenPlayTeamTwoFirst, setManualOpenPlayTeamTwoFirst] =
    useState("");
  const [manualOpenPlayTeamTwoSecond, setManualOpenPlayTeamTwoSecond] =
    useState("");
  const [manualTournamentTeamOneFirst, setManualTournamentTeamOneFirst] =
    useState("");
  const [manualTournamentTeamOneSecond, setManualTournamentTeamOneSecond] =
    useState("");
  const [manualTournamentTeamTwoFirst, setManualTournamentTeamTwoFirst] =
    useState("");
  const [manualTournamentTeamTwoSecond, setManualTournamentTeamTwoSecond] =
    useState("");
  const [newEventName, setNewEventName] = useState("Training Night");
  const [newAnnouncement, setNewAnnouncement] = useState("");

  const clearBookingDraftInputs = useCallback(() => {
    setSelectedDate(DEFAULT_BOOKING_DATE);
    setSelectedHours(2);
    setPaymentMethod("GCash");
    setReference("");
    setReceiptFile(null);
    setReceiptName("");
    setReceiptDataUrl("");
    setPaddleQty(0);
    setBallQty(0);
    setAddonComments("");
    setConfirmation("");
    setConfirmationTone("success");
    setBookingStep(1);
  }, []);

  const resetBookingDraft = useCallback(() => {
    const defaultCourt = managedCourts[0] ?? noConfiguredCourt;
    const defaultSlots = getCompleteCourtSlots(defaultCourt);

    setSelectedCourtId(defaultCourt.id);
    setSelectedStart(defaultSlots[0] ?? defaultCourt.open ?? "08:00");
    clearBookingDraftInputs();
  }, [clearBookingDraftInputs, managedCourts]);

  const handlePlayerTabChange = useCallback(
    (nextTab: PlayerTab) => {
      if (nextTab !== "book") {
        resetBookingDraft();
      }

      setPlayerTab(nextTab);
    },
    [resetBookingDraft],
  );

  useEffect(() => {
    if (!supabaseReady) {
      return;
    }

    let isMounted = true;
    const supabase = createSupabaseBrowserClient();

    async function hydrateSignedInUser() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!isMounted || error || !user) {
        return;
      }

      const metadataUsername =
        typeof user.user_metadata?.username === "string"
          ? user.user_metadata.username
          : "";
      const metadataName =
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : "";
      const emailUsername = user.email?.split("@")[0] ?? "";
      let username = safeNormalizeUsername(metadataUsername || emailUsername);
      let displayName = metadataName.trim() || nameFromUsername(username);
      let resolvedRole: Role = "player";

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role, username")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (typeof profile?.username === "string" && profile.username.trim()) {
        username = safeNormalizeUsername(profile.username, username);
      }

      if (
        typeof profile?.full_name === "string" &&
        profile.full_name.trim().length > 0
      ) {
        displayName = profile.full_name;
      }

      if (profile?.role === "admin" || profile?.role === "player") {
        resolvedRole = profile.role;
      }

      setSignedInUser({
        fullName: displayName,
        role: resolvedRole,
        username,
      });
      setRole(resolvedRole);

      if (resolvedRole === "admin") {
        setAdminTab("dashboard");
      } else {
        setPlayerTab("book");
      }
    }

    void hydrateSignedInUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) {
        return;
      }

      if (event === "SIGNED_OUT" || !session?.user) {
        clearBookingDraftInputs();
        setSelectedCourtId("");
        setSelectedStart("08:00");
        setSignedInUser(null);
        setRole("player");
        setPlayerTab("book");
        if (supabaseReady) {
          setBookings([]);
          setBlockedSlots([]);
          setManagedCourts([]);
          setBookingDataLoaded(false);
          setBookingDataMessage("");
        }
        return;
      }

      void hydrateSignedInUser();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [clearBookingDraftInputs, supabaseReady]);

  const refreshBookingsFromServer = useCallback(async () => {
    if (!supabaseReady || !signedInUser) {
      return;
    }

    const response = await fetch("/api/bookings", {
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      bookings?: Booking[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? "Booking data could not be loaded.");
    }

    setBookings(payload.bookings ?? []);
  }, [signedInUser, supabaseReady]);

  const refreshNotificationsFromServer = useCallback(async () => {
    if (!supabaseReady || !signedInUser) {
      return;
    }

    try {
      const response = await fetch("/api/notifications", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        notifications?: PersonalNotification[];
        error?: string;
      };

      if (response.ok && payload.notifications) {
        setNotifications(payload.notifications);
      }
    } catch {
      // ignore error
    }
  }, [signedInUser, supabaseReady]);

  const refreshOpenPlaySessionsFromServer = useCallback(async () => {
    if (!supabaseReady || !signedInUser) {
      return;
    }

    const response = await fetch("/api/open-play/sessions", {
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      error?: string;
      sessions?: OpenPlaySession[];
    };

    if (!response.ok) {
      throw new Error(
        payload.error ?? "Open-play session data could not be loaded.",
      );
    }

    const sessions = payload.sessions ?? [];
    setManagedSessions(sessions);
    setSelectedOpenPlaySessionId((currentId) => {
      if (sessions.some((session) => session.id === currentId)) {
        return currentId;
      }

      return sessions[0]?.id ?? "";
    });
  }, [signedInUser, supabaseReady]);

  const refreshOpenPlayApplicantsFromServer = useCallback(async () => {
    if (!supabaseReady || !signedInUser) {
      return;
    }

    const response = await fetch("/api/open-play/participants", {
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      applicants?: OpenPlayParticipant[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(
        payload.error ?? "Open-play applicant data could not be loaded.",
      );
    }

    setOpenPlayApplicants(payload.applicants ?? []);
  }, [signedInUser, supabaseReady]);

  useEffect(() => {
    if (!supabaseReady) {
      return;
    }

    if (!signedInUser) {
      return;
    }

    let isMounted = true;
    const supabase = createSupabaseBrowserClient();

    async function hydrateBookingData() {
      setBookingDataLoaded(false);
      setBookingDataMessage("");

      const [courtResult, slotResult, blockedResult, paymentResult] =
        await Promise.all([
          supabase
            .from("courts")
            .select(
              "id, name, surface, zone, price_per_hour, night_price_per_hour, night_starts_at, opens_at, closes_at, is_enabled, image_url",
            )
            .order("name", { ascending: true }),
          supabase
            .from("court_slots")
            .select("court_id, start_time, is_enabled")
            .eq("is_enabled", true)
            .order("start_time", { ascending: true }),
          supabase
            .from("blocked_slots")
            .select("id, court_id, block_date, start_time, end_time, reason")
            .gte("block_date", today)
            .order("block_date", { ascending: true }),
          supabase
            .from("payment_settings")
            .select(
              "gcash_number, bank_name, bank_account_name, bank_account_number, qr_code_path",
            )
            .eq("id", true)
            .maybeSingle(),
        ]);

      if (!isMounted) {
        return;
      }

      const loadError =
        courtResult.error ?? slotResult.error ?? blockedResult.error;

      if (loadError) {
        setManagedCourts([]);
        setBlockedSlots([]);
        setBookingDataLoaded(true);
        setBookingDataMessage(loadError.message);
        return;
      }

      const slotsByCourt = new Map<string, string[]>();

      for (const slot of slotResult.data ?? []) {
        const courtId = String(slot.court_id);
        const slots = slotsByCourt.get(courtId) ?? [];

        slots.push(formatDatabaseTime(slot.start_time));
        slotsByCourt.set(courtId, slots);
      }

      const nextCourts: Court[] = (courtResult.data ?? []).map((court) => ({
        close: formatDatabaseTime(court.closes_at, "22:00"),
        enabled: Boolean(court.is_enabled),
        id: String(court.id),
        image:
          typeof court.image_url === "string" &&
          court.image_url.trim().length > 0
            ? court.image_url
            : undefined,
        name: String(court.name),
        nightPricePerHour:
          court.night_price_per_hour != null
            ? Number(court.night_price_per_hour)
            : undefined,
        nightStartsAt: formatDatabaseTime(court.night_starts_at, "17:00"),
        open: formatDatabaseTime(court.opens_at, "06:00"),
        pricePerHour: Number(court.price_per_hour),
        slots: slotsByCourt.get(String(court.id)) ?? [],
        surface: String(court.surface ?? "standard"),
        zone: String(court.zone ?? ""),
      }));

      setManagedCourts(nextCourts);
      setBlockedSlots(
        (blockedResult.data ?? []).map((block) => ({
          courtId: String(block.court_id),
          courtName:
            nextCourts.find((court) => court.id === block.court_id)?.name ??
            "Court",
          date: String(block.block_date),
          endTime: formatDatabaseTime(block.end_time),
          id: String(block.id),
          reason: String(block.reason ?? "Blocked"),
          startTime: formatDatabaseTime(block.start_time),
        })),
      );

      if (paymentResult.data) {
        setPaymentInfo({
          bankAccountName: paymentResult.data.bank_account_name ?? "",
          bankAccountNumber: paymentResult.data.bank_account_number ?? "",
          bankName: paymentResult.data.bank_name ?? "",
          gcashNumber: paymentResult.data.gcash_number ?? "",
          qrCode: paymentQrPath(paymentResult.data.qr_code_path),
        });
      }

      if (nextCourts.length === 0) {
        setSelectedCourtId("");
        setSlotCourtId("");
        setNewSessionCourtIds([]);
        setBookingDataMessage(
          "No courts are configured yet. Add court records, then refresh this page.",
        );
      } else {
        const firstCourt = nextCourts[0];
        const firstCourtSlots = getCompleteCourtSlots(firstCourt);

        setSelectedCourtId(firstCourt.id);
        setSelectedStart(firstCourtSlots[0] ?? firstCourt.open);
        setSlotCourtId(firstCourt.id);
        setNewSessionCourtIds([firstCourt.id]);
      }

      try {
        await Promise.all([
          refreshBookingsFromServer(),
          refreshNotificationsFromServer(),
          refreshOpenPlayApplicantsFromServer(),
          refreshOpenPlaySessionsFromServer(),
        ]);
      } catch (error) {
        setBookings([]);
        setBookingDataMessage(
          error instanceof Error
            ? error.message
            : "Booking data could not be loaded.",
        );
      }

      setBookingDataLoaded(true);
    }

    void hydrateBookingData();

    return () => {
      isMounted = false;
    };
  }, [
    refreshBookingsFromServer,
    refreshNotificationsFromServer,
    refreshOpenPlayApplicantsFromServer,
    refreshOpenPlaySessionsFromServer,
    signedInUser,
    supabaseReady,
  ]);

  const selectedCourt =
    managedCourts.find((court) => court.id === selectedCourtId) ??
    managedCourts[0] ??
    noConfiguredCourt;
  const hasConfiguredCourts = managedCourts.length > 0;
  const bookingSetupPending =
    supabaseReady && Boolean(signedInUser) && !bookingDataLoaded;
  const selectedEnd = addHours(selectedStart, selectedHours);
  const courtAmount = calculateCourtBookingPrice(
    selectedCourt,
    selectedStart,
    selectedHours,
  );
  const paddleAmount = paddleQty * 50;
  const ballAmount = ballQty * 100;
  const grandTotalAmount = courtAmount + paddleAmount + ballAmount;
  const bookingAmount = grandTotalAmount;

  const completeSlots = useMemo(() => {
    return getCompleteCourtSlots(selectedCourt);
  }, [selectedCourt]);

  const slotOptions = useMemo(() => {
    return completeSlots.map((slot) => {
      const slotEnd = addHours(slot, 1);

      const approvedBooking = bookings.find(
        (booking) =>
          booking.courtId === selectedCourt.id &&
          booking.date === selectedDate &&
          booking.status === "Approved" &&
          rangesOverlap(slot, slotEnd, booking.startTime, booking.endTime),
      );

      const pendingBooking = bookings.find(
        (booking) =>
          booking.courtId === selectedCourt.id &&
          booking.date === selectedDate &&
          booking.status === "Pending" &&
          rangesOverlap(slot, slotEnd, booking.startTime, booking.endTime),
      );

      const blockConflict = blockedSlots.find(
        (block) =>
          block.courtId === selectedCourt.id &&
          block.date === selectedDate &&
          rangesOverlap(slot, slotEnd, block.startTime, block.endTime),
      );

      return {
        blocked: Boolean(blockConflict),
        blockReason: blockConflict?.reason,
        endTime: slotEnd,
        held: Boolean(pendingBooking),
        heldBy: pendingBooking?.player,
        locked: Boolean(approvedBooking),
        lockedBookingId: approvedBooking?.id,
        lockedBy: approvedBooking?.player,
        time: slot,
      };
    });
  }, [blockedSlots, bookings, completeSlots, selectedCourt, selectedDate]);

  const requestedEndMinutes = rangeEndMinutes(selectedStart, selectedEnd);
  const selectedCourtCloseMinutes = courtCloseMinutes(
    selectedCourt.open || "06:00",
    selectedCourt.close || "22:00",
  );
  const isExceedingClose = requestedEndMinutes > selectedCourtCloseMinutes;

  const overlappingApprovedBooking = bookings.find(
    (b) =>
      b.courtId === selectedCourt.id &&
      b.date === selectedDate &&
      b.status === "Approved" &&
      rangesOverlap(selectedStart, selectedEnd, b.startTime, b.endTime),
  );

  const overlappingPendingBooking = bookings.find(
    (b) =>
      b.courtId === selectedCourt.id &&
      b.date === selectedDate &&
      b.status === "Pending" &&
      rangesOverlap(selectedStart, selectedEnd, b.startTime, b.endTime),
  );

  const overlappingBlock = blockedSlots.find(
    (block) =>
      block.courtId === selectedCourt.id &&
      block.date === selectedDate &&
      rangesOverlap(
        selectedStart,
        selectedEnd,
        block.startTime,
        block.endTime,
      ),
  );

  const selectedSlotUnavailable = Boolean(
    isExceedingClose ||
    overlappingApprovedBooking ||
    overlappingPendingBooking ||
    overlappingBlock,
  );
  const unavailableScheduleMessage = isExceedingClose
    ? `The requested duration (${formatTimeRange12Hour(
        selectedStart,
        selectedEnd,
      )}) extends past court closing time (${formatTime12Hour(
        selectedCourt.close,
      )}).`
    : overlappingApprovedBooking
      ? `The requested range (${formatTimeRange12Hour(
          selectedStart,
          selectedEnd,
        )}) overlaps with an approved booking reserved by ${
          overlappingApprovedBooking.player
        } (${formatTimeRange12Hour(
          overlappingApprovedBooking.startTime,
          overlappingApprovedBooking.endTime,
        )}). Please select a different start time or duration.`
      : overlappingPendingBooking
        ? `The requested range (${formatTimeRange12Hour(
            selectedStart,
            selectedEnd,
          )}) overlaps with a pending reservation held by ${
            overlappingPendingBooking.player
          } (${formatTimeRange12Hour(
            overlappingPendingBooking.startTime,
            overlappingPendingBooking.endTime,
          )}).`
        : overlappingBlock
          ? `The requested range (${formatTimeRange12Hour(
              selectedStart,
              selectedEnd,
            )}) overlaps with a blocked slot (${overlappingBlock.reason}).`
          : "This schedule is unavailable. Please choose another time.";
  const bookingSteps = [
    "Schedule",
    "Payment, Proof & Addons",
    "Review",
  ];
  const canContinueBooking =
    bookingStep === 1
      ? hasConfiguredCourts && !bookingSetupPending && !selectedSlotUnavailable
      : bookingStep === 2
        ? reference.trim().length > 0 && receiptName.length > 0
        : true;
  const bookingSubmitDisabled =
    !signedInUser ||
    !hasConfiguredCourts ||
    bookingSetupPending ||
    receiptName.length === 0 ||
    reference.trim().length === 0;

  const currentPlayerName = signedInUser?.fullName ?? "You";
  const playerBookings = bookings.filter(
    (booking) =>
      booking.player === currentPlayerName || booking.player === "You",
  );
  const upcomingBookings = playerBookings.filter((booking) =>
    ["Pending", "Approved"].includes(booking.status),
  );
  const previousBookings = playerBookings.filter((booking) =>
    ["Rejected", "Cancelled", "Completed"].includes(booking.status),
  );

  const todayBookings = bookings.filter((booking) => booking.date === today);
  const pendingBookings = bookings.filter(
    (booking) => booking.status === "Pending",
  );
  const verifiedPayments = bookings.filter(
    (booking) => booking.paymentStatus === "Verified",
  );

  const filteredBookings = bookings.filter((booking) => {
    const query = adminSearch.toLowerCase().trim();
    const matchesQuery =
      query.length === 0 ||
      booking.player.toLowerCase().includes(query) ||
      booking.courtName.toLowerCase().includes(query) ||
      booking.reference.toLowerCase().includes(query);
    const matchesDate = adminDate.length === 0 || booking.date === adminDate;
    const matchesStatus =
      adminStatus === "All" || booking.status === adminStatus;
    const matchesPayment =
      adminPayment === "All" || booking.paymentMethod === adminPayment;

    return matchesQuery && matchesDate && matchesStatus && matchesPayment;
  });

  const selectedOpenPlaySession =
    managedSessions.find(
      (session) => session.id === selectedOpenPlaySessionId,
    ) ?? managedSessions[0];
  const selectedOpenPlayApplicants = openPlayApplicants.filter(
    (applicant) => applicant.sessionId === selectedOpenPlaySession?.id,
  );
  const selectedApprovedOpenPlayApplicants = selectedOpenPlayApplicants.filter(
    (applicant) =>
      applicant.status === "Approved" && applicant.paymentStatus === "Verified",
  );
  const hasOpenPlayRandomDoublesGroup = OPEN_PLAY_APPLICANT_SKILL_OPTIONS.some(
    (skillLevel) =>
      selectedApprovedOpenPlayApplicants.filter(
        (applicant) => applicant.skillLevel === skillLevel,
      ).length >= 4,
  );
  const selectedOpenPlayMatches = openPlayMatchups.filter(
    (match) => match.sessionId === selectedOpenPlaySession?.id,
  );
  const openPlayChampion = competitionChampion(selectedOpenPlayMatches);
  const manualOpenPlayTeamSelections = [
    manualOpenPlayTeamOneFirst,
    manualOpenPlayTeamOneSecond,
    manualOpenPlayTeamTwoFirst,
    manualOpenPlayTeamTwoSecond,
  ];
  const selectedTournament =
    managedTournaments.find(
      (tournament) => tournament.id === selectedTournamentId,
    ) ?? managedTournaments[0];
  const selectedTournamentRegistrations = tournamentRegistrations.filter(
    (participant) => participant.tournamentId === selectedTournament?.id,
  );
  const selectedApprovedTournamentRegistrations =
    selectedTournamentRegistrations.filter(
      (participant) => participant.status === "Approved",
    );
  const selectedTournamentMatches = tournamentMatchups.filter(
    (match) => match.tournamentId === selectedTournament?.id,
  );
  const selectedTournamentChampion = competitionChampion(
    selectedTournamentMatches,
  );
  const manualTournamentTeamSelections = [
    manualTournamentTeamOneFirst,
    manualTournamentTeamOneSecond,
    manualTournamentTeamTwoFirst,
    manualTournamentTeamTwoSecond,
  ];

  const openPlayParticipants =
    openPlayApplicants.filter((applicant) => applicant.status === "Approved")
      .length;
  const tournamentParticipants = managedTournaments.reduce(
    (total, tournament) => {
      const rosterCount = tournamentRegistrations.filter(
        (participant) =>
          participant.tournamentId === tournament.id &&
          participant.status !== "Rejected",
      ).length;

      return total + Math.max(tournament.participants, rosterCount);
    },
    0,
  );

  const userNotifications = useMemo(() => {
    if (!signedInUser) return [];
    const currentUsername = safeNormalizeUsername(signedInUser.username);
    return notifications.filter(
      (n) =>
        !n.username || safeNormalizeUsername(n.username) === currentUsername,
    );
  }, [notifications, signedInUser]);

  const unreadNotificationCount = useMemo(() => {
    return userNotifications.filter((n) => !n.readAt).length;
  }, [userNotifications]);

  async function pushNotification(
    message: string,
    targetUsername?: string,
    title?: string,
  ) {
    const recipient = targetUsername
      ? safeNormalizeUsername(targetUsername)
      : signedInUser
        ? safeNormalizeUsername(signedInUser.username)
        : "";

    const newNotif: PersonalNotification = {
      createdAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      id: createNotificationId(),
      message,
      readAt: null,
      title: title || "Notification",
      username: recipient,
    };

    setNotifications((items) => [newNotif, ...items].slice(0, 50));

    if (supabaseReady && signedInUser) {
      try {
        const response = await fetch("/api/notifications", {
          body: JSON.stringify({
            message,
            targetUsername: recipient,
            title: title || "Notification",
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        if (response.ok) {
          const payload = (await response.json()) as {
            notification?: PersonalNotification;
          };
          if (payload.notification) {
            setNotifications((items) =>
              items.map((item) =>
                item.id === newNotif.id ? payload.notification! : item,
              ),
            );
          }
        }
      } catch {
        // preserve optimistic state
      }
    }
  }

  async function markNotificationAsRead(id: string) {
    const now = new Date().toISOString();
    setNotifications((items) =>
      items.map((item) => (item.id === id ? { ...item, readAt: now } : item)),
    );

    if (supabaseReady && signedInUser) {
      try {
        await fetch("/api/notifications", {
          body: JSON.stringify({ id }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        });
      } catch {
        // ignore
      }
    }
  }

  async function markAllNotificationsAsRead() {
    const now = new Date().toISOString();
    setNotifications((items) =>
      items.map((item) => ({ ...item, readAt: item.readAt || now })),
    );

    if (supabaseReady && signedInUser) {
      try {
        await fetch("/api/notifications", {
          body: JSON.stringify({ markAll: true }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        });
      } catch {
        // ignore
      }
    }
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabaseReady) {
      setAuthMessage(
        "Account access is temporarily unavailable. Please contact the administrator.",
      );
      return;
    }

    const username = normalizeUsername(authUsername);
    let authEmails: string[] = [];

    try {
      authEmails = usernameToAuthEmailCandidates(username);
    } catch (error) {
      setAuthMessage(
        error instanceof Error
          ? error.message
          : "Please enter a valid username.",
      );
      return;
    }

    const fallbackName = nameFromUsername(username);
    let displayName =
      authMode === "register" && authFullName.trim().length > 0
        ? authFullName.trim()
        : fallbackName;

    let resolvedRole: Role = "player";

    try {
      const supabase = createSupabaseBrowserClient();
      const result = await (async () => {
        if (authMode === "register") {
          const response = await fetch("/api/auth/register", {
            body: JSON.stringify({
              fullName: displayName,
              password: authPassword,
              phone: authPhone,
              username,
            }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
          });

          const payload = (await response.json()) as { error?: string };

          if (!response.ok) {
            return {
              data: { user: null },
              error: {
                message: payload.error ?? "Unable to create account.",
              },
            };
          }

          return supabase.auth.signInWithPassword({
            email: authEmails[0],
            password: authPassword,
          });
        }

        let lastResult = await supabase.auth.signInWithPassword({
          email: authEmails[0],
          password: authPassword,
        });

        if (!lastResult.error || authEmails.length === 1) {
          return lastResult;
        }

        for (const legacyEmail of authEmails.slice(1)) {
          const legacyResult = await supabase.auth.signInWithPassword({
            email: legacyEmail,
            password: authPassword,
          });

          if (!legacyResult.error) {
            return legacyResult;
          }

          lastResult = legacyResult;
        }

        return lastResult;
      })();

      if (result.error) {
        setAuthMessage(
          result.error.message.includes("@")
            ? "Supabase rejected the generated username login address. Please refresh the page and try again."
            : result.error.message,
        );
        return;
      }

      if (authMode === "register" && !result.data.session) {
        setAuthMessage(
          "Account created, but Supabase confirmation is still enabled. Disable confirmation for username-only login, then sign in with this username.",
        );
        return;
      }

      if (result.data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role, username")
          .eq("id", result.data.user.id)
          .maybeSingle();

        if (
          typeof profile?.full_name === "string" &&
          profile.full_name.trim().length > 0
        ) {
          displayName = profile.full_name;
        }

        if (profile?.role === "admin" || profile?.role === "player") {
          resolvedRole = profile.role;
        }
      }
    } catch {
      setAuthMessage(
        "Account access is temporarily unavailable. Please try again later.",
      );
      return;
    }

    setSignedInUser({
      fullName: displayName,
      role: resolvedRole,
      username,
    });
    setRole(resolvedRole);
    setAuthPassword("");
    setAuthMessage(
      authMode === "login"
        ? `Welcome back, ${displayName}.`
        : `Account created for ${displayName}. You can now log in with your username.`,
    );

    if (resolvedRole === "admin") {
      setAdminTab("dashboard");
    } else {
      setPlayerTab("book");
    }

    pushNotification(
      `Welcome, ${displayName}! You signed in as ${
        resolvedRole === "admin" ? "Admin/Manager" : "Player"
      }.`,
      username,
    );
  }

  async function handleLogout() {
    const name = signedInUser?.fullName ?? "User";
    const currentUsername = signedInUser?.username;

    if (supabaseReady) {
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
      } catch {
        // Local state still clears so the gateway remains usable offline.
      }
    }

    if (currentUsername) {
      pushNotification(`${name} logged out.`, currentUsername);
    }

    resetBookingDraft();
    setSignedInUser(null);
    setRole("player");
    setPlayerTab("book");
    if (supabaseReady) {
      setBookings([]);
      setBlockedSlots([]);
      setManagedCourts([]);
      setManagedSessions([]);
      setOpenPlayApplicants([]);
      setOpenPlayMatchups([]);
      setSelectedOpenPlaySessionId("");
      setOpenPlayPaymentSessionId("");
      setOpenPlayPaymentReference("");
      setOpenPlayReceiptFile(null);
      setOpenPlayReceiptName("");
      setOpenPlayReceiptDataUrl("");
      setOpenPlayStatusMessage("");
      setOpenPlayStatusSessionId("");
      setBookingDataLoaded(false);
      setBookingDataMessage("");
    }
    setAuthMode("login");
    setAuthPassword("");
    setAuthMessage(`${name} has been logged out.`);
  }

  function actionFromBookingPatch(
    patch: Partial<Booking>,
  ): BookingAction | null {
    if (patch.status === "Approved") return "approve";
    if (patch.status === "Rejected") return "reject";
    if (patch.status === "Cancelled") return "cancel";
    if (patch.status === "Completed") return "complete";
    if (patch.paymentStatus === "Verified") return "verify";

    return null;
  }

  async function updateBooking(id: string, patch: Partial<Booking>) {
    if (supabaseReady) {
      const action = actionFromBookingPatch(patch);

      if (!action) {
        return false;
      }

      try {
        const response = await fetch("/api/bookings", {
          body: JSON.stringify({
            action,
            id,
            rejectionReason: patch.rejectionReason,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        });
        const payload = (await response.json()) as {
          error?: string;
        };

        if (!response.ok) {
          const message = payload.error ?? "Booking could not be updated.";
          setBookingDataMessage(message);
          pushNotification(message, signedInUser?.username);
          return false;
        }

        await refreshBookingsFromServer();
        setBookingDataMessage("");
        return true;
      } catch {
        const message =
          "Could not connect to the booking server. Please try again.";
        setBookingDataMessage(message);
        pushNotification(message, signedInUser?.username);
        return false;
      }
    }

    setBookings((items) =>
      items.map((booking) =>
        booking.id === id ? { ...booking, ...patch } : booking,
      ),
    );

    return true;
  }

  function handleCourtChange(value: string) {
    const nextCourt = managedCourts.find((court) => court.id === value);
    setSelectedCourtId(value);
    if (nextCourt) {
      const slots = getCompleteCourtSlots(nextCourt);
      setSelectedStart(slots[0] ?? "08:00");
    }
  }

  function handleReceiptChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setReceiptFile(file);
    setReceiptName(file?.name ?? "");
    setReceiptDataUrl("");

    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (typeof evt.target?.result === "string") {
          setReceiptDataUrl(evt.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  function handleBookingFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  async function handleBookingSubmit() {
    if (bookingStep !== 3) {
      return;
    }

    if (bookingSubmitDisabled) {
      if (!signedInUser) {
        setConfirmationTone("error");
        setConfirmation(
          "Please login or register before submitting a booking.",
        );
      }
      return;
    }

    if (selectedSlotUnavailable) {
      setConfirmationTone("error");
      setConfirmation(unavailableScheduleMessage);
      return;
    }

    let bookingId = createBookingId(bookings);
    let savedBooking: Booking | null = null;

    if (supabaseReady && globalThis.crypto?.randomUUID) {
      bookingId = globalThis.crypto.randomUUID();
    }

    let receiptPath = receiptDataUrl || receiptName;

    if (supabaseReady) {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setConfirmationTone("error");
          setConfirmation("Please login again before submitting your booking.");
          return;
        }

        if (receiptFile) {
          const safeFileName = receiptFile.name.replace(
            /[^a-zA-Z0-9._-]/g,
            "-",
          );
          const storagePath = `${user.id}/${bookingId}/${safeFileName}`;
          const { error: uploadError } = await supabase.storage
            .from("payment-receipts")
            .upload(storagePath, receiptFile, { upsert: false });

          if (!uploadError) {
            receiptPath = storagePath;
          } else if (receiptDataUrl) {
            // Fallback to receiptDataUrl if Supabase bucket doesn't exist
            receiptPath = receiptDataUrl;
          }
        }

        const response = await fetch("/api/bookings", {
          body: JSON.stringify({
            addonComments: addonComments.trim(),
            amount: bookingAmount,
            ballQty,
            courtId: selectedCourt.id,
            courtName: selectedCourt.name,
            date: selectedDate,
            hours: selectedHours,
            id: bookingId,
            paddleQty,
            paymentMethod,
            paymentReference: reference,
            receiptPath,
            startTime: selectedStart,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const payload = (await response.json()) as {
          booking?: Booking;
          error?: string;
        };

        if (!response.ok) {
          setConfirmationTone("error");
          setConfirmation(payload.error ?? "Booking could not be submitted.");
          return;
        }

        bookingId = payload.booking?.id ?? bookingId;
        savedBooking = payload.booking ?? null;
      } catch {
        setConfirmationTone("error");
        setConfirmation(
          "Could not connect to the booking server. Please try again.",
        );
        return;
      }
    }
    const booking: Booking = {
      amount: grandTotalAmount,
      ballQty: ballQty > 0 ? ballQty : undefined,
      comments: addonComments.trim() || undefined,
      courtId: selectedCourt.id,
      courtName: selectedCourt.name,
      date: selectedDate,
      endTime: selectedEnd,
      hours: selectedHours,
      id: bookingId,
      paddleQty: paddleQty > 0 ? paddleQty : undefined,
      paymentMethod,
      paymentStatus: "Submitted",
      player: currentPlayerName,
      playerUsername: signedInUser?.username
        ? safeNormalizeUsername(signedInUser.username)
        : undefined,
      receiptName: receiptDataUrl || receiptFile?.name || receiptName,
      reference,
      startTime: selectedStart,
      status: "Pending",
    };

    const bookingSummaryText = `${currentPlayerName}'s booking for ${selectedCourt.name} (${selectedDate}, ${formatTimeRange12Hour(selectedStart, selectedEnd)})`;

    if (supabaseReady) {
      try {
        await refreshBookingsFromServer();
      } catch {
        if (savedBooking) {
          setBookings((items) => [savedBooking, ...items]);
        }
      }
    } else {
      setBookings((items) => [booking, ...items]);
    }

    setConfirmationTone("success");
    setConfirmation(
      `Your booking for ${selectedCourt.name} is pending until the manager verifies your ${paymentMethod} receipt.`,
    );
    pushNotification(
      `${bookingSummaryText} was submitted and is waiting for review.`,
      signedInUser?.username,
    );
    handlePlayerTabChange("bookings");
  }

  async function cancelBooking(id: string) {
    const target = bookings.find((b) => b.id === id);
    const label = target
      ? `${target.player}'s booking for ${target.courtName} (${target.date}, ${formatTimeRange12Hour(target.startTime, target.endTime)})`
      : "Booking";

    if (await updateBooking(id, { status: "Cancelled" })) {
      pushNotification(`${label} was cancelled.`, signedInUser?.username);
    }
  }

  async function approveBooking(booking: Booking) {
    const updated = await updateBooking(booking.id, {
      paymentStatus: "Verified",
      status: "Approved",
    });

    if (updated) {
      pushNotification(
        `Booking for ${booking.courtName} (${booking.date}, ${formatTimeRange12Hour(booking.startTime, booking.endTime)}) by ${booking.player} was approved!`,
        booking.playerUsername || booking.player,
      );
    }
  }

  async function rejectBooking(booking: Booking) {
    const rejectionReason = "Payment details need manager follow-up.";
    const updated = await updateBooking(booking.id, {
      paymentStatus: "Rejected",
      rejectionReason,
      status: "Rejected",
    });

    if (updated) {
      pushNotification(
        `Booking for ${booking.courtName} (${booking.date}, ${formatTimeRange12Hour(booking.startTime, booking.endTime)}) by ${booking.player} was rejected.`,
        booking.playerUsername || booking.player,
      );
    }
  }

  function resetOpenPlayPaymentDraft(session?: OpenPlaySession) {
    setOpenPlayPaymentReference("");
    setOpenPlayReceiptFile(null);
    setOpenPlayReceiptName("");
    setOpenPlayReceiptDataUrl("");
    setOpenPlaySkillLevel(
      session ? getDefaultOpenPlaySkillLevel(session) : "Beginner",
    );
  }

  function handleOpenPlayReceiptChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setOpenPlayReceiptFile(file);
    setOpenPlayReceiptName(file?.name ?? "");
    setOpenPlayReceiptDataUrl("");

    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (typeof evt.target?.result === "string") {
          setOpenPlayReceiptDataUrl(evt.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  function handleJoinOpenPlay(session: OpenPlaySession) {
    if (!signedInUser) {
      setOpenPlayStatusTone("error");
      setOpenPlayStatusSessionId(session.id);
      setOpenPlayStatusMessage(
        "Please login or register before joining open play.",
      );
      return;
    }

    setOpenPlayPaymentSessionId(session.id);
    setOpenPlayStatusSessionId(session.id);
    setOpenPlayStatusMessage("");
    resetOpenPlayPaymentDraft(session);
  }

  function openPlayApplicantBelongsToCurrentUser(
    applicant: OpenPlayParticipant,
  ) {
    if (!signedInUser) {
      return false;
    }

    const currentUsername = safeNormalizeUsername(signedInUser.username);

    return (
      (applicant.playerUsername &&
        safeNormalizeUsername(applicant.playerUsername) === currentUsername) ||
      applicant.playerName === signedInUser.fullName ||
      applicant.playerName === "You"
    );
  }

  function tournamentRegistrationBelongsToCurrentUser(
    participant: TournamentParticipantRecord,
  ) {
    if (!signedInUser) {
      return false;
    }

    const currentUsername = safeNormalizeUsername(signedInUser.username);

    return (
      (participant.playerUsername &&
        safeNormalizeUsername(participant.playerUsername) ===
          currentUsername) ||
      participant.playerName === signedInUser.fullName ||
      participant.playerName === "You"
    );
  }

  async function handleOpenPlayApplicationSubmit(
    event: FormEvent<HTMLFormElement>,
    session: OpenPlaySession,
  ) {
    event.preventDefault();

    if (!signedInUser) {
      setOpenPlayStatusTone("error");
      setOpenPlayStatusSessionId(session.id);
      setOpenPlayStatusMessage(
        "Please login or register before joining open play.",
      );
      return;
    }

    if (
      openPlayPaymentReference.trim().length === 0 ||
      openPlayReceiptName.length === 0
    ) {
      setOpenPlayStatusTone("error");
      setOpenPlayStatusSessionId(session.id);
      setOpenPlayStatusMessage("GCash reference and payment proof are required.");
      return;
    }

    setOpenPlaySubmitPending(true);

    let receiptPath = openPlayReceiptDataUrl || openPlayReceiptName;

    if (supabaseReady) {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setOpenPlayStatusTone("error");
          setOpenPlayStatusSessionId(session.id);
          setOpenPlayStatusMessage(
            "Please login again before submitting open-play payment.",
          );
          return;
        }

        if (openPlayReceiptFile) {
          const safeFileName = openPlayReceiptFile.name.replace(
            /[^a-zA-Z0-9._-]/g,
            "-",
          );
          const uploadId =
            globalThis.crypto?.randomUUID?.() ?? createTimestampId("OPR");
          const storagePath = `${user.id}/open-play/${session.id}/${uploadId}-${safeFileName}`;
          const { error: uploadError } = await supabase.storage
            .from("payment-receipts")
            .upload(storagePath, openPlayReceiptFile, { upsert: false });

          if (!uploadError) {
            receiptPath = storagePath;
          } else if (openPlayReceiptDataUrl) {
            receiptPath = openPlayReceiptDataUrl;
          }
        }

        const response = await fetch("/api/open-play/participants", {
          body: JSON.stringify({
            amount: session.fee,
            paymentReference: openPlayPaymentReference,
            receiptPath,
            sessionId: session.id,
            skillLevel: openPlaySkillLevel,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const payload = (await response.json()) as {
          applicant?: OpenPlayParticipant;
          error?: string;
        };

        if (!response.ok || !payload.applicant) {
          const message =
            payload.error ?? "Open-play payment could not be submitted.";
          setOpenPlayStatusTone("error");
          setOpenPlayStatusSessionId(session.id);
          setOpenPlayStatusMessage(message);
          return;
        }

        setOpenPlayApplicants((items) => [
          payload.applicant!,
          ...items.filter((item) => item.id !== payload.applicant!.id),
        ]);
        try {
          await refreshOpenPlayApplicantsFromServer();
        } catch {
          // Keep the submitted applicant visible from the POST response.
        }
      } catch {
        setOpenPlayStatusTone("error");
        setOpenPlayStatusSessionId(session.id);
        setOpenPlayStatusMessage(
          "Could not connect to the open-play payment server. Please try again.",
        );
        return;
      } finally {
        setOpenPlaySubmitPending(false);
      }
    } else {
      const localApplicant: OpenPlayParticipant = {
        amount: session.fee,
        id: createTimestampId("OPA"),
        paymentMethod: "GCash",
        paymentReference: openPlayPaymentReference,
        paymentStatus: "Submitted",
        playerName: signedInUser.fullName,
        playerUsername: signedInUser.username,
        receiptName: receiptPath,
        sessionId: session.id,
        skillLevel: openPlaySkillLevel,
        status: "Pending",
      };

      setOpenPlayApplicants((items) => [localApplicant, ...items]);
      setOpenPlaySubmitPending(false);
    }

    setOpenPlayPaymentSessionId("");
    resetOpenPlayPaymentDraft();
    setOpenPlayStatusTone("success");
    setOpenPlayStatusSessionId(session.id);
    setOpenPlayStatusMessage(
      "Payment proof submitted. Please wait for admin approval.",
    );
    pushNotification(
      `${session.title} payment proof was submitted for admin approval.`,
      signedInUser.username,
    );
  }

  function handleTournamentRegistration(tournament: Tournament) {
    if (!signedInUser) {
      pushNotification(
        "Please login or register before joining a tournament.",
        undefined,
      );
      return;
    }

    const existingRegistration = tournamentRegistrations.find(
      (participant) =>
        participant.tournamentId === tournament.id &&
        tournamentRegistrationBelongsToCurrentUser(participant) &&
        participant.status !== "Rejected",
    );

    if (existingRegistration) {
      setTournamentRegistrations((items) =>
        items.filter((participant) => participant.id !== existingRegistration.id),
      );
      pushNotification(
        `Registration removed for ${tournament.name}.`,
        signedInUser?.username,
      );
      return;
    }

    const activeParticipants = tournamentRegistrations.filter(
      (participant) =>
        participant.tournamentId === tournament.id &&
        participant.status !== "Rejected",
    ).length;

    if (
      Math.max(tournament.participants, activeParticipants) <
      tournament.participantLimit
    ) {
      setTournamentRegistrations((items) => [
        {
          id: createTimestampId(`TP-${tournament.id}`),
          playerName: signedInUser.fullName,
          playerUsername: signedInUser.username,
          status: "Pending",
          tournamentId: tournament.id,
        },
        ...items.filter(
          (participant) =>
            !(
              participant.tournamentId === tournament.id &&
              tournamentRegistrationBelongsToCurrentUser(participant)
            ),
        ),
      ]);
      pushNotification(
        `${tournament.name} registration is pending approval.`,
        signedInUser?.username,
      );
    }
  }

  function handleEventRegistration(eventItem: CourtEvent) {
    if (registeredEvents.includes(eventItem.id)) {
      setRegisteredEvents((items) => items.filter((id) => id !== eventItem.id));
      pushNotification(
        `Registration removed for ${eventItem.name}.`,
        signedInUser?.username,
      );
      return;
    }

    if (eventItem.attendees < eventItem.maxAttendees) {
      setRegisteredEvents((items) => [eventItem.id, ...items]);
      pushNotification(
        `You registered for ${eventItem.name}.`,
        signedInUser?.username,
      );
    }
  }

  async function handleAddCourt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newCourtName.trim().length === 0) {
      return;
    }

    const openTime = newCourtOpen || "06:00";
    let closeTime = newCourtClose || "22:00";
    if (openTime === closeTime) {
      closeTime = "23:59";
    }

    const initialSlots = [
      "06:00",
      "07:00",
      "08:00",
      "10:00",
      "14:00",
      "16:00",
      "18:00",
      "20:00",
    ];
    let createdCourt: Court = {
      close: closeTime,
      enabled: true,
      id: `court-${Date.now()}`,
      image: newCourtImage.trim() || undefined,
      name: newCourtName.trim(),
      nightPricePerHour: newCourtNightPrice,
      nightStartsAt: newCourtNightStartsAt || "17:00",
      open: openTime,
      pricePerHour: newCourtPrice,
      slots: initialSlots,
      surface: newCourtSurface.trim() || "Standard court",
      zone: newCourtZone.trim() || "Main area",
    };

    if (supabaseReady) {
      try {
        const response = await fetch("/api/courts", {
          body: JSON.stringify({
            close: createdCourt.close,
            enabled: createdCourt.enabled,
            image: createdCourt.image,
            name: createdCourt.name,
            nightPricePerHour: createdCourt.nightPricePerHour,
            nightStartsAt: createdCourt.nightStartsAt,
            open: createdCourt.open,
            pricePerHour: createdCourt.pricePerHour,
            slots: createdCourt.slots,
            surface: createdCourt.surface,
            zone: createdCourt.zone,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        const payload = (await response.json()) as {
          court?: Court;
          error?: string;
        };

        if (!response.ok) {
          pushNotification(
            payload.error ?? "Could not create court in database.",
          );
          return;
        }

        if (payload.court) {
          createdCourt = payload.court;
        }
      } catch {
        pushNotification("Failed to save new court to database.");
      }
    }

    setManagedCourts((items) => [...items, createdCourt]);
    pushNotification(`Court "${createdCourt.name}" created successfully.`);
    setNewCourtName("");
    setNewCourtSurface("Cushioned acrylic");
    setNewCourtZone("Main area");
    setNewCourtPrice(400);
    setNewCourtNightPrice(500);
    setNewCourtNightStartsAt("17:00");
    setNewCourtOpen("06:00");
    setNewCourtClose("22:00");
    setNewCourtImage("");
  }

  async function updateCourt(id: string, patch: Partial<Court>) {
    setManagedCourts((items) =>
      items.map((court) => (court.id === id ? { ...court, ...patch } : court)),
    );

    if (supabaseReady) {
      try {
        const response = await fetch("/api/courts", {
          body: JSON.stringify({ id, ...patch }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });

        const payload = (await response.json()) as {
          court?: Court;
          error?: string;
        };

        if (payload.court) {
          const updated = payload.court;
          setManagedCourts((items) =>
            items.map((court) =>
              court.id === id ? { ...court, ...updated } : court,
            ),
          );
        } else if (payload.error) {
          pushNotification(payload.error);
        }
      } catch {
        pushNotification("Could not save court update to database.");
      }
    }
  }

  async function handleSaveEditedCourt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCourt) return;

    const openTime = editingCourt.open || "06:00";
    let closeTime = editingCourt.close || "22:00";
    if (openTime === closeTime) {
      closeTime = "23:59";
    }

    await updateCourt(editingCourt.id, {
      close: closeTime,
      enabled: editingCourt.enabled,
      image: editingCourt.image,
      name: editingCourt.name,
      nightPricePerHour: editingCourt.nightPricePerHour,
      nightStartsAt: editingCourt.nightStartsAt,
      open: openTime,
      pricePerHour: editingCourt.pricePerHour,
      surface: editingCourt.surface,
      zone: editingCourt.zone,
    });

    pushNotification(`Updated court "${editingCourt.name}".`);
    setEditingCourt(null);
  }

  async function handleDeleteCourt(id: string) {
    const target = managedCourts.find((c) => c.id === id);
    const name = target?.name ?? "Court";

    setManagedCourts((items) => items.filter((c) => c.id !== id));
    if (selectedCourtId === id) {
      const remaining = managedCourts.filter((c) => c.id !== id);
      setSelectedCourtId(remaining[0]?.id ?? "");
    }
    if (editingCourt?.id === id) {
      setEditingCourt(null);
    }

    if (supabaseReady) {
      try {
        await fetch(`/api/courts?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
      } catch {
        // Fallback
      }
    }

    pushNotification(`Court "${name}" deleted.`);
  }

  async function handleAddSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const court = managedCourts.find((item) => item.id === slotCourtId);
    if (!court || court.slots.includes(newSlot)) {
      return;
    }

    const nextSlots = [...court.slots, newSlot].sort();
    await updateCourt(court.id, { slots: nextSlots });
    pushNotification(`Added slot ${newSlot} to ${court.name}.`);
  }

  function handleBlockSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const court = managedCourts.find((item) => item.id === slotCourtId);
    if (!court) {
      return;
    }

    setBlockedSlots((items) => [
      {
        courtId: court.id,
        courtName: court.name,
        date: blockDate,
        endTime: addHours(blockStart, blockHours),
        id: `BLK-${items.length + 1}`,
        reason: blockReason,
        startTime: blockStart,
      },
      ...items,
    ]);
  }

  function toggleNewSessionCourt(courtId: string) {
    setNewSessionCourtIds((ids) => {
      if (ids.includes(courtId)) {
        return ids.length === 1 ? ids : ids.filter((id) => id !== courtId);
      }

      return [...ids, courtId];
    });
  }

  function toggleNewSessionSkillLevel(skillLevel: SkillLevel) {
    setNewSessionSkillLevels((levels) => {
      if (skillLevel === "All Levels") {
        return ["All Levels"];
      }

      const levelsWithoutAll = levels.filter((level) => level !== "All Levels");

      if (levelsWithoutAll.includes(skillLevel)) {
        const nextLevels = levelsWithoutAll.filter(
          (level) => level !== skillLevel,
        );

        return nextLevels.length > 0 ? nextLevels : ["All Levels"];
      }

      return [...levelsWithoutAll, skillLevel];
    });
  }

  function toggleNewSessionFormat(format: OpenPlayFormat) {
    setNewSessionFormats((formats) => {
      if (formats.includes(format)) {
        return formats.length === 1
          ? formats
          : formats.filter((item) => item !== format);
      }

      return [...formats, format];
    });
  }

  async function handleCreateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedCourts = managedCourts.filter((item) =>
      newSessionCourtIds.includes(item.id),
    );
    const primaryCourt = selectedCourts[0];

    if (!primaryCourt || newSessionTitle.trim().length === 0) {
      return;
    }

    if (supabaseReady) {
      try {
        const response = await fetch("/api/open-play/sessions", {
          body: JSON.stringify({
            courtIds: selectedCourts.map((court) => court.id),
            date: newSessionDate,
            fee: newSessionFee,
            formats: newSessionFormats,
            hours: newSessionHours,
            maxPlayers: newSessionMaxPlayers,
            skillLevels: newSessionSkillLevels,
            startTime: newSessionStart,
            title: newSessionTitle,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const payload = (await response.json()) as {
          error?: string;
          session?: OpenPlaySession;
        };

        if (!response.ok || !payload.session) {
          const message =
            payload.error ?? "Open-play session could not be created.";
          setBookingDataMessage(message);
          pushNotification(message, signedInUser?.username);
          return;
        }

        setManagedSessions((items) => [payload.session!, ...items]);
        setSelectedOpenPlaySessionId(payload.session.id);
        setBookingDataMessage("");
        pushNotification(
          `${payload.session.title} open-play session was created.`,
        );
        setNewSessionTitle("");
      } catch {
        const message =
          "Could not connect to the open-play session server. Please try again.";
        setBookingDataMessage(message);
        pushNotification(message, signedInUser?.username);
      }

      return;
    }

    const session: OpenPlaySession = {
      courtId: primaryCourt.id,
      courtIds: selectedCourts.map((court) => court.id),
      courtName: selectedCourts.map((court) => court.name).join(", "),
      courtNames: selectedCourts.map((court) => court.name),
      date: newSessionDate,
      endTime: addHours(newSessionStart, newSessionHours),
      fee: newSessionFee,
      id: createTimestampId("OP"),
      joinedPlayers: 0,
      maxPlayers: newSessionMaxPlayers,
      formats: newSessionFormats,
      skillLevel: newSessionSkillLevels[0] ?? "All Levels",
      skillLevels: newSessionSkillLevels,
      startTime: newSessionStart,
      status: "Scheduled",
      title: newSessionTitle,
    };

    setManagedSessions((items) => [session, ...items]);
    setSelectedOpenPlaySessionId(session.id);
    pushNotification(`${session.title} open-play session was created.`);
    setNewSessionTitle("");
  }

  async function handleDeleteOpenPlaySession(session: OpenPlaySession) {
    if (supabaseReady) {
      try {
        const response = await fetch(
          `/api/open-play/sessions?id=${encodeURIComponent(session.id)}`,
          {
            method: "DELETE",
          },
        );
        const payload = (await response.json()) as {
          error?: string;
        };

        if (!response.ok) {
          const message =
            payload.error ?? "Open-play session could not be deleted.";
          setBookingDataMessage(message);
          pushNotification(message, signedInUser?.username);
          return;
        }
      } catch {
        const message =
          "Could not connect to the open-play session server. Please try again.";
        setBookingDataMessage(message);
        pushNotification(message, signedInUser?.username);
        return;
      }
    }

    const nextSession = managedSessions.find(
      (item) => item.id !== session.id,
    );
    setManagedSessions((items) =>
      items.filter((item) => item.id !== session.id),
    );
    if (selectedOpenPlaySessionId === session.id) {
      setSelectedOpenPlaySessionId(nextSession?.id ?? "");
    }
    setBookingDataMessage("");
    pushNotification(`${session.title} open-play session was deleted.`);
  }

  function actionFromOpenPlayApplicantPatch(
    patch: Partial<OpenPlayParticipant>,
  ): OpenPlayApplicantAction | null {
    if (patch.status === "Approved" || patch.paymentStatus === "Verified") {
      return "approve";
    }
    if (patch.status === "Rejected" || patch.paymentStatus === "Rejected") {
      return "reject";
    }

    return null;
  }

  async function updateOpenPlayApplicant(
    id: string,
    patch: Partial<OpenPlayParticipant>,
  ) {
    if (supabaseReady) {
      const action = actionFromOpenPlayApplicantPatch(patch);

      if (!action) {
        return false;
      }

      try {
        const response = await fetch("/api/open-play/participants", {
          body: JSON.stringify({
            action,
            id,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        });
        const payload = (await response.json()) as {
          applicant?: OpenPlayParticipant;
          error?: string;
        };

        if (!response.ok || !payload.applicant) {
          const message =
            payload.error ?? "Open-play applicant could not be updated.";
          setBookingDataMessage(message);
          pushNotification(message, signedInUser?.username);
          return false;
        }

        setOpenPlayApplicants((items) =>
          items.map((applicant) =>
            applicant.id === id ? payload.applicant! : applicant,
          ),
        );
        await refreshOpenPlaySessionsFromServer();
        setBookingDataMessage("");
        return true;
      } catch {
        const message =
          "Could not connect to the open-play applicant server. Please try again.";
        setBookingDataMessage(message);
        pushNotification(message, signedInUser?.username);
        return false;
      }
    }

    setOpenPlayApplicants((items) =>
      items.map((applicant) =>
        applicant.id === id ? { ...applicant, ...patch } : applicant,
      ),
    );

    return true;
  }

  async function verifyOpenPlayPayment(applicant: OpenPlayParticipant) {
    const updated = await updateOpenPlayApplicant(applicant.id, {
      paymentStatus: "Verified",
      status: "Approved",
    });

    if (updated) {
      pushNotification(
        `${applicant.playerName}'s open-play payment was verified.`,
        applicant.playerUsername || applicant.playerName,
      );
    }
  }

  async function rejectOpenPlayPayment(applicant: OpenPlayParticipant) {
    const updated = await updateOpenPlayApplicant(applicant.id, {
      paymentStatus: "Rejected",
      status: "Rejected",
    });

    if (updated) {
      pushNotification(
        `${applicant.playerName}'s open-play payment was rejected.`,
        applicant.playerUsername || applicant.playerName,
      );
    }
  }

  async function removeOpenPlayApplicant(applicant: OpenPlayParticipant) {
    if (supabaseReady) {
      try {
        const response = await fetch(
          `/api/open-play/participants?id=${encodeURIComponent(applicant.id)}`,
          {
            method: "DELETE",
          },
        );
        const payload = (await response.json()) as {
          error?: string;
        };

        if (!response.ok) {
          const message =
            payload.error ?? "Open-play applicant could not be removed.";
          setBookingDataMessage(message);
          pushNotification(message, signedInUser?.username);
          return;
        }

        await refreshOpenPlaySessionsFromServer();
      } catch {
        const message =
          "Could not connect to the open-play applicant server. Please try again.";
        setBookingDataMessage(message);
        pushNotification(message, signedInUser?.username);
        return;
      }
    }

    setOpenPlayApplicants((items) =>
      items.filter((item) => item.id !== applicant.id),
    );
    setBookingDataMessage("");
    pushNotification(
      `${applicant.playerName} was removed from open play.`,
      applicant.playerUsername || applicant.playerName,
    );
  }

  function handleCreateManualOpenPlayPairing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedPlayers = [
      manualOpenPlayTeamOneFirst,
      manualOpenPlayTeamOneSecond,
      manualOpenPlayTeamTwoFirst,
      manualOpenPlayTeamTwoSecond,
    ];

    if (
      !selectedOpenPlaySession ||
      selectedPlayers.some((player) => !player) ||
      new Set(selectedPlayers).size !== selectedPlayers.length
    ) {
      return;
    }

    const firstApplicant = selectedApprovedOpenPlayApplicants.find(
      (applicant) => applicant.playerName === manualOpenPlayTeamOneFirst,
    );
    const teamOnePlayers = [
      manualOpenPlayTeamOneFirst,
      manualOpenPlayTeamOneSecond,
    ];
    const teamTwoPlayers = [
      manualOpenPlayTeamTwoFirst,
      manualOpenPlayTeamTwoSecond,
    ];

    setOpenPlayMatchups((items) => [
      {
        id: createTimestampId(`OPM-${selectedOpenPlaySession.id}-manual`),
        playerOne: teamLabel(teamOnePlayers),
        playerTwo: teamLabel(teamTwoPlayers),
        round: "Elimination",
        score: "",
        sessionId: selectedOpenPlaySession.id,
        skillLevel: firstApplicant?.skillLevel ?? "Intermediate",
        teamOnePlayers,
        teamTwoPlayers,
      },
      ...items,
    ]);
    setManualOpenPlayTeamOneFirst("");
    setManualOpenPlayTeamOneSecond("");
    setManualOpenPlayTeamTwoFirst("");
    setManualOpenPlayTeamTwoSecond("");
    pushNotification("Manual open-play doubles match was added.");
  }

  function randomizeOpenPlayMatchmaking(sessionId: string) {
    const eligiblePlayers = openPlayApplicants.filter(
      (applicant) =>
        applicant.sessionId === sessionId &&
        applicant.status === "Approved" &&
        applicant.paymentStatus === "Verified",
    );
    const skillGroups: MatchSkillLevel[] = [
      "Beginner",
      "Novice",
      "Intermediate",
      "Advanced",
    ];
    const generatedMatches: OpenPlayMatch[] = skillGroups.flatMap(
      (skillLevel) => {
        const playerNames = shufflePlayers(
          eligiblePlayers.filter((player) => player.skillLevel === skillLevel),
        ).map((player) => player.playerName);
        const teams = shuffleNames(
          doublesTeams(playerNames).map((team) => teamLabel(team)),
        ).map(playersFromTeamLabel);

        if (teams.length < 2) {
          return [];
        }

        return pairNames(teams).map(([teamOne, teamTwo], index) => ({
          id: createTimestampId(`OPM-${sessionId}-${skillLevel}-${index}`),
          playerOne: teamLabel(teamOne),
          playerTwo: teamTwo ? teamLabel(teamTwo) : "Bye",
          round: "Elimination",
          score: "",
          sessionId,
          skillLevel,
          teamOnePlayers: teamOne,
          teamTwoPlayers: teamTwo ?? [],
          winner: teamTwo ? undefined : teamLabel(teamOne),
        }));
      },
    );

    setOpenPlayMatchups((items) => [
      ...items.filter(
        (match) =>
          !(match.sessionId === sessionId && match.round === "Elimination"),
      ),
      ...generatedMatches,
    ]);
    pushNotification(
      generatedMatches.length > 0
        ? "Open-play doubles teams and team matchups were randomized by skill level."
        : "At least four verified players in a skill group are needed for doubles matchmaking.",
    );
  }

  function updateOpenPlayMatch(id: string, patch: Partial<OpenPlayMatch>) {
    setOpenPlayMatchups((items) =>
      items.map((match) => (match.id === id ? { ...match, ...patch } : match)),
    );
  }

  function buildOpenPlayBracket(sessionId: string) {
    const sessionMatches = openPlayMatchups.filter(
      (match) => match.sessionId === sessionId,
    );
    const eliminationMatches = sessionMatches.filter(
      (match) => match.round === "Elimination",
    );
    const semifinalMatches = sessionMatches.filter(
      (match) => match.round === "Semifinals",
    );
    const finalMatch = sessionMatches.find((match) => match.round === "Finals");

    if (finalMatch?.winner) {
      pushNotification(`${finalMatch.winner} is the open-play champion.`);
      return;
    }

    if (semifinalMatches.length > 0) {
      const missingWinner = semifinalMatches.some(matchNeedsWinner);

      if (missingWinner) {
        pushNotification(
          "Select every semifinal winner before building the final.",
        );
        return;
      }

      const semifinalWinners = semifinalMatches
        .map((match) => match.winner)
        .filter((winner): winner is string => Boolean(winner));

      if (semifinalWinners.length < 2) {
        pushNotification("At least two semifinal winners are needed.");
        return;
      }

      setOpenPlayMatchups((items) => [
        ...items.filter(
          (match) =>
            !(match.sessionId === sessionId && match.round === "Finals"),
        ),
        {
          id: createTimestampId(`OPF-${sessionId}`),
          playerOne: semifinalWinners[0],
          playerTwo: semifinalWinners[1],
          round: "Finals",
          score: "",
          sessionId,
          skillLevel: "Intermediate",
          teamOnePlayers: playersFromTeamLabel(semifinalWinners[0]),
          teamTwoPlayers: playersFromTeamLabel(semifinalWinners[1]),
        },
      ]);
      pushNotification("Open-play finals match is ready.");
      return;
    }

    if (eliminationMatches.length > 0 && eliminationMatches.some(matchNeedsWinner)) {
      pushNotification(
        "Select every elimination winner before building the next round.",
      );
      return;
    }

    const eliminationWinners = eliminationMatches
      .map((match) => match.winner)
      .filter((winner): winner is string => Boolean(winner));
    const fallbackPlayers = openPlayApplicants
      .filter(
        (applicant) =>
          applicant.sessionId === sessionId &&
          applicant.status === "Approved" &&
          applicant.paymentStatus === "Verified",
      )
      .map((applicant) => applicant.playerName);
    const fallbackTeams = doublesTeams(shuffleNames(fallbackPlayers)).map(
      (team) => teamLabel(team),
    );
    const bracketEntries =
      eliminationWinners.length >= 2 ? eliminationWinners : fallbackTeams;

    if (bracketEntries.length < 2) {
      pushNotification(
        "At least two verified doubles teams are needed to build a bracket.",
      );
      return;
    }

    const nextRound: CompetitionRound =
      bracketEntries.length > 2 ? "Semifinals" : "Finals";
    const nextMatches: OpenPlayMatch[] = pairNames(
      bracketEntries.slice(0, 4),
    ).map(
      ([playerOne, playerTwo], index) => ({
        id: createTimestampId(`OP-${sessionId}-${nextRound}-${index}`),
        playerOne,
        playerTwo: playerTwo ?? "Bye",
        round: nextRound,
        score: "",
        sessionId,
        skillLevel: "Intermediate",
        teamOnePlayers: playersFromTeamLabel(playerOne),
        teamTwoPlayers: playerTwo ? playersFromTeamLabel(playerTwo) : [],
        winner: playerTwo ? undefined : playerOne,
      }),
    );

    setOpenPlayMatchups((items) => [
      ...items.filter(
        (match) =>
          !(
            match.sessionId === sessionId &&
            (nextRound === "Semifinals"
              ? ["Semifinals", "Finals"].includes(match.round)
              : match.round === "Finals")
          ),
      ),
      ...nextMatches,
    ]);
    pushNotification(`Open-play ${nextRound.toLowerCase()} bracket is ready.`);
  }

  function handleCreateTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newTournamentName.trim().length === 0) {
      return;
    }

    const tournamentId = createTimestampId("T");

    setManagedTournaments((items) => [
      {
        category: "Doubles",
        date: "2026-09-20",
        deadline: "2026-09-13",
        division: "Intermediate",
        fee: 700,
        id: tournamentId,
        matches: [],
        name: newTournamentName,
        participantLimit: 24,
        participants: 0,
        status: "Draft",
      },
      ...items,
    ]);
    setSelectedTournamentId(tournamentId);
    setNewTournamentName("");
  }

  function updateTournamentStatus(
    tournamentId: string,
    status: Tournament["status"],
  ) {
    setManagedTournaments((items) =>
      items.map((tournament) =>
        tournament.id === tournamentId ? { ...tournament, status } : tournament,
      ),
    );
  }

  function updateTournamentParticipant(
    id: string,
    patch: Partial<TournamentParticipantRecord>,
  ) {
    setTournamentRegistrations((items) =>
      items.map((participant) =>
        participant.id === id ? { ...participant, ...patch } : participant,
      ),
    );
  }

  function removeTournamentParticipant(participant: TournamentParticipantRecord) {
    setTournamentRegistrations((items) =>
      items.filter((item) => item.id !== participant.id),
    );
    pushNotification(`${participant.playerName} was removed from tournament.`);
  }

  function handleCreateManualTournamentPairing(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const selectedPlayers = [
      manualTournamentTeamOneFirst,
      manualTournamentTeamOneSecond,
      manualTournamentTeamTwoFirst,
      manualTournamentTeamTwoSecond,
    ];

    if (
      !selectedTournament ||
      selectedPlayers.some((player) => !player) ||
      new Set(selectedPlayers).size !== selectedPlayers.length
    ) {
      return;
    }

    const teamOnePlayers = [
      manualTournamentTeamOneFirst,
      manualTournamentTeamOneSecond,
    ];
    const teamTwoPlayers = [
      manualTournamentTeamTwoFirst,
      manualTournamentTeamTwoSecond,
    ];

    setTournamentMatchups((items) => [
      {
        id: createTimestampId(`TM-${selectedTournament.id}-manual`),
        playerOne: teamLabel(teamOnePlayers),
        playerTwo: teamLabel(teamTwoPlayers),
        round: "Elimination",
        score: "",
        teamOnePlayers,
        teamTwoPlayers,
        tournamentId: selectedTournament.id,
      },
      ...items,
    ]);
    setManualTournamentTeamOneFirst("");
    setManualTournamentTeamOneSecond("");
    setManualTournamentTeamTwoFirst("");
    setManualTournamentTeamTwoSecond("");
    updateTournamentStatus(selectedTournament.id, "In Progress");
    pushNotification("Manual tournament doubles match was added.");
  }

  function randomizeTournamentPairings(tournamentId: string) {
    const players = shuffleNames(
      tournamentRegistrations
        .filter(
          (participant) =>
            participant.tournamentId === tournamentId &&
            participant.status === "Approved",
        )
        .map((participant) => participant.playerName),
    );

    if (players.length < 4) {
      pushNotification(
        "At least four approved tournament players are needed for doubles pairing.",
      );
      return;
    }

    const teams = shuffleNames(
      doublesTeams(players).map((team) => teamLabel(team)),
    ).map(playersFromTeamLabel);
    const generatedMatches: TournamentMatch[] = pairNames(teams).map(
      ([teamOne, teamTwo], index) => ({
        id: createTimestampId(`TM-${tournamentId}-Elimination-${index}`),
        playerOne: teamLabel(teamOne),
        playerTwo: teamTwo ? teamLabel(teamTwo) : "Bye",
        round: "Elimination",
        score: "",
        teamOnePlayers: teamOne,
        teamTwoPlayers: teamTwo ?? [],
        tournamentId,
        winner: teamTwo ? undefined : teamLabel(teamOne),
      }),
    );

    setTournamentMatchups((items) => [
      ...items.filter(
        (match) =>
          !(match.tournamentId === tournamentId && match.round === "Elimination"),
      ),
      ...generatedMatches,
    ]);
    updateTournamentStatus(tournamentId, "In Progress");
    pushNotification("Tournament doubles teams and matchups were randomized.");
  }

  function updateTournamentMatch(id: string, patch: Partial<TournamentMatch>) {
    let champion = "";

    setTournamentMatchups((items) =>
      items.map((match) => {
        if (match.id !== id) {
          return match;
        }

        const nextMatch = { ...match, ...patch };

        if (nextMatch.round === "Finals" && nextMatch.winner) {
          champion = nextMatch.winner;
        }

        return nextMatch;
      }),
    );

    if (champion) {
      const tournament = managedTournaments.find((item) =>
        tournamentMatchups.some(
          (match) => match.id === id && match.tournamentId === item.id,
        ),
      );

      if (tournament) {
        updateTournamentStatus(tournament.id, "Completed");
      }

      pushNotification(`${champion} is the tournament champion.`);
    }
  }

  function buildTournamentBracket(tournamentId: string) {
    const matches = tournamentMatchups.filter(
      (match) => match.tournamentId === tournamentId,
    );
    const eliminationMatches = matches.filter(
      (match) => match.round === "Elimination",
    );
    const semifinalMatches = matches.filter(
      (match) => match.round === "Semifinals",
    );
    const finalMatch = matches.find((match) => match.round === "Finals");

    if (finalMatch?.winner) {
      updateTournamentStatus(tournamentId, "Completed");
      pushNotification(`${finalMatch.winner} is the tournament champion.`);
      return;
    }

    if (semifinalMatches.length > 0) {
      if (semifinalMatches.some(matchNeedsWinner)) {
        pushNotification(
          "Select every semifinal winner before building the final.",
        );
        return;
      }

      const semifinalWinners = semifinalMatches
        .map((match) => match.winner)
        .filter((winner): winner is string => Boolean(winner));

      if (semifinalWinners.length < 2) {
        pushNotification("At least two semifinal winners are needed.");
        return;
      }

      setTournamentMatchups((items) => [
        ...items.filter(
          (match) =>
            !(match.tournamentId === tournamentId && match.round === "Finals"),
        ),
        {
          id: createTimestampId(`TF-${tournamentId}`),
          playerOne: semifinalWinners[0],
          playerTwo: semifinalWinners[1],
          round: "Finals",
          score: "",
          teamOnePlayers: playersFromTeamLabel(semifinalWinners[0]),
          teamTwoPlayers: playersFromTeamLabel(semifinalWinners[1]),
          tournamentId,
        },
      ]);
      pushNotification("Tournament finals match is ready.");
      return;
    }

    if (eliminationMatches.length > 0 && eliminationMatches.some(matchNeedsWinner)) {
      pushNotification(
        "Select every elimination winner before building the next round.",
      );
      return;
    }

    const eliminationWinners = eliminationMatches
      .map((match) => match.winner)
      .filter((winner): winner is string => Boolean(winner));
    const fallbackPlayers = tournamentRegistrations
      .filter(
        (participant) =>
          participant.tournamentId === tournamentId &&
          participant.status === "Approved",
      )
      .map((participant) => participant.playerName);
    const fallbackTeams = doublesTeams(shuffleNames(fallbackPlayers)).map(
      (team) => teamLabel(team),
    );
    const bracketEntries =
      eliminationWinners.length >= 2 ? eliminationWinners : fallbackTeams;

    if (bracketEntries.length < 2) {
      pushNotification(
        "At least two approved doubles teams are needed to build a bracket.",
      );
      return;
    }

    const nextRound: CompetitionRound =
      bracketEntries.length > 2 ? "Semifinals" : "Finals";
    const nextMatches: TournamentMatch[] = pairNames(
      bracketEntries.slice(0, 4),
    ).map(
      ([playerOne, playerTwo], index) => ({
        id: createTimestampId(`T-${tournamentId}-${nextRound}-${index}`),
        playerOne,
        playerTwo: playerTwo ?? "Bye",
        round: nextRound,
        score: "",
        teamOnePlayers: playersFromTeamLabel(playerOne),
        teamTwoPlayers: playerTwo ? playersFromTeamLabel(playerTwo) : [],
        tournamentId,
        winner: playerTwo ? undefined : playerOne,
      }),
    );

    setTournamentMatchups((items) => [
      ...items.filter(
        (match) =>
          !(
            match.tournamentId === tournamentId &&
            (nextRound === "Semifinals"
              ? ["Semifinals", "Finals"].includes(match.round)
              : match.round === "Finals")
          ),
      ),
      ...nextMatches,
    ]);
    updateTournamentStatus(tournamentId, "In Progress");
    pushNotification(`Tournament ${nextRound.toLowerCase()} bracket is ready.`);
  }

  function handleCreateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newEventName.trim().length === 0) {
      return;
    }

    setManagedEvents((items) => [
      {
        attendees: 0,
        dateTime: "2026-09-02 18:00",
        deadline: "2026-08-30",
        description:
          "Manager-created activity with manual registration approval.",
        fee: 250,
        id: `EV-${items.length + 33}`,
        image: "/images/event-clinic.svg",
        location: "Clubhouse court",
        maxAttendees: 20,
        name: newEventName,
        status: "Open",
      },
      ...items,
    ]);
    setNewEventName("");
  }

  function handleAnnouncementSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newAnnouncement.trim().length === 0) {
      return;
    }

    setAnnouncementList((items) => [newAnnouncement, ...items]);
    setNewAnnouncement("");
  }

  function scrollToAuth(mode: AuthMode) {
    setAuthMode(mode);
    setAuthMessage("");
    window.setTimeout(() => {
      document
        .getElementById("auth-gateway")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  if (!signedInUser) {
    return (
      <div className="min-h-screen bg-[#f5f7ef] text-stone-950">
        <LandingHero
          onLogin={() => scrollToAuth("login")}
          onRegister={() => scrollToAuth("register")}
        />

        <section
          id="auth-gateway"
          className="border-t border-stone-200 bg-[#f5f7ef] px-4 py-12 sm:px-6 lg:px-8"
        >
          <div className="mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
            <div className="space-y-5">
              <Badge className="border-lime-700/20 bg-lime-100 text-lime-900">
                Member Gateway
              </Badge>
              <div>
                <h2 className="text-3xl font-black text-stone-950 sm:text-4xl">
                  Login or register to continue.
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-stone-700">
                  The booking dashboard, open-play applications, payment proof
                  uploads, and manager tools are available after account access.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {[
                  ["1", "Login or create your username account."],
                  ["2", "Book a court or join open play after access."],
                  ["3", "Managers approve payments and lock schedules."],
                ].map(([step, text]) => (
                  <div
                    className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                    key={step}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-black text-sm font-bold text-lime-200">
                      {step}
                    </span>
                    <p className="text-sm font-medium leading-6 text-stone-700">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <AuthPanel
              authMode={authMode}
              fullName={authFullName}
              message={authMessage}
              password={authPassword}
              phone={authPhone}
              signedInUser={signedInUser}
              supabaseReady={supabaseReady}
              username={authUsername}
              onAuthModeChange={(mode) => {
                setAuthMode(mode);
                setAuthMessage("");
              }}
              onFullNameChange={setAuthFullName}
              onLogout={handleLogout}
              onPasswordChange={setAuthPassword}
              onPhoneChange={setAuthPhone}
              onUsernameChange={setAuthUsername}
              onSubmit={handleAuthSubmit}
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7ef] text-stone-950">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/kvenz.jpg"
                alt="KVENS PLACE DINK & DINE logo"
                width={64}
                height={64}
                className="h-14 w-14 rounded-md border border-lime-300 object-cover shadow-sm"
              />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-700">
                  Pickleball
                </p>
                <h1 className="text-2xl font-bold text-stone-950">
                  KVENS PLACE DINK &amp; DINE
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Top Navbar Icons (Payment, Notifications, Announcements) */}
              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  title="Payment Details"
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 shadow-sm transition-colors hover:bg-stone-50 hover:text-stone-950",
                    activeHeaderPopover === "payment" &&
                      "border-lime-500 bg-lime-50 text-lime-900 ring-2 ring-lime-200",
                  )}
                  onClick={() =>
                    setActiveHeaderPopover(
                      activeHeaderPopover === "payment" ? null : "payment",
                    )
                  }
                >
                  <CreditCard
                    className="h-5 w-5 text-lime-700"
                    aria-hidden="true"
                  />
                </button>

                <button
                  type="button"
                  title="Notifications"
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 shadow-sm transition-colors hover:bg-stone-50 hover:text-stone-950",
                    activeHeaderPopover === "notifications" &&
                      "border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-200",
                  )}
                  onClick={() =>
                    setActiveHeaderPopover(
                      activeHeaderPopover === "notifications"
                        ? null
                        : "notifications",
                    )
                  }
                >
                  <Bell className="h-5 w-5 text-amber-600" aria-hidden="true" />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-sm">
                      {unreadNotificationCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  title="Announcements"
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 shadow-sm transition-colors hover:bg-stone-50 hover:text-stone-950",
                    activeHeaderPopover === "announcements" &&
                      "border-sky-500 bg-sky-50 text-sky-900 ring-2 ring-sky-200",
                  )}
                  onClick={() =>
                    setActiveHeaderPopover(
                      activeHeaderPopover === "announcements"
                        ? null
                        : "announcements",
                    )
                  }
                >
                  <Megaphone
                    className="h-5 w-5 text-sky-700"
                    aria-hidden="true"
                  />
                  {announcementList.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-sky-600 text-[10px] font-bold text-white shadow-sm">
                      {announcementList.length}
                    </span>
                  )}
                </button>

                {/* Popover Dropdown Card */}
                {activeHeaderPopover && (
                  <>
                    <div
                      className="fixed inset-0 z-40 bg-transparent"
                      onClick={() => setActiveHeaderPopover(null)}
                    />

                    <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-xl border border-stone-200 bg-white p-4 shadow-xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-3">
                        <h3 className="font-semibold text-stone-950 flex items-center gap-2">
                          {activeHeaderPopover === "payment" && (
                            <>
                              <CreditCard className="h-4 w-4 text-lime-700" />
                              Payment Details
                            </>
                          )}
                          {activeHeaderPopover === "notifications" && (
                            <>
                              <Bell className="h-4 w-4 text-amber-600" />
                              Notifications
                              {unreadNotificationCount > 0 && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                  {unreadNotificationCount} new
                                </span>
                              )}
                            </>
                          )}
                          {activeHeaderPopover === "announcements" && (
                            <>
                              <Megaphone className="h-4 w-4 text-sky-700" />
                              Announcements
                            </>
                          )}
                        </h3>
                        <div className="flex items-center gap-2">
                          {activeHeaderPopover === "notifications" &&
                            unreadNotificationCount > 0 && (
                              <button
                                type="button"
                                className="text-[11px] font-medium text-amber-600 hover:text-amber-800 hover:underline"
                                onClick={() =>
                                  void markAllNotificationsAsRead()
                                }
                              >
                                Mark all read
                              </button>
                            )}
                          <button
                            type="button"
                            className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                            onClick={() => setActiveHeaderPopover(null)}
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {activeHeaderPopover === "payment" && (
                        <div className="space-y-3">
                          <p className="text-xs text-stone-500">
                            Manual verification after receipt upload.
                          </p>
                          <div className="grid grid-cols-[96px_1fr] gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                            <Image
                              src={paymentInfo.qrCode}
                              alt="Payment QR code"
                              width={96}
                              height={96}
                              className="rounded-md border border-stone-200 bg-white object-cover"
                            />
                            <div className="space-y-1 text-xs text-stone-700">
                              <p>
                                <span className="font-semibold text-stone-950">
                                  GCash:
                                </span>{" "}
                                {paymentInfo.gcashNumber}
                              </p>
                              <p>
                                <span className="font-semibold text-stone-950">
                                  Bank:
                                </span>{" "}
                                {paymentInfo.bankName}
                              </p>
                              <p>
                                <span className="font-semibold text-stone-950">
                                  Acct:
                                </span>{" "}
                                {paymentInfo.bankAccountNumber}
                              </p>
                              <p className="font-medium text-stone-800">
                                {paymentInfo.bankAccountName}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeHeaderPopover === "notifications" && (
                        <div className="max-h-72 overflow-y-auto space-y-2">
                          {userNotifications.length === 0 ? (
                            <p className="p-3 text-center text-xs text-stone-500">
                              No personal notifications for @
                              {signedInUser?.username}.
                            </p>
                          ) : (
                            userNotifications.map((notification) => (
                              <button
                                key={notification.id}
                                type="button"
                                className={cn(
                                  "w-full text-left flex items-start justify-between gap-2 rounded-lg border p-2.5 text-xs transition-colors",
                                  notification.readAt
                                    ? "border-stone-100 bg-stone-50 text-stone-600"
                                    : "border-amber-200 bg-amber-50/60 text-stone-900 shadow-xs hover:bg-amber-50",
                                )}
                                onClick={() => {
                                  if (!notification.readAt) {
                                    void markNotificationAsRead(
                                      notification.id,
                                    );
                                  }
                                }}
                              >
                                <div className="space-y-0.5">
                                  {!notification.readAt && (
                                    <div className="flex items-center gap-1.5 font-medium text-amber-900">
                                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                                      {notification.title || "Notification"}
                                    </div>
                                  )}
                                  <p
                                    className={cn(
                                      !notification.readAt &&
                                        "font-medium text-stone-900",
                                    )}
                                  >
                                    {notification.message}
                                  </p>
                                </div>
                                <span className="shrink-0 text-[10px] text-stone-400">
                                  {notification.createdAt}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      {activeHeaderPopover === "announcements" && (
                        <div className="max-h-72 overflow-y-auto space-y-2">
                          {announcementList.length === 0 ? (
                            <p className="p-3 text-center text-xs text-stone-500">
                              No announcements at this time.
                            </p>
                          ) : (
                            announcementList.map((announcement, index) => (
                              <div
                                key={index}
                                className="rounded-lg border-l-4 border-lime-500 bg-stone-50 p-2.5 text-xs text-stone-700"
                              >
                                {announcement}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* User Profile Card */}
              <div className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-black text-lime-200">
                  {signedInUser.role === "admin" ? (
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <UserRound className="h-5 w-5" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-stone-950">
                      {signedInUser.fullName}
                    </p>
                    <Badge
                      variant={
                        signedInUser.role === "admin" ? "default" : "info"
                      }
                    >
                      {signedInUser.role === "admin" ? "Manager" : "Player"}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-stone-600">
                    @{signedInUser.username}
                  </p>
                </div>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Logout
                </Button>
              </div>
            </div>
          </div>

          {role === "player" ? (
            <nav className="flex gap-2 overflow-x-auto pb-1">
              <NavButton
                active={playerTab === "book"}
                onClick={() => handlePlayerTabChange("book")}
              >
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
                Book
              </NavButton>
              <NavButton
                active={playerTab === "bookings"}
                onClick={() => handlePlayerTabChange("bookings")}
              >
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
                My Bookings
              </NavButton>
              <NavButton
                active={playerTab === "open-play"}
                onClick={() => handlePlayerTabChange("open-play")}
              >
                <Users className="h-4 w-4" aria-hidden="true" />
                Open Play
              </NavButton>
              <NavButton
                active={playerTab === "tournaments"}
                onClick={() => handlePlayerTabChange("tournaments")}
              >
                <Trophy className="h-4 w-4" aria-hidden="true" />
                Tournaments
              </NavButton>
              <NavButton
                active={playerTab === "events"}
                onClick={() => handlePlayerTabChange("events")}
              >
                <Megaphone className="h-4 w-4" aria-hidden="true" />
                Events
              </NavButton>
            </nav>
          ) : (
            <nav className="flex gap-2 overflow-x-auto pb-1">
              <NavButton
                active={adminTab === "dashboard"}
                onClick={() => setAdminTab("dashboard")}
              >
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                Today
              </NavButton>
              <NavButton
                active={adminTab === "requests"}
                onClick={() => setAdminTab("requests")}
              >
                <FileImage className="h-4 w-4" aria-hidden="true" />
                Requests
              </NavButton>
              <NavButton
                active={adminTab === "courts"}
                onClick={() => setAdminTab("courts")}
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                Courts
              </NavButton>
              <NavButton
                active={adminTab === "open-play"}
                onClick={() => setAdminTab("open-play")}
              >
                <Users className="h-4 w-4" aria-hidden="true" />
                Compete
              </NavButton>
              <NavButton
                active={adminTab === "reports"}
                onClick={() => setAdminTab("reports")}
              >
                <Gauge className="h-4 w-4" aria-hidden="true" />
                Reports
              </NavButton>
              <NavButton
                active={adminTab === "settings"}
                onClick={() => setAdminTab("settings")}
              >
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                Settings
              </NavButton>
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {role === "player" ? (
          <section className="w-full space-y-6">
            {playerTab === "book" && (
              <div className="space-y-6">
                {bookingSetupPending && (
                  <div
                    className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm font-medium text-sky-900"
                    role="status"
                  >
                    Loading courts from Supabase...
                  </div>
                )}

                {bookingDataMessage && (
                  <div
                    className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900"
                    role="status"
                  >
                    {bookingDataMessage}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-3">
                  {managedCourts
                    .filter((c) => c.enabled)
                    .map((court) => (
                      <button
                        className={cn(
                          "group overflow-hidden rounded-xl border bg-white p-0 text-left shadow-sm transition-all hover:border-lime-500 hover:shadow-md",
                          selectedCourtId === court.id
                            ? "border-lime-500 ring-2 ring-lime-400"
                            : "border-stone-200",
                        )}
                        key={court.id}
                        type="button"
                        onClick={() => handleCourtChange(court.id)}
                      >
                        {court.image ? (
                          <div className="relative h-36 w-full overflow-hidden bg-stone-100">
                            <Image
                              src={court.image}
                              alt={court.name}
                              fill
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                            <Badge
                              className="absolute right-2 top-2 shadow-xs"
                              variant={
                                selectedCourtId === court.id
                                  ? "success"
                                  : "default"
                              }
                            >
                              {selectedCourtId === court.id
                                ? "Selected"
                                : "Active"}
                            </Badge>
                            <span className="absolute bottom-2 left-2 text-xs font-semibold text-white drop-shadow">
                              {court.zone || court.surface}
                            </span>
                          </div>
                        ) : (
                          <div className="relative flex h-28 w-full items-center justify-center bg-stone-100 text-stone-400">
                            <FileImage className="h-8 w-8 opacity-40" />
                            <Badge
                              className="absolute right-2 top-2"
                              variant={
                                selectedCourtId === court.id
                                  ? "success"
                                  : "default"
                              }
                            >
                              {selectedCourtId === court.id
                                ? "Selected"
                                : "Active"}
                            </Badge>
                          </div>
                        )}

                        <div className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-bold text-stone-950">
                              {court.name}
                            </p>
                            <span className="text-sm font-extrabold text-lime-800">
                              {formatCurrency(court.pricePerHour)}/hr
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-stone-600">
                            {court.surface}
                          </p>
                          <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
                            <span>
                              Hours:{" "}
                              {formatTimeRange12Hour(court.open, court.close)}
                            </span>
                            <span className="font-semibold text-lime-700">
                              Click to Select →
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Step-by-Step Court Booking</CardTitle>
                    <CardDescription>
                      Login, choose a schedule, upload proof, and wait for
                      manager approval.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form
                      className="grid gap-5"
                      onSubmit={handleBookingFormSubmit}
                    >
                      <div className="grid gap-2 sm:grid-cols-3">
                        {bookingSteps.map((step, index) => {
                          const stepNumber = index + 1;

                          return (
                            <button
                              className={cn(
                                "rounded-lg border p-3 text-left text-sm transition-colors",
                                bookingStep === stepNumber
                                  ? "border-lime-500 bg-lime-50 text-lime-900"
                                  : bookingStep > stepNumber
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                    : "border-stone-200 bg-white text-stone-600",
                              )}
                              key={step}
                              type="button"
                              onClick={() => setBookingStep(stepNumber)}
                            >
                              <span className="block text-xs font-bold uppercase">
                                Step {stepNumber}
                              </span>
                              <span className="mt-1 block font-semibold">
                                {step}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {bookingStep === 1 && (
                        <div className="space-y-6">
                          {/* Court Selection Cards */}
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-stone-900">
                              1. Select Court
                            </Label>
                            <div className="grid gap-3 sm:grid-cols-3">
                              {managedCourts.map((court) => {
                                const isSelected = selectedCourtId === court.id;

                                return (
                                  <button
                                    className={cn(
                                      "group overflow-hidden rounded-xl border p-0 text-left shadow-sm transition-all",
                                      isSelected
                                        ? "border-lime-500 bg-lime-50/60 ring-2 ring-lime-400"
                                        : "border-stone-200 bg-white hover:border-lime-300 hover:bg-stone-50",
                                      !court.enabled &&
                                        "cursor-not-allowed opacity-50",
                                    )}
                                    key={court.id}
                                    type="button"
                                    disabled={!court.enabled}
                                    onClick={() => handleCourtChange(court.id)}
                                  >
                                    {court.image ? (
                                      <div className="relative h-28 w-full overflow-hidden bg-stone-100">
                                        <Image
                                          src={court.image}
                                          alt={court.name}
                                          fill
                                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                                        <Badge
                                          className="absolute right-2 top-2 shadow-xs"
                                          variant={
                                            court.enabled
                                              ? isSelected
                                                ? "success"
                                                : "default"
                                              : "neutral"
                                          }
                                        >
                                          {isSelected
                                            ? "✓ Selected"
                                            : court.enabled
                                              ? "Enabled"
                                              : "Disabled"}
                                        </Badge>
                                      </div>
                                    ) : null}
                                    <div className="p-3.5">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="font-bold text-stone-950">
                                          {court.name}
                                        </p>
                                        {!court.image && (
                                          <Badge
                                            variant={
                                              court.enabled
                                                ? isSelected
                                                  ? "success"
                                                  : "default"
                                                : "neutral"
                                            }
                                          >
                                            {isSelected
                                              ? "Selected"
                                              : court.enabled
                                                ? "Enabled"
                                                : "Disabled"}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="mt-1 text-xs text-stone-600">
                                        {court.surface} · {court.zone}
                                      </p>
                                      <div className="mt-2.5 flex items-center justify-between text-xs">
                                        <span className="text-stone-500">
                                          {formatTimeRange12Hour(
                                            court.open,
                                            court.close,
                                          )}
                                        </span>
                                        <span className="text-sm font-bold text-lime-800">
                                          {formatCurrency(court.pricePerHour)}
                                          /hr
                                        </span>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Booking Parameters Bar */}
                          <div className="grid gap-4 md:grid-cols-3">
                            <Field>
                              <Label htmlFor="court-select">
                                Court Selection
                              </Label>
                              <Select
                                id="court-select"
                                value={selectedCourtId}
                                onChange={(event) =>
                                  handleCourtChange(event.target.value)
                                }
                              >
                                {managedCourts
                                  .filter((court) => court.enabled)
                                  .map((court) => (
                                    <option key={court.id} value={court.id}>
                                      {court.name} ·{" "}
                                      {formatCurrency(court.pricePerHour)}/hr (
                                      {formatTimeRange12Hour(
                                        court.open,
                                        court.close,
                                      )}
                                      )
                                    </option>
                                  ))}
                              </Select>
                            </Field>

                            <Field>
                              <Label htmlFor="date">Booking Date</Label>
                              <Input
                                id="date"
                                min={today}
                                type="date"
                                value={selectedDate}
                                onChange={(event) =>
                                  setSelectedDate(event.target.value)
                                }
                              />
                            </Field>

                            <Field>
                              <Label htmlFor="hours">Playing Duration</Label>
                              <Select
                                id="hours"
                                value={selectedHours}
                                onChange={(event) =>
                                  setSelectedHours(Number(event.target.value))
                                }
                              >
                                {[1, 2, 3, 4].map((hours) => (
                                  <option key={hours} value={hours}>
                                    {hours} {hours === 1 ? "hour" : "hours"}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                          </div>

                          {/* Complete Hours Schedule Grid */}
                          <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <h4 className="font-bold text-stone-900">
                                  Complete Hours Schedule for{" "}
                                  {selectedCourt.name}
                                </h4>
                                <p className="text-xs text-stone-600">
                                  Operating Hours:{" "}
                                  {formatTimeRange12Hour(
                                    selectedCourt.open,
                                    selectedCourt.close,
                                  )}{" "}
                                  ({selectedDate}). Click an available hour slot
                                  to set your start time:
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-xs">
                                <span className="inline-flex items-center gap-1">
                                  <span className="inline-block h-3 w-3 rounded-full border border-lime-600 bg-lime-400" />
                                  Available
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <span className="inline-block h-3 w-3 rounded-full border border-rose-700 bg-rose-500" />
                                  🔒 Locked (Approved)
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <span className="inline-block h-3 w-3 rounded-full border border-amber-600 bg-amber-400" />
                                  ⏳ Held (Pending)
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                              {slotOptions.map((slot) => {
                                const startMin = timeToMinutes(slot.time);
                                const selStartMin =
                                  timeToMinutes(selectedStart);
                                const selEndMin = timeToMinutes(selectedEnd);
                                const isSelectedSpan =
                                  startMin >= selStartMin &&
                                  startMin < selEndMin;

                                if (slot.locked) {
                                  return (
                                    <div
                                      className="relative flex flex-col justify-between rounded-lg border border-rose-200 bg-rose-50/90 p-3 text-left shadow-xs transition-all"
                                      key={slot.time}
                                      title={`Locked: Booked by ${slot.lockedBy || "User"}`}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="text-xs font-bold text-rose-950">
                                          {formatTimeRange12Hour(
                                            slot.time,
                                            slot.endTime,
                                          )}
                                        </span>
                                        <Badge
                                          className="gap-1 px-1.5 py-0 text-[10px]"
                                          variant="destructive"
                                        >
                                          <Lock className="h-2.5 w-2.5" />
                                          Locked
                                        </Badge>
                                      </div>
                                      <div className="mt-2 text-xs font-semibold text-rose-900 truncate">
                                        Booked by:
                                      </div>
                                      <div className="text-xs font-extrabold text-rose-950 truncate">
                                        {slot.lockedBy || "Reserved User"}
                                      </div>
                                    </div>
                                  );
                                }

                                if (slot.held) {
                                  return (
                                    <div
                                      className="relative flex flex-col justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 text-left shadow-xs transition-all"
                                      key={slot.time}
                                      title={`Held: Pending request by ${slot.heldBy || "User"}`}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="text-xs font-bold text-amber-950">
                                          {formatTimeRange12Hour(
                                            slot.time,
                                            slot.endTime,
                                          )}
                                        </span>
                                        <Badge
                                          className="gap-1 px-1.5 py-0 text-[10px]"
                                          variant="warning"
                                        >
                                          <Clock className="h-2.5 w-2.5" />
                                          Held
                                        </Badge>
                                      </div>
                                      <div className="mt-2 text-xs font-semibold text-amber-900 truncate">
                                        Pending review:
                                      </div>
                                      <div className="text-xs font-bold text-amber-950 truncate">
                                        {slot.heldBy || "Pending User"}
                                      </div>
                                    </div>
                                  );
                                }

                                if (slot.blocked) {
                                  return (
                                    <div
                                      className="relative flex flex-col justify-between rounded-lg border border-stone-200 bg-stone-100 p-3 text-left shadow-xs opacity-75"
                                      key={slot.time}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="text-xs font-bold text-stone-600">
                                          {formatTimeRange12Hour(
                                            slot.time,
                                            slot.endTime,
                                          )}
                                        </span>
                                        <Badge
                                          className="px-1.5 py-0 text-[10px]"
                                          variant="neutral"
                                        >
                                          Blocked
                                        </Badge>
                                      </div>
                                      <div className="mt-2 text-xs text-stone-600 truncate">
                                        {slot.blockReason || "Maintenance"}
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <button
                                    className={cn(
                                      "relative flex flex-col justify-between rounded-lg border p-3 text-left shadow-xs transition-all",
                                      isSelectedSpan
                                        ? "border-lime-600 bg-lime-400 text-stone-950 font-bold shadow-md scale-[1.02] ring-2 ring-lime-500"
                                        : "border-stone-200 bg-white text-stone-900 hover:border-lime-400 hover:bg-lime-50/50",
                                    )}
                                    key={slot.time}
                                    type="button"
                                    onClick={() => setSelectedStart(slot.time)}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="text-xs font-bold">
                                        {formatTimeRange12Hour(
                                          slot.time,
                                          slot.endTime,
                                        )}
                                      </span>
                                      {isSelectedSpan ? (
                                        <span className="rounded bg-lime-200 px-1 text-[10px] font-black text-black">
                                          ✓ Pick
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-semibold text-lime-700">
                                          Available
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-2 text-xs font-semibold">
                                      {formatCurrency(
                                        selectedCourt.pricePerHour,
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Dropdown Alternative */}
                          <Field>
                            <Label htmlFor="start-select">
                              Start Time Choice (Dropdown)
                            </Label>
                            <Select
                              id="start-select"
                              value={selectedStart}
                              onChange={(event) =>
                                setSelectedStart(event.target.value)
                              }
                            >
                              {slotOptions.map((slot) => (
                                <option
                                  disabled={
                                    slot.blocked || slot.held || slot.locked
                                  }
                                  key={slot.time}
                                  value={slot.time}
                                >
                                  {formatTimeRange12Hour(
                                    slot.time,
                                    slot.endTime,
                                  )}
                                  {slot.locked
                                    ? ` (🔒 Locked - Booked by ${slot.lockedBy || "Player"})`
                                    : slot.held
                                      ? ` (⏳ Held - Pending Review by ${slot.heldBy || "Player"})`
                                      : slot.blocked
                                        ? ` (⛔ Blocked - ${slot.blockReason || "Maintenance"})`
                                        : " (Available)"}
                                </option>
                              ))}
                            </Select>
                          </Field>

                          {/* Summary & Conflict Alert */}
                          <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
                            <div className="grid gap-3 sm:grid-cols-3">
                              <div>
                                <p className="text-xs font-medium text-stone-600">
                                  Reserved Schedule
                                </p>
                                <p className="mt-0.5 text-base font-bold text-stone-950">
                                  {formatTimeRange12Hour(
                                    selectedStart,
                                    selectedEnd,
                                  )}{" "}
                                  ({selectedHours}{" "}
                                  {selectedHours === 1 ? "hour" : "hours"})
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-stone-600">
                                  Selected Court
                                </p>
                                <p className="mt-0.5 text-base font-bold text-stone-950">
                                  {selectedCourt.name} ({selectedCourt.surface})
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-stone-600">
                                  Total Fee
                                </p>
                                <p className="mt-0.5 text-xl font-black text-lime-800">
                                  {formatCurrency(bookingAmount)}
                                </p>
                              </div>
                            </div>

                            <p className="text-xs text-stone-600">
                              🔒 Approved bookings lock the reserved hours
                              immediately for all players. Pending requests
                              temporarily hold the slot while payment is under
                              review.
                            </p>

                            {selectedSlotUnavailable && (
                              <div className="flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-xs font-bold text-rose-900">
                                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                                <div>
                                  {isExceedingClose ? (
                                    <span>
                                      The requested duration (
                                      {formatTimeRange12Hour(
                                        selectedStart,
                                        selectedEnd,
                                      )}
                                      ) extends past court closing time (
                                      {formatTime12Hour(selectedCourt.close)}).
                                    </span>
                                  ) : overlappingApprovedBooking ? (
                                    <span>
                                      The requested range (
                                      {formatTimeRange12Hour(
                                        selectedStart,
                                        selectedEnd,
                                      )}
                                      ) overlaps with an approved booking
                                      reserved by{" "}
                                      <strong className="underline">
                                        {overlappingApprovedBooking.player}
                                      </strong>{" "}
                                      (
                                      {formatTimeRange12Hour(
                                        overlappingApprovedBooking.startTime,
                                        overlappingApprovedBooking.endTime,
                                      )}
                                      ). Please select a different start time or
                                      duration.
                                    </span>
                                  ) : overlappingPendingBooking ? (
                                    <span>
                                      The requested range (
                                      {formatTimeRange12Hour(
                                        selectedStart,
                                        selectedEnd,
                                      )}
                                      ) overlaps with a pending reservation held
                                      by{" "}
                                      <strong>
                                        {overlappingPendingBooking.player}
                                      </strong>{" "}
                                      (
                                      {formatTimeRange12Hour(
                                        overlappingPendingBooking.startTime,
                                        overlappingPendingBooking.endTime,
                                      )}
                                      ).
                                    </span>
                                  ) : overlappingBlock ? (
                                    <span>
                                      The requested range (
                                      {formatTimeRange12Hour(
                                        selectedStart,
                                        selectedEnd,
                                      )}
                                      ) overlaps with a blocked slot (
                                      {overlappingBlock.reason}).
                                    </span>
                                  ) : (
                                    <span>
                                      This schedule is unavailable. Please
                                      choose another time.
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {bookingStep === 2 && (
                        <div className="space-y-6">
                          {/* Addons Selection */}
                          <div className="grid gap-4 md:grid-cols-2">
                            {/* Rent Paddle */}
                            <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="text-sm font-bold text-stone-950">
                                    Rent Paddle
                                  </h4>
                                  <p className="text-xs text-stone-500">
                                    ₱50 per paddle
                                  </p>
                                </div>
                                <span className="text-sm font-extrabold text-lime-800">
                                  {formatCurrency(paddleAmount)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  disabled={paddleQty <= 0}
                                  onClick={() =>
                                    setPaddleQty((q) => Math.max(q - 1, 0))
                                  }
                                >
                                  -
                                </Button>
                                <span className="w-8 text-center text-base font-bold text-stone-900">
                                  {paddleQty}
                                </span>
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  onClick={() => setPaddleQty((q) => q + 1)}
                                >
                                  +
                                </Button>
                                <span className="text-xs text-stone-500">
                                  {paddleQty === 0
                                    ? "No paddles rented"
                                    : `${paddleQty} ${paddleQty === 1 ? "paddle" : "paddles"}`}
                                </span>
                              </div>
                            </div>

                            {/* Buy Ball */}
                            <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="text-sm font-bold text-stone-950">
                                    Buy Pickleball
                                  </h4>
                                  <p className="text-xs text-stone-500">
                                    ₱100 per ball
                                  </p>
                                </div>
                                <span className="text-sm font-extrabold text-lime-800">
                                  {formatCurrency(ballAmount)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  disabled={ballQty <= 0}
                                  onClick={() =>
                                    setBallQty((q) => Math.max(q - 1, 0))
                                  }
                                >
                                  -
                                </Button>
                                <span className="w-8 text-center text-base font-bold text-stone-900">
                                  {ballQty}
                                </span>
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  onClick={() => setBallQty((q) => q + 1)}
                                >
                                  +
                                </Button>
                                <span className="text-xs text-stone-500">
                                  {ballQty === 0
                                    ? "No balls purchased"
                                    : `${ballQty} ${ballQty === 1 ? "ball" : "balls"}`}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Other Addons / Special Instructions */}
                          <Field>
                            <Label htmlFor="addon-comments">
                              Other Addons &amp; Special Requests (Comments
                              Only)
                            </Label>
                            <Textarea
                              id="addon-comments"
                              rows={3}
                              placeholder="Add notes (e.g., extra overgrip, water request, coaching inquiry, or special preferences)..."
                              value={addonComments}
                              onChange={(event) =>
                                setAddonComments(event.target.value)
                              }
                            />
                          </Field>

                          {/* Total Fee Breakdown */}
                          <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-4">
                            <h4 className="text-sm font-bold text-stone-900">
                              Fee Breakdown &amp; Grand Total
                            </h4>
                            <div className="space-y-1.5 text-xs text-stone-700">
                              <div className="flex justify-between">
                                <span>
                                  Court Fee ({selectedCourt.name} ·{" "}
                                  {selectedHours} hrs):
                                </span>
                                <span className="font-semibold">
                                  {formatCurrency(courtAmount)}
                                </span>
                              </div>
                              {paddleQty > 0 && (
                                <div className="flex justify-between">
                                  <span>
                                    Paddle Rental ({paddleQty} x ₱50):
                                  </span>
                                  <span className="font-semibold">
                                    {formatCurrency(paddleAmount)}
                                  </span>
                                </div>
                              )}
                              {ballQty > 0 && (
                                <div className="flex justify-between">
                                  <span>
                                    Pickleball Purchase ({ballQty} x ₱100):
                                  </span>
                                  <span className="font-semibold">
                                    {formatCurrency(ballAmount)}
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between border-t border-stone-200 pt-2 text-sm font-black text-stone-950">
                                <span>Grand Total:</span>
                                <span className="text-lg text-lime-800">
                                  {formatCurrency(grandTotalAmount)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Payment Section */}
                          <div className="grid gap-6 md:grid-cols-[1fr_1.2fr] border-t border-stone-200 pt-6">
                            <div className="space-y-4">
                              <div>
                                <Label className="text-sm font-semibold text-stone-900">
                                  Payment Method
                                </Label>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  {(
                                    [
                                      "GCash",
                                      "Bank Transfer",
                                    ] as PaymentMethod[]
                                  ).map((method) => (
                                    <button
                                      className={cn(
                                        "rounded-lg border px-3 py-3 text-sm font-semibold transition-colors",
                                        paymentMethod === method
                                          ? "border-lime-500 bg-lime-50 text-lime-800 ring-1 ring-lime-400"
                                          : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50",
                                      )}
                                      key={method}
                                      type="button"
                                      aria-pressed={paymentMethod === method}
                                      onClick={() => setPaymentMethod(method)}
                                    >
                                      {method}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <Field>
                                <Label htmlFor="reference">
                                  Payment Reference Number
                                </Label>
                                <Input
                                  id="reference"
                                  placeholder="e.g. GC-998822 or BPI-10492"
                                  value={reference}
                                  onChange={(event) =>
                                    setReference(event.target.value)
                                  }
                                />
                              </Field>

                              <Field>
                                <Label htmlFor="receipt">
                                  Upload Payment Proof / Receipt
                                </Label>
                                <Input
                                  id="receipt"
                                  accept="image/*,.pdf"
                                  type="file"
                                  onChange={handleReceiptChange}
                                />
                                {receiptName && (
                                  <p className="mt-1 text-xs font-semibold text-lime-800">
                                    Selected file: {receiptName}
                                  </p>
                                )}
                                {receiptDataUrl.startsWith("data:image/") && (
                                  <div className="mt-3 overflow-hidden rounded-lg border border-stone-300 bg-stone-50 p-2">
                                    <p className="mb-1 text-xs font-semibold text-stone-700">
                                      Uploaded Receipt Preview:
                                    </p>
                                    <div className="relative h-36 w-full overflow-hidden rounded-md border border-stone-200">
                                      <Image
                                        src={receiptDataUrl}
                                        alt="Uploaded receipt preview"
                                        fill
                                        unoptimized
                                        className="object-contain bg-white"
                                      />
                                    </div>
                                  </div>
                                )}
                              </Field>
                            </div>

                            <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-xs">
                              <h4 className="text-sm font-bold text-stone-950">
                                Manager Payment Details
                              </h4>
                              <div className="grid grid-cols-[100px_1fr] gap-4">
                                <Image
                                  src={paymentInfo.qrCode}
                                  alt="Manager payment QR code"
                                  width={100}
                                  height={100}
                                  className="rounded-lg border border-stone-200"
                                />
                                <div className="space-y-1 text-sm text-stone-600">
                                  <p className="font-bold text-stone-950">
                                    {paymentMethod === "GCash"
                                      ? "GCash Account"
                                      : paymentInfo.bankName}
                                  </p>
                                  <p className="font-semibold text-stone-900">
                                    {paymentMethod === "GCash"
                                      ? paymentInfo.gcashNumber
                                      : paymentInfo.bankAccountNumber}
                                  </p>
                                  <p className="text-xs text-stone-500">
                                    Account Name: {paymentInfo.bankAccountName}
                                  </p>
                                  <p className="mt-2 text-xs text-stone-500">
                                    Send total{" "}
                                    <strong className="text-lime-800">
                                      {formatCurrency(grandTotalAmount)}
                                    </strong>{" "}
                                    or court fee{" "}
                                    <strong className="text-lime-800">
                                      {formatCurrency(courtAmount)}
                                    </strong>{" "}
                                    to confirm.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {bookingStep === 3 && (
                        <div className="space-y-4 rounded-xl border border-stone-200 bg-stone-50 p-5">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <p className="text-xs font-medium text-stone-600">
                                Player
                              </p>
                              <p className="mt-0.5 text-sm font-bold text-stone-950">
                                {signedInUser
                                  ? `${signedInUser.fullName} (@${signedInUser.username})`
                                  : "Login required"}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-medium text-stone-600">
                                Court &amp; Schedule
                              </p>
                              <p className="mt-0.5 text-sm font-bold text-stone-950">
                                {selectedCourt.name}, {selectedDate},{" "}
                                {formatTimeRange12Hour(
                                  selectedStart,
                                  selectedEnd,
                                )}{" "}
                                ({selectedHours} hrs)
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-medium text-stone-600">
                                Payment Details
                              </p>
                              <p className="mt-0.5 text-sm font-bold text-stone-950">
                                {paymentMethod} · Ref: {reference || "None"}
                              </p>
                              {receiptName && (
                                <p className="text-xs text-stone-500">
                                  Receipt: {receiptName}
                                </p>
                              )}
                            </div>

                            <div>
                              <p className="text-xs font-medium text-stone-600">
                                Equipment &amp; Addons
                              </p>
                              <p className="mt-0.5 text-sm font-bold text-stone-950">
                                Paddles: {paddleQty} · Balls: {ballQty}
                              </p>
                              {addonComments.trim() && (
                                <p className="text-xs italic text-stone-600">
                                  &quot;{addonComments}&quot;
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-3">
                            <div>
                              <span className="text-xs text-stone-500">
                                Total Amount Due
                              </span>
                              <p className="text-2xl font-black text-lime-800">
                                {formatCurrency(grandTotalAmount)}
                              </p>
                            </div>
                            <p className="max-w-md rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs font-medium text-amber-900">
                              Your booking will remain Pending until the manager
                              verifies your payment proof. Once approved, your
                              exact court hours are locked.
                            </p>
                          </div>

                          {selectedSlotUnavailable && (
                            <div className="flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-xs font-bold text-rose-900">
                              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                              <p>{unavailableScheduleMessage}</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                        <Button
                          disabled={bookingStep === 1}
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setBookingStep((step) => Math.max(step - 1, 1))
                          }
                        >
                          Back
                        </Button>

                        {bookingStep < 3 ? (
                          <Button
                            disabled={!canContinueBooking}
                            type="button"
                            onClick={() =>
                              setBookingStep((step) => Math.min(step + 1, 3))
                            }
                          >
                            Continue
                          </Button>
                        ) : (
                          <Button
                            className="w-full sm:w-fit"
                            disabled={bookingSubmitDisabled}
                            size="lg"
                            type="button"
                            onClick={() => {
                              void handleBookingSubmit();
                            }}
                          >
                            <Upload className="h-4 w-4" aria-hidden="true" />
                            Submit Booking
                          </Button>
                        )}
                      </div>
                    </form>

                    {confirmation && (
                      <div
                        className={cn(
                          "mt-5 rounded-lg border p-4 text-sm font-medium",
                          confirmationTone === "error"
                            ? "border-rose-200 bg-rose-50 text-rose-900"
                            : "border-emerald-200 bg-emerald-50 text-emerald-900",
                        )}
                        role="status"
                      >
                        {confirmation}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {playerTab === "bookings" && (
              <div className="grid gap-6">
                <BookingList
                  bookings={upcomingBookings}
                  title="Upcoming Bookings"
                  onCancel={cancelBooking}
                />
                <BookingList
                  bookings={previousBookings}
                  title="Previous Bookings"
                />
              </div>
            )}

            {playerTab === "open-play" && (
              <div className="grid gap-4 md:grid-cols-2">
                {managedSessions.length === 0 ? (
                  <Card className="col-span-full border-dashed">
                    <CardContent className="p-6 text-center text-stone-500">
                      No open play sessions currently scheduled.
                    </CardContent>
                  </Card>
                ) : (
                  managedSessions.map((session) => {
                    const currentApplicant = openPlayApplicants.find(
                      (applicant) =>
                        applicant.sessionId === session.id &&
                        openPlayApplicantBelongsToCurrentUser(applicant),
                    );
                    const isApproved =
                      currentApplicant?.status === "Approved" &&
                      currentApplicant.paymentStatus === "Verified";
                    const isPendingApproval =
                      currentApplicant?.status === "Pending" &&
                      currentApplicant.paymentStatus !== "Rejected";
                    const isRejected =
                      currentApplicant?.status === "Rejected" ||
                      currentApplicant?.paymentStatus === "Rejected";
                    const isPaymentFormOpen =
                      openPlayPaymentSessionId === session.id;
                    const joinedPlayers = session.joinedPlayers;
                    const remaining = Math.max(
                      session.maxPlayers - joinedPlayers,
                      0,
                    );
                    const skillChoices = getOpenPlaySkillChoices(session);

                    return (
                      <Card key={session.id}>
                        <CardHeader>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <CardTitle>{session.title}</CardTitle>
                              <CardDescription>
                                {session.date} ·{" "}
                                {formatTimeRange12Hour(
                                  session.startTime,
                                  session.endTime,
                                )}
                              </CardDescription>
                            </div>
                            <Badge variant={statusVariant(session.status)}>
                              {session.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-3 text-sm sm:grid-cols-2">
                            <p>
                              <span className="font-semibold text-stone-950">
                                Court:
                              </span>{" "}
                              {formatSessionCourts(session)}
                            </p>
                            <p>
                              <span className="font-semibold text-stone-950">
                                Skill:
                              </span>{" "}
                              {formatSessionSkillLevels(session)}
                            </p>
                            <p>
                              <span className="font-semibold text-stone-950">
                                Format:
                              </span>{" "}
                              {formatSessionFormats(session)}
                            </p>
                            <p>
                              <span className="font-semibold text-stone-950">
                                Fee:
                              </span>{" "}
                              {formatCurrency(session.fee)}
                            </p>
                            <p>
                              <span className="font-semibold text-stone-950">
                                Slots:
                              </span>{" "}
                              {remaining} open
                            </p>
                          </div>
                          <ProgressBar
                            value={(joinedPlayers / session.maxPlayers) * 100}
                          />

                          {currentApplicant && (
                            <div
                              className={cn(
                                "rounded-lg border p-3 text-sm font-medium",
                                isApproved
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                  : isRejected
                                    ? "border-rose-200 bg-rose-50 text-rose-900"
                                    : "border-amber-200 bg-amber-50 text-amber-900",
                              )}
                              role="status"
                            >
                              {isApproved
                                ? "Approved. Your open-play slot is confirmed."
                                : isRejected
                                  ? "Payment was rejected. Submit a new GCash proof."
                                  : "Payment proof submitted. Waiting for admin approval."}
                            </div>
                          )}

                          {isPaymentFormOpen && (
                            <form
                              className="space-y-4 rounded-lg border border-lime-200 bg-lime-50/60 p-4"
                              onSubmit={(event) =>
                                handleOpenPlayApplicationSubmit(event, session)
                              }
                            >
                              <div className="grid gap-3 text-sm sm:grid-cols-2">
                                <div className="rounded-md border border-stone-200 bg-white p-3">
                                  <p className="text-xs font-semibold uppercase text-stone-500">
                                    GCash
                                  </p>
                                  <p className="mt-1 font-bold text-stone-950">
                                    {paymentInfo.gcashNumber}
                                  </p>
                                </div>
                                <div className="rounded-md border border-stone-200 bg-white p-3">
                                  <p className="text-xs font-semibold uppercase text-stone-500">
                                    Amount
                                  </p>
                                  <p className="mt-1 font-bold text-lime-800">
                                    {formatCurrency(session.fee)}
                                  </p>
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2">
                                <Field>
                                  <Label htmlFor={`open-play-skill-${session.id}`}>
                                    Skill Level
                                  </Label>
                                  <Select
                                    id={`open-play-skill-${session.id}`}
                                    value={openPlaySkillLevel}
                                    onChange={(event) =>
                                      setOpenPlaySkillLevel(
                                        event.target
                                          .value as OpenPlayApplicantSkillLevel,
                                      )
                                    }
                                  >
                                    {skillChoices.map((skillLevel) => (
                                      <option
                                        key={skillLevel}
                                        value={skillLevel}
                                      >
                                        {skillLevel}
                                      </option>
                                    ))}
                                  </Select>
                                </Field>

                                <Field>
                                  <Label
                                    htmlFor={`open-play-reference-${session.id}`}
                                  >
                                    GCash Reference
                                  </Label>
                                  <Input
                                    id={`open-play-reference-${session.id}`}
                                    value={openPlayPaymentReference}
                                    onChange={(event) =>
                                      setOpenPlayPaymentReference(
                                        event.target.value,
                                      )
                                    }
                                    required
                                  />
                                </Field>
                              </div>

                              <Field>
                                <Label htmlFor={`open-play-proof-${session.id}`}>
                                  Upload Payment Proof
                                </Label>
                                <Input
                                  id={`open-play-proof-${session.id}`}
                                  type="file"
                                  accept="image/*,.pdf"
                                  onChange={handleOpenPlayReceiptChange}
                                  required
                                />
                                {openPlayReceiptName && (
                                  <p className="text-xs font-medium text-stone-500">
                                    Selected file: {openPlayReceiptName}
                                  </p>
                                )}
                                {openPlayReceiptDataUrl.startsWith(
                                  "data:image/",
                                ) && (
                                  <div className="relative mt-2 h-32 w-32 overflow-hidden rounded-lg border border-stone-200 bg-white">
                                    <Image
                                      src={openPlayReceiptDataUrl}
                                      alt="Uploaded open-play payment proof preview"
                                      fill
                                      unoptimized
                                      className="object-cover"
                                    />
                                  </div>
                                )}
                              </Field>

                              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setOpenPlayPaymentSessionId("");
                                    setOpenPlayStatusMessage("");
                                    setOpenPlayStatusSessionId("");
                                    resetOpenPlayPaymentDraft();
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="submit"
                                  disabled={
                                    openPlaySubmitPending ||
                                    openPlayPaymentReference.trim().length ===
                                      0 ||
                                    openPlayReceiptName.length === 0
                                  }
                                >
                                  <Upload
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Submit for Approval
                                </Button>
                              </div>
                            </form>
                          )}

                          {openPlayStatusMessage &&
                            openPlayStatusSessionId === session.id &&
                            (isPaymentFormOpen || !currentApplicant) && (
                            <div
                              className={cn(
                                "rounded-lg border p-3 text-sm font-medium",
                                openPlayStatusTone === "error"
                                  ? "border-rose-200 bg-rose-50 text-rose-900"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-900",
                              )}
                              role="status"
                            >
                              {openPlayStatusMessage}
                            </div>
                          )}

                          <Button
                            className="w-full"
                            variant={isRejected ? "outline" : "default"}
                            type="button"
                            disabled={
                              isApproved ||
                              isPendingApproval ||
                              remaining === 0
                            }
                            onClick={() => handleJoinOpenPlay(session)}
                          >
                            {isApproved
                              ? "Approved"
                              : isPendingApproval
                                ? "Waiting for Approval"
                                : isRejected
                                  ? "Resubmit Proof"
                                  : "Pay with GCash"}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            )}

            {playerTab === "tournaments" && (
              <div className="grid gap-4 md:grid-cols-2">
                {managedTournaments.length === 0 ? (
                  <Card className="col-span-full border-dashed">
                    <CardContent className="p-6 text-center text-stone-500">
                      No tournaments currently scheduled.
                    </CardContent>
                  </Card>
                ) : (
                  managedTournaments.map((tournament) => {
                    const currentRegistration = tournamentRegistrations.find(
                      (participant) =>
                        participant.tournamentId === tournament.id &&
                        tournamentRegistrationBelongsToCurrentUser(
                          participant,
                        ),
                    );
                    const registered =
                      Boolean(currentRegistration) &&
                      currentRegistration?.status !== "Rejected";
                    const rosterCount = tournamentRegistrations.filter(
                      (participant) =>
                        participant.tournamentId === tournament.id &&
                        participant.status !== "Rejected",
                    ).length;
                    const participantCount =
                      Math.max(tournament.participants, rosterCount);

                    return (
                      <Card key={tournament.id}>
                        <CardHeader>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <CardTitle>{tournament.name}</CardTitle>
                              <CardDescription>
                                {tournament.date} · deadline{" "}
                                {tournament.deadline}
                              </CardDescription>
                            </div>
                            <Badge variant={statusVariant(tournament.status)}>
                              {tournament.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-3 text-sm sm:grid-cols-2">
                            <p>{tournament.category}</p>
                            <p>{tournament.division}</p>
                            <p>{formatCurrency(tournament.fee)}</p>
                            <p>
                              {participantCount}/{tournament.participantLimit}{" "}
                              players
                            </p>
                          </div>
                          <div className="rounded-lg bg-stone-50 p-3 text-sm text-stone-700">
                            {currentRegistration
                              ? currentRegistration.status === "Approved"
                                ? "Registration approved. Wait for match pairing."
                                : currentRegistration.status === "Rejected"
                                  ? "Registration rejected. You can register again."
                                  : "Registration pending admin approval."
                              : tournament.matches[0] ||
                                "No matches scheduled yet."}
                          </div>
                          <Button
                            className="w-full"
                            variant={registered ? "outline" : "default"}
                            disabled={
                              !registered &&
                              participantCount >= tournament.participantLimit
                            }
                            type="button"
                            onClick={() =>
                              handleTournamentRegistration(tournament)
                            }
                          >
                            {registered
                              ? currentRegistration?.status === "Approved"
                                ? "Leave Approved Registration"
                                : "Leave Pending Registration"
                              : currentRegistration?.status === "Rejected"
                                ? "Register Again"
                                : "Register"}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            )}

            {playerTab === "events" && (
              <div className="grid gap-4 lg:grid-cols-2">
                {managedEvents.length === 0 ? (
                  <Card className="col-span-full border-dashed">
                    <CardContent className="p-6 text-center text-stone-500">
                      No upcoming events listed.
                    </CardContent>
                  </Card>
                ) : (
                  managedEvents.map((eventItem) => {
                    const registered = registeredEvents.includes(eventItem.id);
                    const attendees =
                      eventItem.attendees + (registered ? 1 : 0);
                    const remaining = Math.max(
                      eventItem.maxAttendees - attendees,
                      0,
                    );

                    return (
                      <Card key={eventItem.id} className="overflow-hidden">
                        <Image
                          src={eventItem.image}
                          alt={eventItem.name}
                          width={900}
                          height={540}
                          className="h-44 w-full object-cover"
                        />
                        <CardHeader>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <CardTitle>{eventItem.name}</CardTitle>
                              <CardDescription>
                                {eventItem.description}
                              </CardDescription>
                            </div>
                            <Badge variant={statusVariant(eventItem.status)}>
                              {eventItem.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-3 text-sm sm:grid-cols-2">
                            <p>{eventItem.dateTime}</p>
                            <p>{eventItem.location}</p>
                            <p>Deadline {eventItem.deadline}</p>
                            <p>{formatCurrency(eventItem.fee)}</p>
                          </div>
                          <p className="text-sm font-semibold text-stone-700">
                            {remaining} slots remaining
                          </p>
                          <Button
                            className="w-full"
                            variant={registered ? "outline" : "default"}
                            disabled={!registered && remaining === 0}
                            onClick={() => handleEventRegistration(eventItem)}
                          >
                            {registered ? "Leave Event" : "Join Event"}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-6">
            {adminTab === "dashboard" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile
                    accent="bg-lime-50 text-lime-800"
                    icon={CalendarCheck}
                    label="Total Bookings"
                    value={bookings.length.toString()}
                  />
                  <StatTile
                    accent="bg-amber-50 text-amber-800"
                    icon={Clock}
                    label="Pending"
                    value={pendingBookings.length.toString()}
                  />
                  <StatTile
                    accent="bg-emerald-50 text-emerald-800"
                    icon={CheckCircle2}
                    label="Approved"
                    value={bookings
                      .filter((booking) => booking.status === "Approved")
                      .length.toString()}
                  />
                  <StatTile
                    accent="bg-sky-50 text-sky-800"
                    icon={Banknote}
                    label="Verified Payments"
                    value={formatCurrency(
                      verifiedPayments.reduce(
                        (total, booking) => total + booking.amount,
                        0,
                      ),
                    )}
                  />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Today&apos;s Bookings</CardTitle>
                    <CardDescription>{today}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AdminBookingRows
                      bookings={todayBookings}
                      onApprove={approveBooking}
                      onCancel={(booking) =>
                        updateBooking(booking.id, { status: "Cancelled" })
                      }
                      onComplete={(booking) =>
                        updateBooking(booking.id, { status: "Completed" })
                      }
                      onReject={rejectBooking}
                      onVerify={(booking) =>
                        updateBooking(booking.id, { paymentStatus: "Verified" })
                      }
                      onViewReceipt={(src, _title, player) =>
                        setViewingReceipt({
                          player,
                          src,
                          title: `Payment Proof - ${player}`,
                        })
                      }
                    />
                  </CardContent>
                </Card>
              </>
            )}

            {adminTab === "requests" && (
              <Card>
                <CardHeader>
                  <CardTitle>Booking Requests</CardTitle>
                  <CardDescription>
                    Receipts, payment status, and booking actions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
                    <Field>
                      <Label htmlFor="admin-search">Search</Label>
                      <div className="relative">
                        <Search
                          className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-stone-400"
                          aria-hidden="true"
                        />
                        <Input
                          id="admin-search"
                          className="pl-9"
                          placeholder="Player, court, or reference"
                          value={adminSearch}
                          onChange={(event) =>
                            setAdminSearch(event.target.value)
                          }
                        />
                      </div>
                    </Field>
                    <Field>
                      <Label htmlFor="admin-date">Date</Label>
                      <Input
                        id="admin-date"
                        type="date"
                        value={adminDate}
                        onChange={(event) => setAdminDate(event.target.value)}
                      />
                    </Field>
                    <Field>
                      <Label htmlFor="admin-status">Status</Label>
                      <Select
                        id="admin-status"
                        value={adminStatus}
                        onChange={(event) =>
                          setAdminStatus(
                            event.target.value as "All" | BookingStatus,
                          )
                        }
                      >
                        {[
                          "All",
                          "Pending",
                          "Approved",
                          "Rejected",
                          "Cancelled",
                          "Completed",
                        ].map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field>
                      <Label htmlFor="admin-payment">Payment</Label>
                      <Select
                        id="admin-payment"
                        value={adminPayment}
                        onChange={(event) =>
                          setAdminPayment(
                            event.target.value as "All" | PaymentMethod,
                          )
                        }
                      >
                        <option value="All">All</option>
                        <option value="GCash">GCash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </Select>
                    </Field>
                  </div>

                  <AdminBookingRows
                    bookings={filteredBookings}
                    onApprove={approveBooking}
                    onCancel={(booking) =>
                      updateBooking(booking.id, { status: "Cancelled" })
                    }
                    onComplete={(booking) =>
                      updateBooking(booking.id, { status: "Completed" })
                    }
                    onReject={rejectBooking}
                    onVerify={(booking) =>
                      updateBooking(booking.id, { paymentStatus: "Verified" })
                    }
                    onViewReceipt={(src, _title, player) =>
                      setViewingReceipt({
                        player,
                        src,
                        title: `Payment Proof - ${player}`,
                      })
                    }
                  />
                </CardContent>
              </Card>
            )}

            {adminTab === "courts" && (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Courts and Availability</CardTitle>
                        <CardDescription>
                          Click &quot;Edit Court&quot; to change court name,
                          surface, zone, pricing, operating hours, active
                          status, or upload photo.
                        </CardDescription>
                      </div>
                      <Badge variant="default">
                        {managedCourts.length} Courts Total
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {managedCourts.map((court) => (
                      <div
                        className="overflow-hidden rounded-xl border border-stone-200 bg-white p-4 shadow-xs transition-all hover:border-stone-300"
                        key={court.id}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex gap-4">
                            {court.image ? (
                              <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                                <Image
                                  src={court.image}
                                  alt={court.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="flex h-24 w-28 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 text-stone-400">
                                <FileImage className="h-6 w-6 opacity-40" />
                                <span className="mt-1 text-[10px]">
                                  No photo
                                </span>
                              </div>
                            )}

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-bold text-stone-950">
                                  {court.name}
                                </h3>
                                <Badge
                                  variant={
                                    court.enabled ? "success" : "neutral"
                                  }
                                >
                                  {court.enabled ? "Enabled" : "Disabled"}
                                </Badge>
                                <span className="font-mono text-xs font-semibold text-lime-800">
                                  {formatCurrency(court.pricePerHour)}/hr
                                </span>
                              </div>

                              <p className="mt-1 text-xs font-medium text-stone-600">
                                {court.surface} ·{" "}
                                {court.zone || "Main location"}
                              </p>

                              <p className="mt-1 text-xs text-stone-500">
                                Operating Hours:{" "}
                                <strong className="text-stone-800">
                                  {formatTimeRange12Hour(
                                    court.open,
                                    court.close,
                                  )}
                                </strong>
                              </p>

                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {court.slots.slice(0, 8).map((slot) => (
                                  <span
                                    className="rounded bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-700"
                                    key={slot}
                                  >
                                    {slot}
                                  </span>
                                ))}
                                {court.slots.length > 8 && (
                                  <span className="rounded bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500">
                                    +{court.slots.length - 8} more
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-row gap-2 sm:flex-col sm:items-end">
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="bg-stone-900 text-lime-300 hover:bg-black"
                              onClick={() => setEditingCourt(court)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit Court
                            </Button>

                            <Button
                              type="button"
                              variant={court.enabled ? "outline" : "secondary"}
                              size="sm"
                              onClick={() =>
                                updateCourt(court.id, {
                                  enabled: !court.enabled,
                                })
                              }
                            >
                              {court.enabled ? "Disable" : "Enable"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <h3 className="font-semibold text-amber-950">
                        Blocked Slots
                      </h3>
                      <div className="mt-3 grid gap-2">
                        {blockedSlots.length === 0 ? (
                          <p className="text-sm text-stone-500">
                            No blocked slots.
                          </p>
                        ) : (
                          blockedSlots.map((slot) => (
                            <div
                              className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white p-3 text-sm"
                              key={slot.id}
                            >
                              <span>
                                {slot.courtName} · {slot.date} ·{" "}
                                {slot.startTime} - {slot.endTime}
                              </span>
                              <span className="font-semibold text-amber-800">
                                {slot.reason}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Add Court</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form className="space-y-3" onSubmit={handleAddCourt}>
                        <Field>
                          <Label htmlFor="new-court">Court Name</Label>
                          <Input
                            id="new-court"
                            placeholder="e.g. Court D"
                            value={newCourtName}
                            onChange={(event) =>
                              setNewCourtName(event.target.value)
                            }
                            required
                          />
                        </Field>

                        <div className="grid grid-cols-2 gap-2">
                          <Field>
                            <Label htmlFor="new-court-surface">Surface</Label>
                            <Input
                              id="new-court-surface"
                              placeholder="Acrylic"
                              value={newCourtSurface}
                              onChange={(event) =>
                                setNewCourtSurface(event.target.value)
                              }
                            />
                          </Field>
                          <Field>
                            <Label htmlFor="new-court-zone">Zone</Label>
                            <Input
                              id="new-court-zone"
                              placeholder="Main area"
                              value={newCourtZone}
                              onChange={(event) =>
                                setNewCourtZone(event.target.value)
                              }
                            />
                          </Field>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Field>
                            <Label htmlFor="new-court-open">Open</Label>
                            <Input
                              id="new-court-open"
                              type="time"
                              value={newCourtOpen}
                              onChange={(event) =>
                                setNewCourtOpen(event.target.value)
                              }
                            />
                          </Field>
                          <Field>
                            <Label htmlFor="new-court-close">Close</Label>
                            <Input
                              id="new-court-close"
                              type="time"
                              value={newCourtClose}
                              onChange={(event) =>
                                setNewCourtClose(event.target.value)
                              }
                            />
                          </Field>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field>
                            <Label htmlFor="new-court-price">
                              Day Rate (₱/hr)
                            </Label>
                            <Input
                              id="new-court-price"
                              type="number"
                              min={0}
                              value={newCourtPrice}
                              onChange={(event) =>
                                setNewCourtPrice(Number(event.target.value))
                              }
                            />
                          </Field>
                          <Field>
                            <Label htmlFor="new-court-night-price">
                              Night Rate (₱/hr)
                            </Label>
                            <Input
                              id="new-court-night-price"
                              type="number"
                              min={0}
                              placeholder="e.g. 500"
                              value={newCourtNightPrice ?? ""}
                              onChange={(event) =>
                                setNewCourtNightPrice(
                                  event.target.value
                                    ? Number(event.target.value)
                                    : undefined,
                                )
                              }
                            />
                          </Field>
                          <Field>
                            <Label htmlFor="new-court-night-starts">
                              Night Starts At
                            </Label>
                            <Input
                              id="new-court-night-starts"
                              type="time"
                              value={newCourtNightStartsAt}
                              onChange={(event) =>
                                setNewCourtNightStartsAt(event.target.value)
                              }
                            />
                          </Field>
                        </div>

                        <Field>
                          <Label htmlFor="new-court-image-file">
                            Court Photo Upload
                          </Label>
                          <Input
                            id="new-court-image-file"
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (evt) => {
                                  if (typeof evt.target?.result === "string") {
                                    setNewCourtImage(evt.target.result);
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </Field>

                        {newCourtImage && (
                          <div className="relative h-24 w-full overflow-hidden rounded-lg border border-stone-200">
                            <Image
                              src={newCourtImage}
                              alt="Court preview"
                              fill
                              className="object-cover"
                            />
                            <button
                              type="button"
                              className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white"
                              onClick={() => setNewCourtImage("")}
                            >
                              Clear
                            </button>
                          </div>
                        )}

                        <Button className="w-full" type="submit">
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          Add Court
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Time Controls</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <form className="grid gap-3" onSubmit={handleAddSlot}>
                        <Field>
                          <Label htmlFor="slot-court">Court</Label>
                          <Select
                            id="slot-court"
                            value={slotCourtId}
                            onChange={(event) =>
                              setSlotCourtId(event.target.value)
                            }
                          >
                            {managedCourts.map((court) => (
                              <option key={court.id} value={court.id}>
                                {court.name}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field>
                          <Label htmlFor="new-slot">New Slot</Label>
                          <Input
                            id="new-slot"
                            type="time"
                            value={newSlot}
                            onChange={(event) => setNewSlot(event.target.value)}
                          />
                        </Field>
                        <Button type="submit" variant="outline">
                          Add Slot
                        </Button>
                      </form>

                      <form className="grid gap-3" onSubmit={handleBlockSlot}>
                        <Field>
                          <Label htmlFor="block-date">Block Date</Label>
                          <Input
                            id="block-date"
                            type="date"
                            value={blockDate}
                            onChange={(event) =>
                              setBlockDate(event.target.value)
                            }
                          />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                          <Field>
                            <Label htmlFor="block-start">Start</Label>
                            <Input
                              id="block-start"
                              type="time"
                              value={blockStart}
                              onChange={(event) =>
                                setBlockStart(event.target.value)
                              }
                            />
                          </Field>
                          <Field>
                            <Label htmlFor="block-hours">Hours</Label>
                            <Input
                              id="block-hours"
                              min={1}
                              type="number"
                              value={blockHours}
                              onChange={(event) =>
                                setBlockHours(Number(event.target.value))
                              }
                            />
                          </Field>
                        </div>
                        <Field>
                          <Label htmlFor="block-reason">Reason</Label>
                          <Input
                            id="block-reason"
                            value={blockReason}
                            onChange={(event) =>
                              setBlockReason(event.target.value)
                            }
                          />
                        </Field>
                        <Button type="submit" variant="secondary">
                          Block Time
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {adminTab === "open-play" && (
              <div className="grid gap-6 xl:grid-cols-3">
                <Card className="xl:col-span-3">
                  <CardHeader>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <CardTitle>Open Play Management</CardTitle>
                        <CardDescription>
                          Review applicants, verify payment proof, build
                          doubles teams, and advance the bracket through the
                          champion.
                        </CardDescription>
                        {openPlayChampion && (
                          <Badge variant="success">
                            Champion: {openPlayChampion}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={
                            !selectedOpenPlaySession ||
                            !hasOpenPlayRandomDoublesGroup
                          }
                          onClick={() =>
                            selectedOpenPlaySession &&
                            randomizeOpenPlayMatchmaking(
                              selectedOpenPlaySession.id,
                            )
                          }
                        >
                          <Users className="h-4 w-4" aria-hidden="true" />
                          Random Teams
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!selectedOpenPlaySession}
                          onClick={() =>
                            selectedOpenPlaySession &&
                            buildOpenPlayBracket(selectedOpenPlaySession.id)
                          }
                        >
                          <Trophy className="h-4 w-4" aria-hidden="true" />
                          Advance Bracket
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form
                      className="rounded-lg border border-lime-200 bg-lime-50/60 p-4"
                      onSubmit={handleCreateSession}
                    >
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <Field className="md:col-span-2">
                          <Label htmlFor="new-session">Session Title</Label>
                          <Input
                            id="new-session"
                            value={newSessionTitle}
                            onChange={(event) =>
                              setNewSessionTitle(event.target.value)
                            }
                          />
                        </Field>
                        <Field className="md:col-span-2">
                          <Label>Courts</Label>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {managedCourts
                              .filter((court) => court.enabled)
                              .map((court) => {
                                const checked = newSessionCourtIds.includes(
                                  court.id,
                                );

                                return (
                                  <label
                                    className={cn(
                                      "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border bg-white px-3 py-2 text-sm font-semibold transition-colors",
                                      checked
                                        ? "border-lime-500 text-lime-900 ring-2 ring-lime-100"
                                        : "border-stone-300 text-stone-700 hover:bg-stone-50",
                                    )}
                                    key={court.id}
                                  >
                                    <input
                                      className="h-4 w-4 accent-lime-500"
                                      type="checkbox"
                                      checked={checked}
                                      disabled={
                                        checked &&
                                        newSessionCourtIds.length === 1
                                      }
                                      onChange={() =>
                                        toggleNewSessionCourt(court.id)
                                      }
                                    />
                                    <span>{court.name}</span>
                                  </label>
                                );
                              })}
                          </div>
                        </Field>
                        <Field className="md:col-span-2">
                          <Label>Skill Level</Label>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {OPEN_PLAY_SKILL_OPTIONS.map((skillLevel) => {
                              const checked =
                                newSessionSkillLevels.includes(skillLevel);

                              return (
                                <label
                                  className={cn(
                                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border bg-white px-3 py-2 text-sm font-semibold transition-colors",
                                    checked
                                      ? "border-lime-500 text-lime-900 ring-2 ring-lime-100"
                                      : "border-stone-300 text-stone-700 hover:bg-stone-50",
                                  )}
                                  key={skillLevel}
                                >
                                  <input
                                    className="h-4 w-4 accent-lime-500"
                                    type="checkbox"
                                    checked={checked}
                                    disabled={
                                      checked &&
                                      newSessionSkillLevels.length === 1
                                    }
                                    onChange={() =>
                                      toggleNewSessionSkillLevel(skillLevel)
                                    }
                                  />
                                  <span>{skillLevel}</span>
                                </label>
                              );
                            })}
                          </div>
                        </Field>
                        <Field className="md:col-span-2">
                          <Label>Doubles Format</Label>
                          <div className="grid gap-2 sm:grid-cols-3">
                            {OPEN_PLAY_FORMAT_OPTIONS.map((format) => {
                              const checked =
                                newSessionFormats.includes(format);

                              return (
                                <label
                                  className={cn(
                                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border bg-white px-3 py-2 text-sm font-semibold transition-colors",
                                    checked
                                      ? "border-lime-500 text-lime-900 ring-2 ring-lime-100"
                                      : "border-stone-300 text-stone-700 hover:bg-stone-50",
                                  )}
                                  key={format}
                                >
                                  <input
                                    className="h-4 w-4 accent-lime-500"
                                    type="checkbox"
                                    checked={checked}
                                    disabled={
                                      checked && newSessionFormats.length === 1
                                    }
                                    onChange={() =>
                                      toggleNewSessionFormat(format)
                                    }
                                  />
                                  <span>{format}</span>
                                </label>
                              );
                            })}
                          </div>
                        </Field>
                        <Field>
                          <Label htmlFor="new-session-date">Date</Label>
                          <Input
                            id="new-session-date"
                            min={today}
                            type="date"
                            value={newSessionDate}
                            onChange={(event) =>
                              setNewSessionDate(event.target.value)
                            }
                          />
                        </Field>
                        <Field>
                          <Label htmlFor="new-session-start">Start Time</Label>
                          <Input
                            id="new-session-start"
                            type="time"
                            value={newSessionStart}
                            onChange={(event) =>
                              setNewSessionStart(event.target.value)
                            }
                          />
                        </Field>
                        <Field>
                          <Label htmlFor="new-session-hours">
                            Duration Hours
                          </Label>
                          <Input
                            id="new-session-hours"
                            min={1}
                            type="number"
                            value={newSessionHours}
                            onChange={(event) =>
                              setNewSessionHours(Number(event.target.value))
                            }
                          />
                        </Field>
                        <Field>
                          <Label htmlFor="new-session-max">Max Players</Label>
                          <Input
                            id="new-session-max"
                            min={2}
                            type="number"
                            value={newSessionMaxPlayers}
                            onChange={(event) =>
                              setNewSessionMaxPlayers(
                                Number(event.target.value),
                              )
                            }
                          />
                        </Field>
                        <Field>
                          <Label htmlFor="new-session-fee">Fee</Label>
                          <Input
                            id="new-session-fee"
                            min={0}
                            type="number"
                            value={newSessionFee}
                            onChange={(event) =>
                              setNewSessionFee(Number(event.target.value))
                            }
                          />
                        </Field>
                        <div className="flex items-end">
                          <Button className="w-full" type="submit">
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Create Open Play
                          </Button>
                        </div>
                      </div>
                    </form>

                    <div className="grid gap-3 lg:grid-cols-3">
                      {managedSessions.length === 0 ? (
                        <div className="col-span-full rounded-lg border border-dashed border-stone-300 p-4 text-center text-sm text-stone-500">
                          No open play sessions available. Create one using the
                          form above.
                        </div>
                      ) : (
                        managedSessions.map((session) => (
                          <div
                            className="rounded-lg border border-stone-200 bg-white p-3 text-sm"
                            key={session.id}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-stone-950">
                                  {session.title}
                                </p>
                                <p className="text-stone-600">
                                  {formatSessionCourts(session)} ·{" "}
                                  {session.date}
                                </p>
                                <p className="mt-1 text-stone-600">
                                  {session.startTime} - {session.endTime} ·{" "}
                                  {formatSessionSkillLevels(session)} ·{" "}
                                  {formatSessionFormats(session)} ·{" "}
                                  {formatCurrency(session.fee)}
                                </p>
                              </div>
                              <Badge variant={statusVariant(session.status)}>
                                {session.status}
                              </Badge>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3">
                              <span>
                                {session.joinedPlayers}/{session.maxPlayers}{" "}
                                players
                              </span>
                              <Button
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  handleDeleteOpenPlaySession(session)
                                }
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                      {selectedOpenPlaySession ? (
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                          <div className="grid gap-4 md:grid-cols-2">
                            <Field>
                              <Label htmlFor="open-play-session">
                                Session to Manage
                              </Label>
                              <Select
                                id="open-play-session"
                                value={selectedOpenPlaySession.id}
                                onChange={(event) =>
                                  setSelectedOpenPlaySessionId(
                                    event.target.value,
                                  )
                                }
                              >
                                {managedSessions.map((session) => (
                                  <option key={session.id} value={session.id}>
                                    {session.title} · {session.date}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <div className="rounded-lg border border-stone-200 bg-white p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-stone-950">
                                    {selectedOpenPlaySession.title}
                                  </p>
                                  <p className="mt-1 text-sm text-stone-600">
                                    {formatSessionCourts(
                                      selectedOpenPlaySession,
                                    )}{" "}
                                    · {selectedOpenPlaySession.date} ·{" "}
                                    {formatTimeRange12Hour(
                                      selectedOpenPlaySession.startTime,
                                      selectedOpenPlaySession.endTime,
                                    )}
                                  </p>
                                </div>
                                <Badge
                                  variant={statusVariant(
                                    selectedOpenPlaySession.status,
                                  )}
                                >
                                  {selectedOpenPlaySession.status}
                                </Badge>
                              </div>
                              <div className="mt-3">
                                <ProgressBar
                                  value={
                                    (selectedApprovedOpenPlayApplicants.length /
                                      selectedOpenPlaySession.maxPlayers) *
                                    100
                                  }
                                />
                                <p className="mt-2 text-sm font-medium text-stone-600">
                                  {selectedApprovedOpenPlayApplicants.length}/
                                  {selectedOpenPlaySession.maxPlayers} verified
                                  players
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <StatTile
                              accent="bg-lime-50 text-lime-800"
                              icon={Users}
                              label="Applicants"
                              value={selectedOpenPlayApplicants.length.toString()}
                            />
                            <StatTile
                              accent="bg-emerald-50 text-emerald-800"
                              icon={CheckCircle2}
                              label="Verified"
                              value={selectedApprovedOpenPlayApplicants.length.toString()}
                            />
                            <StatTile
                              accent="bg-amber-50 text-amber-800"
                              icon={Clock}
                              label="Pending Pay"
                              value={selectedOpenPlayApplicants
                                .filter(
                                  (applicant) =>
                                    applicant.paymentStatus !== "Verified",
                                )
                                .length.toString()}
                            />
                            <StatTile
                              accent="bg-sky-50 text-sky-800"
                              icon={Trophy}
                              label="Matches"
                              value={selectedOpenPlayMatches.length.toString()}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-center text-sm text-stone-500">
                          No open play session selected or available. Create a
                          new session above to get started.
                        </p>
                      )}
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="font-semibold text-stone-950">
                            Applied Players and Payment Proof
                          </h3>
                          <Badge variant="warning">Manual verification</Badge>
                        </div>
                        {selectedOpenPlayApplicants.length === 0 ? (
                          <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-600">
                            No applicants for this session yet.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {selectedOpenPlayApplicants.map((applicant) => {
                              const receiptSrc = getReceiptSrc(
                                applicant.receiptName,
                                applicant.receiptUrl,
                              );
                              const receiptLabel =
                                applicant.receiptName.split("/").pop() ||
                                "Payment proof";

                              return (
                                <div
                                  className="rounded-lg border border-stone-200 bg-white p-4"
                                  key={applicant.id}
                                >
                                <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-semibold text-stone-950">
                                        {applicant.playerName}
                                      </p>
                                      <Badge variant="info">
                                        {applicant.skillLevel}
                                      </Badge>
                                      <Badge
                                        variant={statusVariant(
                                          applicant.status,
                                        )}
                                      >
                                        {applicant.status}
                                      </Badge>
                                    </div>
                                    <p className="mt-2 text-sm text-stone-600">
                                      {applicant.paymentMethod} ·{" "}
                                      {formatCurrency(applicant.amount)} ·{" "}
                                      {applicant.paymentReference}
                                    </p>
                                  </div>

                                  <div className="text-sm text-stone-600">
                                    <Badge
                                      variant={statusVariant(
                                        applicant.paymentStatus,
                                      )}
                                    >
                                      {applicant.paymentStatus}
                                    </Badge>
                                    {receiptSrc ? (
                                      <button
                                        type="button"
                                        className="mt-2 block max-w-48 truncate text-left font-medium text-lime-800 underline hover:text-lime-900"
                                        title={receiptLabel}
                                        onClick={() =>
                                          setViewingReceipt({
                                            player: applicant.playerName,
                                            src: receiptSrc,
                                            title: `Open Play Payment Proof - ${applicant.playerName}`,
                                          })
                                        }
                                      >
                                        {receiptLabel}
                                      </button>
                                    ) : (
                                      <p className="mt-2 font-medium text-stone-800">
                                        No proof uploaded
                                      </p>
                                    )}
                                    <p>Uploaded payment proof</p>
                                  </div>

                                  <div className="flex flex-wrap gap-2 lg:justify-end">
                                    <Button
                                      size="sm"
                                      type="button"
                                      onClick={() => {
                                        void verifyOpenPlayPayment(applicant);
                                      }}
                                      disabled={
                                        applicant.paymentStatus === "Verified"
                                      }
                                    >
                                      Accept
                                    </Button>
                                    <Button
                                      size="sm"
                                      type="button"
                                      variant="destructive"
                                      onClick={() => {
                                        void rejectOpenPlayPayment(applicant);
                                      }}
                                      disabled={
                                        applicant.paymentStatus === "Rejected"
                                      }
                                    >
                                      Reject
                                    </Button>
                                    <Button
                                      size="sm"
                                      type="button"
                                      variant="outline"
                                      onClick={() => {
                                        void removeOpenPlayApplicant(applicant);
                                      }}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <form
                          className="rounded-lg border border-stone-200 bg-white p-4"
                          onSubmit={handleCreateManualOpenPlayPairing}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="font-semibold text-stone-950">
                              Manual Open-Play Doubles Match
                            </h3>
                            <Badge variant="info">
                              {selectedApprovedOpenPlayApplicants.length} ready
                            </Badge>
                          </div>
                          <div className="mt-4 grid gap-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field>
                                <Label htmlFor="open-play-team-one-first">
                                  Team 1 Partner A
                                </Label>
                                <Select
                                  id="open-play-team-one-first"
                                  value={manualOpenPlayTeamOneFirst}
                                  onChange={(event) =>
                                    setManualOpenPlayTeamOneFirst(
                                      event.target.value,
                                    )
                                  }
                                >
                                  <option value="">Choose player</option>
                                  {selectedApprovedOpenPlayApplicants.map(
                                    (applicant) => (
                                      <option
                                        key={`op-t1a-${applicant.id}`}
                                        disabled={isPlayerPickedInOtherSlot(
                                          applicant.playerName,
                                          manualOpenPlayTeamOneFirst,
                                          manualOpenPlayTeamSelections,
                                        )}
                                        value={applicant.playerName}
                                      >
                                        {applicant.playerName}
                                      </option>
                                    ),
                                  )}
                                </Select>
                              </Field>
                              <Field>
                                <Label htmlFor="open-play-team-one-second">
                                  Team 1 Partner B
                                </Label>
                                <Select
                                  id="open-play-team-one-second"
                                  value={manualOpenPlayTeamOneSecond}
                                  onChange={(event) =>
                                    setManualOpenPlayTeamOneSecond(
                                      event.target.value,
                                    )
                                  }
                                >
                                  <option value="">Choose player</option>
                                  {selectedApprovedOpenPlayApplicants.map(
                                    (applicant) => (
                                      <option
                                        key={`op-t1b-${applicant.id}`}
                                        disabled={isPlayerPickedInOtherSlot(
                                          applicant.playerName,
                                          manualOpenPlayTeamOneSecond,
                                          manualOpenPlayTeamSelections,
                                        )}
                                        value={applicant.playerName}
                                      >
                                        {applicant.playerName}
                                      </option>
                                    ),
                                  )}
                                </Select>
                              </Field>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field>
                                <Label htmlFor="open-play-team-two-first">
                                  Team 2 Partner A
                                </Label>
                                <Select
                                  id="open-play-team-two-first"
                                  value={manualOpenPlayTeamTwoFirst}
                                  onChange={(event) =>
                                    setManualOpenPlayTeamTwoFirst(
                                      event.target.value,
                                    )
                                  }
                                >
                                  <option value="">Choose player</option>
                                  {selectedApprovedOpenPlayApplicants.map(
                                    (applicant) => (
                                      <option
                                        key={`op-t2a-${applicant.id}`}
                                        disabled={isPlayerPickedInOtherSlot(
                                          applicant.playerName,
                                          manualOpenPlayTeamTwoFirst,
                                          manualOpenPlayTeamSelections,
                                        )}
                                        value={applicant.playerName}
                                      >
                                        {applicant.playerName}
                                      </option>
                                    ),
                                  )}
                                </Select>
                              </Field>
                              <Field>
                                <Label htmlFor="open-play-team-two-second">
                                  Team 2 Partner B
                                </Label>
                                <Select
                                  id="open-play-team-two-second"
                                  value={manualOpenPlayTeamTwoSecond}
                                  onChange={(event) =>
                                    setManualOpenPlayTeamTwoSecond(
                                      event.target.value,
                                    )
                                  }
                                >
                                  <option value="">Choose player</option>
                                  {selectedApprovedOpenPlayApplicants.map(
                                    (applicant) => (
                                      <option
                                        key={`op-t2b-${applicant.id}`}
                                        disabled={isPlayerPickedInOtherSlot(
                                          applicant.playerName,
                                          manualOpenPlayTeamTwoSecond,
                                          manualOpenPlayTeamSelections,
                                        )}
                                        value={applicant.playerName}
                                      >
                                        {applicant.playerName}
                                      </option>
                                    ),
                                  )}
                                </Select>
                              </Field>
                            </div>
                            <div className="flex justify-end">
                              <Button
                                type="submit"
                                variant="outline"
                                disabled={
                                  manualOpenPlayTeamSelections.some(
                                    (player) => !player,
                                  ) ||
                                  new Set(manualOpenPlayTeamSelections).size !==
                                    4
                                }
                              >
                                Create Doubles Match
                              </Button>
                            </div>
                          </div>
                        </form>

                        <div className="rounded-lg border border-stone-200 bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="font-semibold text-stone-950">
                              Open-Play Doubles Matches
                            </h3>
                            <Badge variant="default">
                              Beginner · Novice · Intermediate · Advanced
                            </Badge>
                          </div>
                          <div className="mt-4 space-y-3">
                            {selectedOpenPlayMatches.length === 0 ? (
                              <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-600">
                                Randomize doubles teams after accepting player
                                payments.
                              </p>
                            ) : (
                              selectedOpenPlayMatches.map((match) => (
                                <div
                                  className="rounded-lg border border-stone-200 bg-stone-50 p-3"
                                  key={match.id}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge
                                        variant={
                                          match.round === "Finals"
                                            ? "success"
                                            : "neutral"
                                        }
                                      >
                                        {match.round}
                                      </Badge>
                                      <Badge variant="info">
                                        {match.skillLevel}
                                      </Badge>
                                    </div>
                                    {match.winner && (
                                      <Badge variant="success">
                                        Winner: {match.winner}
                                      </Badge>
                                    )}
                                  </div>
                                  <DoublesTeamBoard
                                    teamOne={match.playerOne}
                                    teamTwo={match.playerTwo}
                                  />
                                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                                    <Input
                                      aria-label={`Score for ${match.playerOne} versus ${match.playerTwo}`}
                                      placeholder="Score, e.g. 11-8"
                                      value={match.score}
                                      onChange={(event) =>
                                        updateOpenPlayMatch(match.id, {
                                          score: event.target.value,
                                        })
                                      }
                                    />
                                    <Button
                                      size="sm"
                                      type="button"
                                      variant="outline"
                                      onClick={() =>
                                        updateOpenPlayMatch(match.id, {
                                          winner: match.playerOne,
                                        })
                                      }
                                    >
                                      Team 1 Wins
                                    </Button>
                                    <Button
                                      size="sm"
                                      type="button"
                                      variant="outline"
                                      disabled={match.playerTwo === "Bye"}
                                      onClick={() =>
                                        updateOpenPlayMatch(match.id, {
                                          winner: match.playerTwo,
                                        })
                                      }
                                    >
                                      Team 2 Wins
                                    </Button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="rounded-lg border border-stone-200 bg-white p-4">
                          <h3 className="font-semibold text-stone-950">
                            Elimination to Finals Tree
                          </h3>
                          {openPlayChampion && (
                            <div className="mt-3 rounded-lg border border-lime-200 bg-lime-50 p-3 text-sm font-bold text-lime-900">
                              Champion: {openPlayChampion}
                            </div>
                          )}
                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            {COMPETITION_ROUNDS.map((round) => {
                              const roundMatches =
                                selectedOpenPlayMatches.filter(
                                  (match) => match.round === round,
                                );

                              return (
                                <div className="space-y-3" key={round}>
                                  <p className="text-sm font-bold text-stone-700">
                                    {round}
                                  </p>
                                  {roundMatches.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-stone-300 p-3 text-sm text-stone-500">
                                      Not set
                                    </div>
                                  ) : (
                                    roundMatches.map((match) => (
                                      <div
                                        className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm"
                                        key={`${round}-${match.id}`}
                                      >
                                        <DoublesTeamBoard
                                          compact
                                          teamOne={match.playerOne}
                                          teamTwo={match.playerTwo}
                                        />
                                        <p className="mt-2 text-stone-600">
                                          {match.score || "Score pending"}
                                        </p>
                                        {match.winner && (
                                          <p className="mt-1 font-semibold text-lime-800">
                                            {match.winner} advances
                                          </p>
                                        )}
                                      </div>
                                    ))
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tournaments</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form
                      className="grid gap-3"
                      onSubmit={handleCreateTournament}
                    >
                      <Field>
                        <Label htmlFor="new-tournament">Tournament Name</Label>
                        <Input
                          id="new-tournament"
                          value={newTournamentName}
                          onChange={(event) =>
                            setNewTournamentName(event.target.value)
                          }
                        />
                      </Field>
                      <Button type="submit">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Create Tournament
                      </Button>
                    </form>
                    {managedTournaments.length === 0 ? (
                      <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-600 text-center">
                        No tournaments created yet.
                      </p>
                    ) : (
                      managedTournaments.map((tournament) => (
                        <div
                          className="rounded-lg border border-stone-200 bg-white p-3 text-sm"
                          key={tournament.id}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-stone-950">
                                {tournament.name}
                              </p>
                              <p className="text-stone-600">
                                {tournament.category} · {tournament.division}
                              </p>
                            </div>
                            <Badge variant={statusVariant(tournament.status)}>
                              {tournament.status}
                            </Badge>
                          </div>
                          <p className="mt-3 text-stone-600">
                            {Math.max(
                              tournament.participants,
                              tournamentRegistrations.filter(
                                (participant) =>
                                  participant.tournamentId === tournament.id &&
                                  participant.status !== "Rejected",
                              ).length,
                            )}
                            /
                            {tournament.participantLimit} participants
                          </p>
                          <ul className="mt-3 space-y-2">
                            {tournament.matches.slice(0, 2).map((match) => (
                              <li
                                className="rounded-md bg-stone-50 p-2 text-stone-700"
                                key={match}
                              >
                                {match}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    )}

                    {selectedTournament && (
                      <div className="space-y-4 border-t border-stone-200 pt-4">
                        <Field>
                          <Label htmlFor="admin-tournament-select">
                            Tournament to Manage
                          </Label>
                          <Select
                            id="admin-tournament-select"
                            value={selectedTournament.id}
                            onChange={(event) =>
                              setSelectedTournamentId(event.target.value)
                            }
                          >
                            {managedTournaments.map((tournament) => (
                              <option
                                key={tournament.id}
                                value={tournament.id}
                              >
                                {tournament.name} · {tournament.date}
                              </option>
                            ))}
                          </Select>
                        </Field>

                        <div className="rounded-lg border border-stone-200 bg-white p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-stone-950">
                                {selectedTournament.name}
                              </p>
                              <p className="text-sm text-stone-600">
                                {selectedTournament.category} ·{" "}
                                {selectedTournament.division} ·{" "}
                                {formatCurrency(selectedTournament.fee)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge
                                variant={statusVariant(
                                  selectedTournament.status,
                                )}
                              >
                                {selectedTournament.status}
                              </Badge>
                              {selectedTournamentChampion && (
                                <Badge variant="success">
                                  Champion: {selectedTournamentChampion}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="mt-3 text-sm text-stone-600">
                            {Math.max(
                              selectedTournament.participants,
                              selectedTournamentRegistrations.filter(
                                (participant) =>
                                  participant.status !== "Rejected",
                              ).length,
                            )}
                            /{selectedTournament.participantLimit} registered
                          </p>
                        </div>

                        <div className="rounded-lg border border-stone-200 bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="font-semibold text-stone-950">
                              Registered Players
                            </h3>
                            <Badge variant="info">
                              {selectedApprovedTournamentRegistrations.length}{" "}
                              approved
                            </Badge>
                          </div>
                          <div className="mt-3 space-y-2">
                            {selectedTournamentRegistrations.length === 0 ? (
                              <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-600">
                                No registered players yet.
                              </p>
                            ) : (
                              selectedTournamentRegistrations.map(
                                (participant) => (
                                  <div
                                    className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm sm:grid-cols-[1fr_auto]"
                                    key={participant.id}
                                  >
                                    <div>
                                      <p className="font-semibold text-stone-950">
                                        {participant.playerName}
                                      </p>
                                      <p className="text-xs text-stone-500">
                                        {participant.playerUsername
                                          ? `@${participant.playerUsername}`
                                          : "No username"}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                      <Badge
                                        variant={statusVariant(
                                          participant.status,
                                        )}
                                      >
                                        {participant.status}
                                      </Badge>
                                      <Button
                                        size="sm"
                                        type="button"
                                        onClick={() =>
                                          updateTournamentParticipant(
                                            participant.id,
                                            { status: "Approved" },
                                          )
                                        }
                                        disabled={
                                          participant.status === "Approved"
                                        }
                                      >
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        type="button"
                                        variant="destructive"
                                        onClick={() =>
                                          updateTournamentParticipant(
                                            participant.id,
                                            { status: "Rejected" },
                                          )
                                        }
                                        disabled={
                                          participant.status === "Rejected"
                                        }
                                      >
                                        Reject
                                      </Button>
                                      <Button
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                          removeTournamentParticipant(
                                            participant,
                                          )
                                        }
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  </div>
                                ),
                              )
                            )}
                          </div>
                        </div>

                        <form
                          className="rounded-lg border border-stone-200 bg-white p-4"
                          onSubmit={handleCreateManualTournamentPairing}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="font-semibold text-stone-950">
                              Tournament Doubles Pairing
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                disabled={
                                  selectedApprovedTournamentRegistrations.length <
                                  4
                                }
                                onClick={() =>
                                  randomizeTournamentPairings(
                                    selectedTournament.id,
                                  )
                                }
                              >
                                <Users
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                Random Teams
                              </Button>
                              <Button
                                type="button"
                                disabled={selectedTournamentMatches.length === 0}
                                onClick={() =>
                                  buildTournamentBracket(selectedTournament.id)
                                }
                              >
                                <Trophy
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                Advance Bracket
                              </Button>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field>
                                <Label htmlFor="tournament-team-one-first">
                                  Team 1 Partner A
                                </Label>
                                <Select
                                  id="tournament-team-one-first"
                                  value={manualTournamentTeamOneFirst}
                                  onChange={(event) =>
                                    setManualTournamentTeamOneFirst(
                                      event.target.value,
                                    )
                                  }
                                >
                                  <option value="">Choose player</option>
                                  {selectedApprovedTournamentRegistrations.map(
                                    (participant) => (
                                      <option
                                        key={`tp-t1a-${participant.id}`}
                                        disabled={isPlayerPickedInOtherSlot(
                                          participant.playerName,
                                          manualTournamentTeamOneFirst,
                                          manualTournamentTeamSelections,
                                        )}
                                        value={participant.playerName}
                                      >
                                        {participant.playerName}
                                      </option>
                                    ),
                                  )}
                                </Select>
                              </Field>
                              <Field>
                                <Label htmlFor="tournament-team-one-second">
                                  Team 1 Partner B
                                </Label>
                                <Select
                                  id="tournament-team-one-second"
                                  value={manualTournamentTeamOneSecond}
                                  onChange={(event) =>
                                    setManualTournamentTeamOneSecond(
                                      event.target.value,
                                    )
                                  }
                                >
                                  <option value="">Choose player</option>
                                  {selectedApprovedTournamentRegistrations.map(
                                    (participant) => (
                                      <option
                                        key={`tp-t1b-${participant.id}`}
                                        disabled={isPlayerPickedInOtherSlot(
                                          participant.playerName,
                                          manualTournamentTeamOneSecond,
                                          manualTournamentTeamSelections,
                                        )}
                                        value={participant.playerName}
                                      >
                                        {participant.playerName}
                                      </option>
                                    ),
                                  )}
                                </Select>
                              </Field>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field>
                                <Label htmlFor="tournament-team-two-first">
                                  Team 2 Partner A
                                </Label>
                                <Select
                                  id="tournament-team-two-first"
                                  value={manualTournamentTeamTwoFirst}
                                  onChange={(event) =>
                                    setManualTournamentTeamTwoFirst(
                                      event.target.value,
                                    )
                                  }
                                >
                                  <option value="">Choose player</option>
                                  {selectedApprovedTournamentRegistrations.map(
                                    (participant) => (
                                      <option
                                        key={`tp-t2a-${participant.id}`}
                                        disabled={isPlayerPickedInOtherSlot(
                                          participant.playerName,
                                          manualTournamentTeamTwoFirst,
                                          manualTournamentTeamSelections,
                                        )}
                                        value={participant.playerName}
                                      >
                                        {participant.playerName}
                                      </option>
                                    ),
                                  )}
                                </Select>
                              </Field>
                              <Field>
                                <Label htmlFor="tournament-team-two-second">
                                  Team 2 Partner B
                                </Label>
                                <Select
                                  id="tournament-team-two-second"
                                  value={manualTournamentTeamTwoSecond}
                                  onChange={(event) =>
                                    setManualTournamentTeamTwoSecond(
                                      event.target.value,
                                    )
                                  }
                                >
                                  <option value="">Choose player</option>
                                  {selectedApprovedTournamentRegistrations.map(
                                    (participant) => (
                                      <option
                                        key={`tp-t2b-${participant.id}`}
                                        disabled={isPlayerPickedInOtherSlot(
                                          participant.playerName,
                                          manualTournamentTeamTwoSecond,
                                          manualTournamentTeamSelections,
                                        )}
                                        value={participant.playerName}
                                      >
                                        {participant.playerName}
                                      </option>
                                    ),
                                  )}
                                </Select>
                              </Field>
                            </div>
                            <div className="flex justify-end">
                              <Button
                                type="submit"
                                variant="outline"
                                disabled={
                                  manualTournamentTeamSelections.some(
                                    (player) => !player,
                                  ) ||
                                  new Set(manualTournamentTeamSelections)
                                    .size !== 4
                                }
                              >
                                Create Doubles Match
                              </Button>
                            </div>
                          </div>
                        </form>

                        <div className="rounded-lg border border-stone-200 bg-white p-4">
                          <h3 className="font-semibold text-stone-950">
                            Tournament Matches
                          </h3>
                          <div className="mt-4 space-y-3">
                            {selectedTournamentMatches.length === 0 ? (
                              <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-600">
                                Create doubles teams to begin.
                              </p>
                            ) : (
                              selectedTournamentMatches.map((match) => (
                                <div
                                  className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm"
                                  key={match.id}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <Badge
                                      variant={
                                        match.round === "Finals"
                                          ? "success"
                                          : "neutral"
                                      }
                                    >
                                      {match.round}
                                    </Badge>
                                    {match.winner && (
                                      <Badge variant="success">
                                        Winner: {match.winner}
                                      </Badge>
                                    )}
                                  </div>
                                  <DoublesTeamBoard
                                    teamOne={match.playerOne}
                                    teamTwo={match.playerTwo}
                                  />
                                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                                    <Input
                                      aria-label={`Score for ${match.playerOne} versus ${match.playerTwo}`}
                                      placeholder="Score, e.g. 11-8"
                                      value={match.score}
                                      onChange={(event) =>
                                        updateTournamentMatch(match.id, {
                                          score: event.target.value,
                                        })
                                      }
                                    />
                                    <Button
                                      size="sm"
                                      type="button"
                                      variant="outline"
                                      onClick={() =>
                                        updateTournamentMatch(match.id, {
                                          winner: match.playerOne,
                                        })
                                      }
                                    >
                                      Team 1 Wins
                                    </Button>
                                    <Button
                                      size="sm"
                                      type="button"
                                      variant="outline"
                                      disabled={match.playerTwo === "Bye"}
                                      onClick={() =>
                                        updateTournamentMatch(match.id, {
                                          winner: match.playerTwo,
                                        })
                                      }
                                    >
                                      Team 2 Wins
                                    </Button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="rounded-lg border border-stone-200 bg-white p-4">
                          <h3 className="font-semibold text-stone-950">
                            Tournament Tree
                          </h3>
                          {selectedTournamentChampion && (
                            <div className="mt-3 rounded-lg border border-lime-200 bg-lime-50 p-3 text-sm font-bold text-lime-900">
                              Champion: {selectedTournamentChampion}
                            </div>
                          )}
                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            {COMPETITION_ROUNDS.map((round) => {
                              const roundMatches =
                                selectedTournamentMatches.filter(
                                  (match) => match.round === round,
                                );

                              return (
                                <div className="space-y-3" key={round}>
                                  <p className="text-sm font-bold text-stone-700">
                                    {round}
                                  </p>
                                  {roundMatches.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-stone-300 p-3 text-sm text-stone-500">
                                      Not set
                                    </div>
                                  ) : (
                                    roundMatches.map((match) => (
                                      <div
                                        className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm"
                                        key={`${round}-${match.id}`}
                                      >
                                        <DoublesTeamBoard
                                          compact
                                          teamOne={match.playerOne}
                                          teamTwo={match.playerTwo}
                                        />
                                        <p className="mt-2 text-stone-600">
                                          {match.score || "Score pending"}
                                        </p>
                                        {match.winner && (
                                          <p className="mt-1 font-semibold text-lime-800">
                                            {match.winner} advances
                                          </p>
                                        )}
                                      </div>
                                    ))
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Events</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form className="grid gap-3" onSubmit={handleCreateEvent}>
                      <Field>
                        <Label htmlFor="new-event">Event Name</Label>
                        <Input
                          id="new-event"
                          value={newEventName}
                          onChange={(event) =>
                            setNewEventName(event.target.value)
                          }
                        />
                      </Field>
                      <Button type="submit">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Create Event
                      </Button>
                    </form>
                    {managedEvents.length === 0 ? (
                      <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-600 text-center">
                        No events created yet.
                      </p>
                    ) : (
                      managedEvents.map((eventItem) => (
                        <div
                          className="rounded-lg border border-stone-200 bg-white p-3 text-sm"
                          key={eventItem.id}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-stone-950">
                                {eventItem.name}
                              </p>
                              <p className="text-stone-600">
                                {eventItem.dateTime}
                              </p>
                            </div>
                            <Badge variant={statusVariant(eventItem.status)}>
                              {eventItem.status}
                            </Badge>
                          </div>
                          <p className="mt-3 text-stone-600">
                            {eventItem.attendees}/{eventItem.maxAttendees}{" "}
                            attendees
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {adminTab === "reports" && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatTile
                  accent="bg-lime-50 text-lime-800"
                  icon={CalendarCheck}
                  label="Total Bookings"
                  value={bookings.length.toString()}
                />
                <StatTile
                  accent="bg-amber-50 text-amber-800"
                  icon={Clock}
                  label="Pending Bookings"
                  value={pendingBookings.length.toString()}
                />
                <StatTile
                  accent="bg-emerald-50 text-emerald-800"
                  icon={CheckCircle2}
                  label="Approved Bookings"
                  value={bookings
                    .filter((booking) => booking.status === "Approved")
                    .length.toString()}
                />
                <StatTile
                  accent="bg-sky-50 text-sky-800"
                  icon={CalendarClock}
                  label="Today"
                  value={todayBookings.length.toString()}
                />
                <StatTile
                  accent="bg-rose-50 text-rose-700"
                  icon={Banknote}
                  label="Verified Payments"
                  value={formatCurrency(
                    verifiedPayments.reduce(
                      (total, booking) => total + booking.amount,
                      0,
                    ),
                  )}
                />
                <StatTile
                  accent="bg-stone-100 text-stone-800"
                  icon={Users}
                  label="Program Participants"
                  value={(
                    openPlayParticipants + tournamentParticipants
                  ).toString()}
                />
              </div>
            )}

            {adminTab === "settings" && (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <Card>
                  <CardHeader>
                    <CardTitle>Payment Settings</CardTitle>
                    <CardDescription>
                      Shown to players during checkout.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <Field>
                      <Label htmlFor="gcash">GCash Number</Label>
                      <Input
                        id="gcash"
                        value={paymentInfo.gcashNumber}
                        onChange={(event) =>
                          setPaymentInfo((info) => ({
                            ...info,
                            gcashNumber: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field>
                      <Label htmlFor="bank">Bank Name</Label>
                      <Input
                        id="bank"
                        value={paymentInfo.bankName}
                        onChange={(event) =>
                          setPaymentInfo((info) => ({
                            ...info,
                            bankName: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field>
                      <Label htmlFor="account-name">Account Name</Label>
                      <Input
                        id="account-name"
                        value={paymentInfo.bankAccountName}
                        onChange={(event) =>
                          setPaymentInfo((info) => ({
                            ...info,
                            bankAccountName: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field>
                      <Label htmlFor="account-number">Account Number</Label>
                      <Input
                        id="account-number"
                        value={paymentInfo.bankAccountNumber}
                        onChange={(event) =>
                          setPaymentInfo((info) => ({
                            ...info,
                            bankAccountNumber: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Announcements</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form
                      className="space-y-3"
                      onSubmit={handleAnnouncementSubmit}
                    >
                      <Field>
                        <Label htmlFor="announcement">Post</Label>
                        <Textarea
                          id="announcement"
                          value={newAnnouncement}
                          onChange={(event) =>
                            setNewAnnouncement(event.target.value)
                          }
                        />
                      </Field>
                      <Button className="w-full" type="submit">
                        Post Announcement
                      </Button>
                    </form>
                    {announcementList.length === 0 ? (
                      <p className="text-sm text-stone-500">
                        No announcements posted yet.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {announcementList.slice(0, 4).map((announcement) => (
                          <li
                            className="rounded-lg bg-stone-50 p-3 text-sm text-stone-700"
                            key={announcement}
                          >
                            {announcement}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </section>
        )}
        {editingCourt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-stone-200 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-stone-950">
                    Edit Court — {editingCourt.name}
                  </h3>
                  <p className="text-xs text-stone-600">
                    Modify court properties, pricing, operating hours, active
                    status, or photo.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingCourt(null)}
                >
                  ✕
                </Button>
              </div>

              <form className="mt-4 space-y-4" onSubmit={handleSaveEditedCourt}>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field>
                    <Label htmlFor="edit-court-price">Day Rate (₱/hr)</Label>
                    <Input
                      id="edit-court-price"
                      type="number"
                      min={0}
                      value={editingCourt.pricePerHour}
                      onChange={(e) =>
                        setEditingCourt({
                          ...editingCourt,
                          pricePerHour: Number(e.target.value),
                        })
                      }
                      required
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="edit-court-night-price">
                      Night Rate (₱/hr)
                    </Label>
                    <Input
                      id="edit-court-night-price"
                      type="number"
                      min={0}
                      placeholder="e.g. 500"
                      value={editingCourt.nightPricePerHour ?? ""}
                      onChange={(e) =>
                        setEditingCourt({
                          ...editingCourt,
                          nightPricePerHour: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="edit-court-night-starts">
                      Night Starts At
                    </Label>
                    <Input
                      id="edit-court-night-starts"
                      type="time"
                      value={editingCourt.nightStartsAt || "17:00"}
                      onChange={(e) =>
                        setEditingCourt({
                          ...editingCourt,
                          nightStartsAt: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <Label htmlFor="edit-court-surface">Surface Type</Label>
                    <Input
                      id="edit-court-surface"
                      placeholder="e.g. Cushioned acrylic, Outdoor hard court"
                      value={editingCourt.surface}
                      onChange={(e) =>
                        setEditingCourt({
                          ...editingCourt,
                          surface: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="edit-court-zone">Zone / Location</Label>
                    <Input
                      id="edit-court-zone"
                      placeholder="e.g. Near entrance, Garden side"
                      value={editingCourt.zone}
                      onChange={(e) =>
                        setEditingCourt({
                          ...editingCourt,
                          zone: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <Label htmlFor="edit-court-open">Opening Time</Label>
                    <Input
                      id="edit-court-open"
                      type="time"
                      value={editingCourt.open}
                      onChange={(e) =>
                        setEditingCourt({
                          ...editingCourt,
                          open: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="edit-court-close">Closing Time</Label>
                    <Input
                      id="edit-court-close"
                      type="time"
                      value={editingCourt.close}
                      onChange={(e) =>
                        setEditingCourt({
                          ...editingCourt,
                          close: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <div>
                    <p className="text-sm font-bold text-stone-950">
                      Active Status
                    </p>
                    <p className="text-xs text-stone-500">
                      Disabled courts are hidden from player booking selections.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={editingCourt.enabled ? "default" : "outline"}
                    onClick={() =>
                      setEditingCourt({
                        ...editingCourt,
                        enabled: !editingCourt.enabled,
                      })
                    }
                  >
                    {editingCourt.enabled
                      ? "Enabled (Active)"
                      : "Disabled (Hidden)"}
                  </Button>
                </div>

                <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <Label className="text-sm font-bold text-stone-950">
                    Court Photo / Image
                  </Label>

                  {editingCourt.image ? (
                    <div className="relative h-44 w-full overflow-hidden rounded-lg border border-stone-300">
                      <Image
                        src={editingCourt.image}
                        alt={editingCourt.name}
                        fill
                        className="object-cover"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-2 rounded bg-black/80 px-2 py-1 text-xs font-semibold text-white shadow-xs hover:bg-black"
                        onClick={() =>
                          setEditingCourt({ ...editingCourt, image: undefined })
                        }
                      >
                        Remove Photo
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-32 w-full flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-white text-stone-400">
                      <FileImage className="h-8 w-8 mb-1 opacity-50" />
                      <p className="text-xs">No court image set</p>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field>
                      <Label className="text-xs" htmlFor="edit-upload-image">
                        Upload Photo File
                      </Label>
                      <Input
                        id="edit-upload-image"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              if (typeof evt.target?.result === "string") {
                                setEditingCourt({
                                  ...editingCourt,
                                  image: evt.target.result,
                                });
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </Field>
                    <Field>
                      <Label className="text-xs" htmlFor="edit-url-image">
                        Image URL
                      </Label>
                      <Input
                        id="edit-url-image"
                        placeholder="https://..."
                        value={editingCourt.image || ""}
                        onChange={(e) =>
                          setEditingCourt({
                            ...editingCourt,
                            image: e.target.value,
                          })
                        }
                      />
                    </Field>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-stone-600 mb-2">
                      Or Choose Preset Photo:
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {DEFAULT_COURT_IMAGES.map((preset) => (
                        <button
                          key={preset.url}
                          type="button"
                          className={cn(
                            "relative h-16 w-full overflow-hidden rounded-md border text-left transition-all",
                            editingCourt.image === preset.url
                              ? "border-lime-500 ring-2 ring-lime-400"
                              : "border-stone-200 hover:border-stone-400",
                          )}
                          onClick={() =>
                            setEditingCourt({
                              ...editingCourt,
                              image: preset.url,
                            })
                          }
                        >
                          <Image
                            src={preset.url}
                            alt={preset.label}
                            fill
                            className="object-cover"
                          />
                          <span className="absolute bottom-0 inset-x-0 bg-black/70 p-0.5 text-[9px] font-bold text-white text-center truncate">
                            {preset.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-200">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleDeleteCourt(editingCourt.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Court
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingCourt(null)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Save Changes</Button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {viewingReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-stone-950">
                    {viewingReceipt.title}
                  </h3>
                  <p className="text-xs text-stone-500">
                    Uploaded receipt / payment proof for manual verification.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingReceipt(null)}
                >
                  ✕
                </Button>
              </div>

              <div className="relative min-h-64 max-h-[60vh] w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100 flex items-center justify-center p-2">
                {isImageReceiptSource(viewingReceipt.src) ? (
                  <Image
                    src={viewingReceipt.src}
                    alt={viewingReceipt.title}
                    width={500}
                    height={500}
                    unoptimized
                    className="max-h-[55vh] w-auto object-contain rounded-lg shadow-xs"
                  />
                ) : (
                  <div className="flex min-h-56 flex-col items-center justify-center gap-2 text-center text-stone-600">
                    <FileImage
                      className="h-10 w-10 text-stone-400"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-bold text-stone-950">
                      Preview unavailable
                    </p>
                    <p className="max-w-xs text-xs">
                      Open the original file to review this payment proof.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <a
                  href={viewingReceipt.src}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                >
                  Open Original File ↗
                </a>
                <Button
                  type="button"
                  variant="default"
                  onClick={() => setViewingReceipt(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function BookingList({
  bookings,
  onCancel,
  title,
}: {
  bookings: Booking[];
  onCancel?: (id: string) => void;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {bookings.length === 0 ? (
          <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-600">
            No bookings found.
          </p>
        ) : (
          bookings.map((booking) => (
            <div
              className="rounded-lg border border-stone-200 bg-white p-4"
              key={booking.id}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-stone-950 text-base">
                      {booking.courtName}
                    </p>
                    <BookingStatusBadge status={booking.status} />
                    <Badge variant={statusVariant(booking.paymentStatus)}>
                      {booking.paymentStatus}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-stone-800">
                    Booked by {booking.player}
                  </p>
                  <p className="text-xs text-stone-600">
                    {booking.date} ·{" "}
                    {formatTimeRange12Hour(booking.startTime, booking.endTime)}
                  </p>
                  <p className="text-xs text-stone-600">
                    {formatCurrency(booking.amount)} · {booking.paymentMethod} ·
                    Ref: {booking.reference || "None"}
                  </p>
                  {booking.rejectionReason && (
                    <p className="text-xs font-semibold text-rose-700">
                      {booking.rejectionReason}
                    </p>
                  )}
                </div>
                {booking.status === "Pending" && onCancel && (
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => onCancel(booking.id)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AdminBookingRows({
  bookings,
  onApprove,
  onCancel,
  onComplete,
  onReject,
  onVerify,
  onViewReceipt,
}: {
  bookings: Booking[];
  onApprove: (booking: Booking) => void;
  onCancel: (booking: Booking) => void;
  onComplete: (booking: Booking) => void;
  onReject: (booking: Booking) => void;
  onVerify: (booking: Booking) => void;
  onViewReceipt?: (src: string, title: string, player: string) => void;
}) {
  if (bookings.length === 0) {
    return (
      <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-600">
        No matching bookings.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map((booking) => {
        const receiptSrc = getReceiptSrc(
          booking.receiptName,
          booking.receiptUrl,
        );
        const isImageReceipt = receiptSrc
          ? isImageReceiptSource(receiptSrc, booking.receiptName)
          : false;

        return (
          <div
            className="rounded-lg border border-stone-200 bg-white p-4 shadow-xs"
            key={booking.id}
          >
            <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr_1.4fr_auto] xl:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-extrabold text-stone-950">
                    {booking.player}
                  </p>
                  {booking.playerUsername && (
                    <span className="text-xs font-semibold text-lime-800">
                      (@{booking.playerUsername})
                    </span>
                  )}
                  <BookingStatusBadge status={booking.status} />
                </div>
                <p className="mt-1 text-sm font-bold text-stone-800">
                  {booking.courtName}
                </p>
                <p className="mt-0.5 text-xs text-stone-400 font-mono">
                  Ref: {booking.reference || "N/A"} · ID:{" "}
                  {booking.id.slice(0, 8)}
                </p>
              </div>

              <div className="text-sm text-stone-600">
                <p className="font-bold text-stone-900">{booking.date}</p>
                <p className="text-stone-700">
                  {formatTimeRange12Hour(booking.startTime, booking.endTime)} (
                  {booking.hours} hrs)
                </p>
                <p className="font-extrabold text-lime-800">
                  {formatCurrency(booking.amount)}
                </p>
              </div>

              {/* Uploaded Payment Proof Section */}
              <div className="flex items-center gap-3 text-sm text-stone-600">
                {receiptSrc && isImageReceipt ? (
                  <button
                    type="button"
                    className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-stone-300 bg-stone-100 transition-all hover:ring-2 hover:ring-lime-400 shadow-xs"
                    onClick={() =>
                      onViewReceipt?.(
                        receiptSrc,
                        `Payment Proof — ${booking.player}`,
                        booking.player,
                      )
                    }
                    title="Click to view full payment proof"
                  >
                    <Image
                      src={receiptSrc}
                      alt={`Payment proof for ${booking.player}`}
                      fill
                      unoptimized
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="text-[10px] font-extrabold text-white">
                        View
                      </span>
                    </div>
                  </button>
                ) : receiptSrc ? (
                  <button
                    type="button"
                    className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg border border-stone-300 bg-stone-50 text-stone-500 transition-colors hover:border-lime-400 hover:bg-lime-50"
                    onClick={() =>
                      onViewReceipt?.(
                        receiptSrc,
                        `Payment Proof - ${booking.player}`,
                        booking.player,
                      )
                    }
                    title="Open payment proof"
                  >
                    <FileImage className="h-5 w-5" aria-hidden="true" />
                    <span className="text-[9px] font-bold">Open</span>
                  </button>
                ) : (
                  <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 text-stone-400">
                    <FileImage className="h-5 w-5 opacity-40" />
                    <span className="text-[9px]">No proof</span>
                  </div>
                )}

                <div className="min-w-0">
                  <Badge variant={statusVariant(booking.paymentStatus)}>
                    {booking.paymentStatus}
                  </Badge>
                  <p className="mt-1 font-semibold text-stone-800">
                    {booking.paymentMethod}
                  </p>
                  {booking.receiptName ? (
                    <button
                      type="button"
                      className="block max-w-36 truncate text-left text-xs font-semibold text-lime-800 underline hover:text-lime-900"
                      title={booking.receiptName}
                      onClick={() =>
                        receiptSrc &&
                        onViewReceipt?.(
                          receiptSrc,
                          `Payment Proof — ${booking.player}`,
                          booking.player,
                        )
                      }
                    >
                      {booking.receiptName.split("/").pop()}
                    </button>
                  ) : (
                    <span className="text-xs italic text-stone-400">
                      No file uploaded
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  type="button"
                  onClick={() => onApprove(booking)}
                  disabled={booking.status !== "Pending"}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="destructive"
                  onClick={() => onReject(booking)}
                  disabled={booking.status !== "Pending"}
                >
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => onVerify(booking)}
                  disabled={booking.paymentStatus === "Verified"}
                >
                  Verify
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => onComplete(booking)}
                  disabled={booking.status !== "Approved"}
                >
                  Complete
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => onCancel(booking)}
                  disabled={["Cancelled", "Completed"].includes(booking.status)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
