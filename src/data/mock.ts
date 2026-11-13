/** Explicit demo-only fixtures. Calendar dates stay useful whenever the app is opened. */
const at = (hours: number, minutes = 0, days = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};
const createdAt = new Date().toISOString();

export type {
  Venue,
  NeedPost,
  Offer,
  Booking,
  Conversation,
  ChatMessage,
  AppNotification,
} from "../services/mappers";
import type {
  Venue,
  NeedPost,
  Offer,
  Booking,
  Conversation,
  ChatMessage,
  AppNotification,
} from "../services/mappers";

export const mockVenues: Venue[] = [
  {
    id: "v1",
    name: "Loaf Café",
    category: "Café",
    area: "Kakkanad",
    distanceKm: 0.4,
    rating: 4.6,
    openNow: true,
    amenities: [],
    liveOffer: "20% off till 6 PM",
    createdAt,
  },
  {
    id: "v2",
    name: "Unity Sports Hub",
    category: "Sports",
    area: "Kakkanad",
    distanceKm: 1.2,
    rating: 4.3,
    openNow: true,
    amenities: [],
    createdAt,
  },
  {
    id: "v3",
    name: "Studio Nine",
    category: "Salon",
    area: "Kakkanad",
    distanceKm: 0.7,
    businessId: "b1",
    rating: 4.8,
    openNow: true,
    amenities: [],
    liveOffer: "A haircut opening today",
    createdAt,
  },
  {
    id: "v4",
    name: "Rooftop Cinema Club",
    category: "Movies",
    area: "Kakkanad",
    distanceKm: 3.5,
    rating: 4.5,
    openNow: false,
    amenities: [],
    createdAt,
  },
  {
    id: "v5",
    name: "Backwater Kayak Co.",
    category: "Outdoors",
    area: "Kumbalam",
    distanceKm: 5.0,
    rating: 4.9,
    openNow: true,
    amenities: [],
    liveOffer: "2-for-1 slots",
    createdAt,
  },
];

let weekend = new Date();
weekend.setDate(
  weekend.getDate() +
    (weekend.getDay() === 0 ? 0 : (6 - weekend.getDay() + 7) % 7),
);
weekend.setHours(10, 0, 0, 0);
if (weekend.getTime() <= Date.now())
  weekend = new Date(Date.now() + 45 * 60_000);

export const mockPosts: NeedPost[] = [
  {
    id: "p-reference-gym",
    authorId: "u-reference-meera",
    authorName: "Meera Iyer",
    title: "Looking for a gym partner",
    description:
      "Training push-pull-legs 5 days a week. Join me for a session.",
    venueId: "v2",
    venueName: "Cult Fit Arena, Kakkanad",
    startsAt: new Date(Date.now() + 30 * 60000).toISOString(),
    vacancies: 2,
    joinedCount: 1,
    spotsLeft: 1,
    costCents: 0,
    tags: ["gym", "advanced"],
    genderPreference: "male",
    status: "open",
    createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
  },
  {
    id: "p1",
    demoScene: "court",
    authorId: "u2",
    authorName: "Anjali",
    title: "Anyone up for badminton?",
    description:
      "A friendly game with the neighbourhood crew. Any skill level is welcome. Bring your racket!",
    venueId: "v2",
    venueName: "Unity Sports Hub",
    startsAt: new Date(Date.now() + 90 * 60_000).toISOString(),
    vacancies: 5,
    joinedCount: 2,
    spotsLeft: 3,
    costCents: 15000,
    tags: ["sports", "badminton"],
    status: "open",
    createdAt,
  },
  {
    id: "p2",
    demoScene: "walk",
    authorId: "u3",
    authorName: "Dev",
    title: "Sunset on the water?",
    description:
      "Chill group paddle, no experience needed. Life jackets included.",
    venueId: "v5",
    venueName: "Backwater Kayak Co.",
    startsAt: at(16, 30, 1),
    vacancies: 3,
    joinedCount: 1,
    spotsLeft: 2,
    tags: ["outdoors", "water"],
    status: "open",
    createdAt,
  },
  {
    id: "p3",
    demoScene: "coffee",
    authorId: "u4",
    authorName: "Meera",
    title: "Coffee with someone new?",
    description:
      "A slow coffee and an easy conversation after work. Come as you are. New faces are welcome.",
    venueId: "v1",
    venueName: "Loaf Café",
    startsAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    vacancies: 2,
    joinedCount: 1,
    spotsLeft: 1,
    costCents: 0,
    genderPreference: "any",
    tags: ["coffee", "social"],
    status: "open",
    createdAt,
  },
];

mockPosts.push({
  id: "p-weekend",
  authorId: "u5",
  authorName: "Nikhil",
  demoScene: "walk",
  title: "An easy weekend walk",
  description: "A morning by the water. Come along for some fresh air.",
  venueId: "v5",
  venueName: "Kumbalam waterfront",
  startsAt: weekend.toISOString(),
  vacancies: 4,
  joinedCount: 1,
  spotsLeft: 3,
  costCents: 0,
  genderPreference: "any",
  tags: ["outdoors"],
  status: "open",
  createdAt,
});

export const mockOffers: Offer[] = [
  {
    id: "o1",
    businessId: "b1",
    businessName: "Studio Nine",
    title: "A little time for yourself?",
    description: "A last-minute haircut opening at your neighbourhood salon.",
    priceCents: 45000,
    venueId: "v3",
    startsAt: at(16),
    endsAt: at(20, 0, 1),
    maxRedemptions: 50,
    redemptions: 23,
    status: "live",
    isSpotlight: false,
    slotCapacity: 1,
    slotMinutes: 45,
    createdAt,
  },
  {
    id: "o2",
    businessId: "b1",
    businessName: "Studio Nine",
    title: "A fresh start for the weekend",
    description: "A haircut and beard trim, with a little time to unwind.",
    priceCents: 65000,
    venueId: "v3",
    startsAt: at(10, 0, 1),
    endsAt: at(20, 0, 1),
    maxRedemptions: 100,
    redemptions: 0,
    status: "draft",
    isSpotlight: false,
    slotCapacity: 1,
    slotMinutes: 60,
    createdAt,
  },
];

