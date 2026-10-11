import { AccountType } from '../navigation/types';

/**
 * Explicit mappings between Postgres rows (snake_case) and application
 * models (camelCase). Every service must convert through these — never
 * `as`-cast a raw row onto an app type.
 */

// ── Profiles ──────────────────────────────────────────────

export type DbProfile = {
  id: string;
  account_type: AccountType;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  interests: string[] | null;
  business_name: string | null;
  business_details: Record<string, unknown> | null;
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  onboarding_completed: boolean;
  created_at: string;
};

export type Profile = {
  id: string;
  accountType: AccountType;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  interests: string[];
  businessName?: string;
  businessDetails: Record<string, unknown>;
  verificationStatus: DbProfile['verification_status'];
  onboardingCompleted: boolean;
  createdAt: string;
};

export function toProfile(row: DbProfile): Profile {
  return {
    id: row.id,
    accountType: row.account_type,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? undefined,
    bio: row.bio ?? undefined,
    interests: row.interests ?? [],
    businessName: row.business_name ?? undefined,
    businessDetails: row.business_details ?? {},
    verificationStatus: row.verification_status,
    onboardingCompleted: row.onboarding_completed,
    createdAt: row.created_at,
  };
}

// ── Venues ────────────────────────────────────────────────

export type DbVenue = {
  id: string;
  business_id: string | null;
  name: string;
  category: string;
  area: string;
  location: unknown;
  rating: number | null;
  open_now: boolean | null;
  created_at: string;
};

export type Venue = {
  id: string;
  businessId?: string;
  name: string;
  category: string;
  area: string;
  rating: number;
  openNow: boolean;
  createdAt: string;
  /** Populated by nearby search / mock data only. */
  distanceKm?: number;
  /** Populated from live offers (milestone 5). */
  liveOffer?: string;
};

export function toVenue(row: DbVenue): Venue {
  return {
    id: row.id,
    businessId: row.business_id ?? undefined,
    name: row.name,
    category: row.category,
    area: row.area,
    rating: Number(row.rating ?? 0),
    openNow: row.open_now ?? true,
    createdAt: row.created_at,
  };
}

// ── Posts ─────────────────────────────────────────────────

export type DbPost = {
  id: string;
  author_id: string;
  title: string;
  description: string;
  venue_id: string | null;
  venue_name: string | null;
  starts_at: string;
  expires_at: string | null;
  vacancies: number;
  cost_cents: number | null;
  tags: string[] | null;
  status: 'open' | 'closed' | 'cancelled';
  created_at: string;
  // Joined aggregates (optional, present when selected):
  author?: { display_name: string } | null;
  approved_count?: number;
};

export type NeedPost = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  description: string;
  venueId?: string;
  venueName?: string;
  startsAt: string;
  expiresAt?: string;
  vacancies: number;
  /** Approved participants so far. */
  joinedCount: number;
  /** vacancies - joinedCount, floored at 0. */
  spotsLeft: number;
  costCents?: number;
  tags: string[];
  status: 'open' | 'closed' | 'cancelled';
  createdAt: string;
};

export function toNeedPost(row: DbPost): NeedPost {
  const joinedCount = row.approved_count ?? 0;
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author?.display_name ?? 'Someone',
    title: row.title,
    description: row.description,
    venueId: row.venue_id ?? undefined,
    venueName: row.venue_name ?? undefined,
    startsAt: row.starts_at,
    expiresAt: row.expires_at ?? undefined,
    vacancies: row.vacancies,
    joinedCount,
    spotsLeft: Math.max(0, row.vacancies - joinedCount),
    costCents: row.cost_cents ?? undefined,
    tags: row.tags ?? [],
    status: row.status,
    createdAt: row.created_at,
  };
}

export type NewPostInput = {
  title: string;
  description: string;
  venueId?: string;
  venueName?: string;
  startsAt: string;
  expiresAt?: string;
  vacancies: number;
  costCents?: number;
  tags: string[];
};

export function toDbNewPost(authorId: string, input: NewPostInput): Record<string, unknown> {
  return {
    author_id: authorId,
    title: input.title,
    description: input.description,
    venue_id: input.venueId ?? null,
    venue_name: input.venueName ?? null,
    starts_at: input.startsAt,
    expires_at: input.expiresAt ?? null,
    vacancies: input.vacancies,
    cost_cents: input.costCents ?? null,
    tags: input.tags,
    status: 'open',
  };
}

// ── Join requests ─────────────────────────────────────────

