/** Mock data for milestone 1 — replaced by Supabase queries in milestone 2. */

export type { Venue, NeedPost } from '../services/mappers';
import type { Venue, NeedPost } from '../services/mappers';

export type Offer = {
  id: string;
  businessId: string;
  businessName: string;
  title: string;
  description: string;
  discountPct?: number;
  startsAt: string;
  endsAt: string;
  maxRedemptions?: number;
  redemptions: number;
  status: 'live' | 'ended';
};

export type Booking = {
  id: string;
  customerName: string;
  offerTitle: string;
  slot: string;
  partySize: number;
  status: 'pending' | 'confirmed' | 'cancelled';
};

export const mockVenues: Venue[] = [
  { id: 'v1', name: 'Kochi Marine Brews', category: 'Café', area: 'Fort Kochi', distanceKm: 0.4, rating: 4.6, openNow: true, liveOffer: '20% off till 6 PM', createdAt: '2026-10-08T08:00:00Z' },
  { id: 'v2', name: 'Lulu Bowling Arena', category: 'Games', area: 'Edappally', distanceKm: 1.2, rating: 4.3, openNow: true, createdAt: '2026-10-08T08:00:00Z' },
  { id: 'v3', name: 'Mattancherry Art Walk', category: 'Culture', area: 'Mattancherry', distanceKm: 2.1, rating: 4.8, openNow: true, liveOffer: 'Free entry today', createdAt: '2026-10-08T08:00:00Z' },
  { id: 'v4', name: 'Rooftop Cinema Club', category: 'Movies', area: 'Kakkanad', distanceKm: 3.5, rating: 4.5, openNow: false, createdAt: '2026-10-08T08:00:00Z' },
  { id: 'v5', name: 'Backwater Kayak Co.', category: 'Outdoors', area: 'Kumbalam', distanceKm: 5.0, rating: 4.9, openNow: true, liveOffer: '2-for-1 slots', createdAt: '2026-10-08T08:00:00Z' },
];

export const mockPosts: NeedPost[] = [
  {
    id: 'p1', authorId: 'u2', authorName: 'Anjali', title: 'Need 2 more for badminton tonight',
    description: 'Court booked at Rajiv Gandhi Indoor, 7–9 PM. Intermediate level, shuttles provided.',
    venueName: 'Rajiv Gandhi Indoor Stadium', startsAt: 'Today · 7:00 PM',
    vacancies: 2, joinedCount: 2, spotsLeft: 0, tags: ['sports', 'badminton'], status: 'open', createdAt: '2026-10-08T08:00:00Z',
  },
  {
    id: 'p2', authorId: 'u3', authorName: 'Dev', title: 'Sunset kayaking — 3 spots left',
    description: 'Chill group paddle, no experience needed. Life jackets included.',
    venueName: 'Backwater Kayak Co.', startsAt: 'Tomorrow · 4:30 PM',
    vacancies: 3, joinedCount: 1, spotsLeft: 2, tags: ['outdoors', 'water'], status: 'open', createdAt: '2026-10-08T07:30:00Z',
  },
  {
    id: 'p3', authorId: 'u4', authorName: 'Meera', title: 'Board game café meetup',
    description: 'Catan + Codenames. New players welcome, we teach.',
    venueName: 'Kochi Marine Brews', startsAt: 'Sat · 5:00 PM',
    vacancies: 4, joinedCount: 0, spotsLeft: 4, tags: ['games', 'social'], status: 'open', createdAt: '2026-10-08T06:00:00Z',
  },
];

export const mockOffers: Offer[] = [
  {
    id: 'o1', businessId: 'b1', businessName: 'Kochi Marine Brews', title: 'Happy Hours Flat 20% Off',
    description: 'All brews and bakes, 4–6 PM today only.', discountPct: 20,
    startsAt: '2026-10-08T10:30:00Z', endsAt: '2026-10-08T12:30:00Z',
    maxRedemptions: 50, redemptions: 23, status: 'live',
  },
  {
    id: 'o2', businessId: 'b1', businessName: 'Kochi Marine Brews', title: 'Weekend Brunch Combo',
    description: 'Brunch platter + cold brew at a combo price.', discountPct: 15,
    startsAt: '2026-10-11T04:00:00Z', endsAt: '2026-10-11T08:00:00Z',
    maxRedemptions: 100, redemptions: 0, status: 'live',
  },
];

export const mockBookings: Booking[] = [
  { id: 'bk1', customerName: 'Anjali', offerTitle: 'Happy Hours Flat 20% Off', slot: 'Today · 5:00 PM', partySize: 2, status: 'confirmed' },
  { id: 'bk2', customerName: 'Dev', offerTitle: 'Happy Hours Flat 20% Off', slot: 'Today · 5:30 PM', partySize: 4, status: 'pending' },
  { id: 'bk3', customerName: 'Meera', offerTitle: 'Weekend Brunch Combo', slot: 'Sat · 10:00 AM', partySize: 3, status: 'pending' },
];

export const mockActivity = [
  { id: 'a1', text: 'Your join request for "Sunset kayaking" was approved', time: '2h ago', unread: true },
  { id: 'a2', text: 'Kochi Marine Brews posted a last-minute offer near you', time: '5h ago', unread: true },
  { id: 'a3', text: 'Anjali joined your badminton post', time: '1d ago', unread: false },
];