mockOffers.push(
  {
    ...mockOffers[0],
    id: "o-demo-turf",
    businessId: "b2",
    businessName: "Unity Turf",
    title: "Your next game, for less",
    description: "20% off football court slots.",
    venueId: "v2",
    discountPct: 20,
    priceCents: 80000,
  },
  {
    ...mockOffers[0],
    id: "o-demo-cafe",
    businessId: "b3",
    businessName: "Loaf Café",
    title: "An afternoon coffee break",
    description: "A little coffee and cake at your local cafe.",
    venueId: "v1",
    priceCents: 19900,
  },
  {
    ...mockOffers[0],
    id: "o-demo-gym",
    businessId: "b4",
    businessName: "Neighbourhood Fitness",
    title: "Make time for a workout",
    description: "An introductory gym training session.",
    venueId: "v2",
    priceCents: 0,
  },
);

export const mockBookings: Booking[] = [
  {
    id: "bk1",
    offerId: "o1",
    customerId: "u2",
    businessId: "b1",
    customerName: "Anjali",
    offerTitle: "Haircut",
    slot: at(14, 30),
    partySize: 1,
    status: "confirmed",
    createdAt,
  },
  {
    id: "bk2",
    offerId: "o1",
    customerId: "u3",
    businessId: "b1",
    customerName: "Dev",
    offerTitle: "Haircut",
    slot: at(15, 15),
    partySize: 1,
    status: "pending",
    createdAt,
  },
  {
    id: "bk3",
    offerId: "o2",
    customerId: "u4",
    businessId: "b1",
    customerName: "Meera",
    offerTitle: "Haircut & beard trim",
    slot: at(10, 30, 1),
    partySize: 1,
    status: "pending",
    createdAt,
  },
];

export const mockActivity = [
  {
    id: "a1",
    text: 'Your join request for "Sunset kayaking" was approved',
    time: "2h ago",
    unread: true,
  },
  {
    id: "a2",
    text: "Kochi Marine Brews posted a last-minute offer near you",
    time: "5h ago",
    unread: true,
  },
  {
    id: "a3",
    text: "Anjali joined your badminton post",
    time: "1d ago",
    unread: false,
  },
];

export const mockConversations: Conversation[] = [
  {
    id: "mc1",
    otherUserId: "u2",
    otherName: "Anjali",
    postId: "p1",
    contextTitle: "Need 2 players at Unity Turf",
    lastBody: "I'll bring an extra ball",
    lastAt: createdAt,
    unreadCount: 1,
  },
  {
    id: "mc2",
    otherUserId: "b1",
    otherName: "Studio Nine",
    bookingId: "bk1",
    contextTitle: "Haircut at Studio Nine",
    lastBody: "Table for 2 confirmed",
    lastAt: createdAt,
    unreadCount: 0,
  },
];

export const mockMessages: ChatMessage[] = [
  {
    id: "mm1",
    conversationId: "mc1",
    senderId: "u2",
    senderName: "Anjali",
    body: "Hey! Still need players?",
    createdAt,
    mine: false,
  },
  {
    id: "mm2",
    conversationId: "mc1",
    senderId: "demo-user",
    senderName: "You",
    body: "Yes, 7 PM at Unity Turf",
    createdAt,
    mine: true,
  },
  {
    id: "mm3",
    conversationId: "mc1",
    senderId: "u2",
    senderName: "Anjali",
    body: "I'll bring an extra ball",
    createdAt,
    mine: false,
  },
  {
    id: "mm4",
    conversationId: "mc2",
    senderId: "b1",
    senderName: "Studio Nine",
    body: "Table for 2 confirmed",
    createdAt,
    mine: false,
  },
];

export const mockNotifications: AppNotification[] = [
  {
    id: "mn1",
    kind: "request_approved",
    title: "Request approved",
    body: 'You\'re in! "Need 2 players at Unity Turf"',
    refId: "p1",
    read: false,
    createdAt,
  },
  {
    id: "mn2",
    kind: "message",
    title: "Message from Anjali",
    body: "I'll bring an extra ball",
    refId: "mc1",
    read: false,
    createdAt,
  },
  {
    id: "mn3",
    kind: "booking_confirmed",
    title: "Booking confirmed",
    body: '"Happy Hours Flat 20% Off" — see you there',
    refId: "o1",
    read: true,
    createdAt,
  },
];

// Explicit reference-matching demo offers; never mixed into live discovery.
mockOffers.unshift(
  {
    ...mockOffers[0],
    id: "o-reference-fitness",
    businessId: "b-demo-cult",
    businessName: "Cult Fit Arena",
    title: "Gym training membership",
    description: "40% off gym training.",
    discountPct: 40,
    priceCents: 99000,
    venueId: "v2",
    endsAt: new Date(Date.now() + 17 * 86400000).toISOString(),
  },
  {
    ...mockOffers[0],
    id: "o-reference-trial",
    businessId: "b-demo-iron",
    businessName: "Iron Den Gym",
    title: "1 week free",
    description: "A free introductory week of gym training.",
    priceCents: 0,
    discountPct: undefined,
    venueId: "v2",
    endsAt: new Date(Date.now() + 32 * 86400000).toISOString(),
  },
);
