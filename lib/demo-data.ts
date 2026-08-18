export type Role = "player" | "admin";

export type BookingStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Cancelled"
  | "Completed";

export type PaymentMethod = "GCash" | "Bank Transfer";

export type PaymentStatus = "Awaiting Proof" | "Submitted" | "Verified" | "Rejected";

export type SkillLevel =
  | "Beginner"
  | "Novice"
  | "Intermediate"
  | "Advanced"
  | "All Levels";

export type OpenPlayFormat =
  | "Men's Doubles"
  | "Women's Doubles"
  | "Mixed Doubles";

export type Court = {
  id: string;
  name: string;
  surface: string;
  zone: string;
  pricePerHour: number;
  nightPricePerHour?: number;
  nightStartsAt?: string;
  open: string;
  close: string;
  enabled: boolean;
  slots: string[];
  image?: string;
};

export type Booking = {
  id: string;
  courtId: string;
  courtName: string;
  player: string;
  playerUsername?: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  amount: number;
  paddleQty?: number;
  ballQty?: number;
  comments?: string;
  status: BookingStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  reference: string;
  receiptName: string;
  receiptUrl?: string;
  rejectionReason?: string;
};


export type OpenPlaySession = {
  id: string;
  title: string;
  courtId: string;
  courtName: string;
  courtIds?: string[];
  courtNames?: string[];
  date: string;
  startTime: string;
  endTime: string;
  skillLevel: SkillLevel;
  skillLevels?: SkillLevel[];
  formats?: OpenPlayFormat[];
  maxPlayers: number;
  joinedPlayers: number;
  fee: number;
  status: "Scheduled" | "Full" | "Closed";
};

export type OpenPlayParticipant = {
  id: string;
  sessionId: string;
  playerName: string;
  playerUsername?: string;
  skillLevel: Exclude<SkillLevel, "All Levels">;
  status: "Pending" | "Approved" | "Rejected";
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference: string;
  receiptName: string;
  receiptUrl?: string;
  amount: number;
};

export type OpenPlayMatch = {
  id: string;
  sessionId: string;
  round: "Elimination" | "Semifinals" | "Finals";
  skillLevel: Exclude<SkillLevel, "All Levels">;
  playerOne: string;
  playerTwo: string;
  teamOnePlayers?: string[];
  teamTwoPlayers?: string[];
  score: string;
  winner?: string;
};

export const courtIds = {
  a: "11111111-1111-4111-8111-111111111111",
  b: "22222222-2222-4222-8222-222222222222",
  c: "33333333-3333-4333-8333-333333333333",
} as const;

export type Tournament = {
  id: string;
  name: string;
  date: string;
  deadline: string;
  category: "Singles" | "Doubles";
  division: "Beginner" | "Intermediate" | "Advanced" | "Open";
  fee: number;
  participantLimit: number;
  participants: number;
  status: "Open" | "Draft" | "In Progress" | "Completed";
  matches: string[];
};

export type Event = {
  id: string;
  name: string;
  description: string;
  image: string;
  dateTime: string;
  location: string;
  deadline: string;
  fee: number;
  maxAttendees: number;
  attendees: number;
  status: "Open" | "Closed";
};

export const courts: Court[] = [
  {
    id: courtIds.a,
    name: "Court A",
    surface: "Cushioned acrylic",
    zone: "Near entrance",
    pricePerHour: 420,
    nightPricePerHour: 500,
    nightStartsAt: "17:00",
    open: "06:00",
    close: "22:00",
    enabled: true,
    slots: ["06:00", "07:00", "08:00", "10:00", "14:00", "16:00", "18:00", "20:00"],
    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: courtIds.b,
    name: "Court B",
    surface: "Outdoor hard court",
    zone: "Garden side",
    pricePerHour: 380,
    nightPricePerHour: 460,
    nightStartsAt: "17:00",
    open: "07:00",
    close: "21:00",
    enabled: true,
    slots: ["07:00", "09:00", "11:00", "13:00", "15:00", "17:00", "19:00"],
    image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: courtIds.c,
    name: "Court C",
    surface: "Covered synthetic",
    zone: "Training wing",
    pricePerHour: 500,
    nightPricePerHour: 600,
    nightStartsAt: "17:00",
    open: "08:00",
    close: "23:00",
    enabled: true,
    slots: ["08:00", "09:00", "12:00", "14:00", "16:00", "18:00", "21:00"],
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1200&auto=format&fit=crop",
  },
];

export const initialBookings: Booking[] = [
  {
    id: "BKG-1040",
    courtId: courtIds.b,
    courtName: "Court B",
    player: "Maria Santos",
    playerUsername: "maria_santos",
    date: "2026-08-20",
    startTime: "09:00",
    endTime: "11:00",
    hours: 2,
    amount: 760,
    status: "Approved",
    paymentMethod: "GCash",
    paymentStatus: "Verified",
    reference: "GC-992811",
    receiptName: "receipt_maria.png",
  },
  {
    id: "BKG-1041",
    courtId: courtIds.a,
    courtName: "Court A",
    player: "Carlo Reyes",
    playerUsername: "carlo_reyes",
    date: "2026-08-20",
    startTime: "14:00",
    endTime: "16:00",
    hours: 2,
    amount: 840,
    status: "Approved",
    paymentMethod: "Bank Transfer",
    paymentStatus: "Verified",
    reference: "BPI-882244",
    receiptName: "bpi_carlo.pdf",
  },
  {
    id: "BKG-1042",
    courtId: courtIds.b,
    courtName: "Court B",
    player: "Elena Cruz",
    playerUsername: "elena_cruz",
    date: "2026-08-20",
    startTime: "14:00",
    endTime: "15:00",
    hours: 1,
    amount: 380,
    status: "Pending",
    paymentMethod: "GCash",
    paymentStatus: "Submitted",
    reference: "GC-331199",
    receiptName: "gcash_elena.jpg",
  },
];


export const openPlaySessions: OpenPlaySession[] = [];

export const openPlayParticipants: OpenPlayParticipant[] = [];

export const openPlayMatches: OpenPlayMatch[] = [];

export const tournaments: Tournament[] = [];

export const events: Event[] = [];

export const announcements: string[] = [];

export const paymentSettings = {
  gcashNumber: "0917 555 0188",
  bankName: "BPI",
  bankAccountName: "KVENS PLACE DINK & DINE",
  bankAccountNumber: "0082-4411-9920",
  qrCode: "/images/payment-qr.svg",
};
