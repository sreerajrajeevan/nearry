# Combined personal UI integration

Combines PRs 73, 75, 76 and 77 on main after PR 78. No schema, API-key or backend deployment changes.

- Distance lines retain measured device, named-area, saved-location and sample labels; missing coordinates never imply zero.
- The compact personal header returns after accumulated upward travel, including slow scrolling. Animations respect reduced motion; the back-to-top control sits above the anchored tab bar.
- Personal navigation uses Discover, My plans, Create, Chats and Profile. Search remains reachable from the Home search control and existing tab routes. Business navigation is unchanged.
- Screen-level boundaries, paged discovery and All Offers area parameters, shared unread counts and secure login remain from main.
- Both account profiles confirm logout. Venue headings/counts and safety-action padding retain PR75's independent refinements.

Validate the combined snapshot, not the old branches: typecheck, full tests, exports, real PostGIS and native Android CI. Regression tests cover slow/direction-changing scroll and distance fallback/lookup cases. Check navigation, search, chat badges and location permissions on the next phone test build.
