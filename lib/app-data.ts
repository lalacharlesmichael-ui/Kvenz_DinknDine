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

export const paymentSettings = {
  gcashNumber: "0917 555 0188",
  bankName: "BPI",
  bankAccountName: "KVENS PLACE DINK & DINE",
  bankAccountNumber: "0082-4411-9920",
  qrCode: "/images/payment-qr.svg",
};