export type DbJoinRequest = {
  id: string;
  post_id: string;
  requester_id: string;
  status: 'pending' | 'approved' | 'declined' | 'withdrawn';
  created_at: string;
  requester?: { display_name: string } | null;
};

export type JoinRequest = {
  id: string;
  postId: string;
  requesterId: string;
  requesterName: string;
  status: 'pending' | 'approved' | 'declined' | 'withdrawn';
  createdAt: string;
};

export function toJoinRequest(row: DbJoinRequest): JoinRequest {
  return {
    id: row.id,
    postId: row.post_id,
    requesterId: row.requester_id,
    requesterName: row.requester?.display_name ?? 'Someone',
    status: row.status,
    createdAt: row.created_at,
  };
}

// ── Offers ────────────────────────────────────────────────

export type DbOffer = {
  id: string;
  business_id: string;
  title: string;
  description: string;
  discount_pct: number | null;
  price_cents: number | null;
  starts_at: string;
  ends_at: string;
  venue_id: string | null;
  slot_capacity: number;
  max_redemptions: number | null;
  redemptions: number;
  status: 'draft' | 'live' | 'ended' | 'cancelled';
  created_at: string;
  business?: { display_name: string } | null;
};

export type Offer = {
  id: string;
  businessId: string;
  businessName: string;
  title: string;
  description: string;
  discountPct?: number;
  priceCents?: number;
  startsAt: string;
  endsAt: string;
  venueId?: string;
  slotCapacity: number;
  maxRedemptions?: number;
  redemptions: number;
  status: 'draft' | 'live' | 'ended' | 'cancelled';
  createdAt: string;
};

export function toOffer(row: DbOffer): Offer {
  return {
    id: row.id,
    businessId: row.business_id,
    businessName: row.business?.display_name ?? 'Business',
    title: row.title,
    description: row.description,
    discountPct: row.discount_pct ?? undefined,
    priceCents: row.price_cents ?? undefined,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    venueId: row.venue_id ?? undefined,
    slotCapacity: row.slot_capacity,
    maxRedemptions: row.max_redemptions ?? undefined,
    redemptions: row.redemptions,
    status: row.status,
    createdAt: row.created_at,
  };
}

// ── Bookings ──────────────────────────────────────────────

export type DbBooking = {
  id: string;
  offer_id: string;
  customer_id: string;
  business_id?: string;
  slot: string;
  party_size: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
  customer?: { display_name: string } | null;
  offer?: { title: string } | null;
  customer_name?: string;
  offer_title?: string;
};

export type Booking = {
  id: string;
  offerId: string;
  customerId: string;
  businessId?: string;
  customerName: string;
  offerTitle: string;
  slot: string;
  partySize: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
};

export function toBooking(row: DbBooking): Booking {
  return {
    id: row.id,
    offerId: row.offer_id,
    customerId: row.customer_id,
    businessId: (row as Record<string, unknown>).business_id as string | undefined,
    customerName: row.customer?.display_name ?? row.customer_name ?? 'Someone',
    offerTitle: row.offer?.title ?? row.offer_title ?? 'Offer',
    slot: row.slot,
    partySize: row.party_size,
    status: row.status,
    createdAt: row.created_at,
  };
}

// ── Chat ──────────────────────────────────────────────────

export type Conversation = {
  id: string;
  otherUserId: string;
  otherName: string;
  postId?: string;
  bookingId?: string;
  contextTitle: string;
  lastBody?: string;
  lastAt?: string;
  unreadCount: number;
};

export function toConversation(row: Record<string, unknown>): Conversation {
  return {
    id: row.id as string,
    otherUserId: row.other_user_id as string,
    otherName: (row.other_name as string) ?? 'Someone',
    postId: (row.post_id as string) ?? undefined,
    bookingId: (row.booking_id as string) ?? undefined,
    contextTitle: (row.context_title as string) ?? 'Chat',
    lastBody: (row.last_body as string) ?? undefined,
    lastAt: (row.last_at as string) ?? undefined,
    unreadCount: Number(row.unread_count ?? 0),
  };
}

export type DbMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: { display_name: string } | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  mine: boolean;
};

export function toChatMessage(row: DbMessage, myId: string): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName: row.sender?.display_name ?? 'Someone',
    body: row.body,
    createdAt: row.created_at,
    mine: row.sender_id === myId,
  };
}

// ── Notifications ─────────────────────────────────────────

export type DbNotification = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  ref_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  refId?: string;
  read: boolean;
  createdAt: string;
};

export function toAppNotification(row: DbNotification): AppNotification {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    refId: row.ref_id ?? undefined,
    read: row.read_at !== null,
    createdAt: row.created_at,
  };
}
