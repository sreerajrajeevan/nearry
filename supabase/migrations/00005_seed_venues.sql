-- Migration 00005 — seed a small starter venue list.
-- Keeps the app useful before any location-provider integration;
-- venues stay editable/claimable by businesses afterwards.

insert into venues (name, category, area, rating, open_now) values
  ('Unity Turf', 'Sports', 'Kakkanad', 4.6, true),
  ('Rajiv Gandhi Indoor Stadium', 'Sports', 'Kadavanthra', 4.4, true),
  ('Backwater Kayak Co.', 'Outdoors', 'Marine Drive', 4.8, true),
  ('Kochi Marine Brews', 'Café', 'Marine Drive', 4.3, true),
  ('Cochin Board Game House', 'Games', 'Fort Kochi', 4.7, false),
  ('Subhash Park Courts', 'Sports', 'Ernakulam South', 4.1, true)
on conflict do nothing;
