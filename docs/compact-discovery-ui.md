# Compact discovery UI

This is an alternative to the coastal design in PR #38, built directly on current main (including admin controls PR #39). Review and merge one design direction; this change does not depend on PR #38.

## Presentation

Shared theme tokens now use warm white, charcoal and coral. The approved logo geometry is retained, with its nearby dot using the coral accent. Typography uses the existing native font, with regular body text and clearer headings. Theme tokens carry through Personal and Business screens without new native dependencies.

Home has compact horizontal offer cards above photo-left plan cards. Plan cards show the host, posting time, known distance, description, date, venue, audience and stated cost. Availability and the participation bar use actual approved counts and capacity. Uploaded photos take priority; missing/failed live photos retain activity artwork. Explicit demo fixtures alone use bundled sample photography. Card presses use the existing motion and reduced-motion support.

The card action says View plan: it opens details before the existing profile-completion, audience and host-approval checks. Offer actions open offer details and real booking availability. No new automatic join or redemption path is introduced.

## Controls

- Today and This weekend retain the tested local-calendar filters. Home continues excluding the viewer's own posts.
- Within 2 km toggles the existing radius filter. Without location, it opens the area editor instead of pretending distances are known. Filter & sort retains category, price, audience, radius and ordering controls.
- Offer categories match published title/description/business copy. All retains unclassified offers. Draft, expired and redemption-exhausted offers do not appear in the rail. See all resets to All and expands the rail beyond its six-card preview.
- No decorative rating, skill badge or bookmark button is shown without supporting data/functionality.
- Photo/text rows stack at narrow widths or larger system text. Existing safe-area handling reserves space for the bottom navigation and system controls.

## Validation

TypeScript and generated-SQL checks pass. Targeted tests cover date boundaries, home exclusion, distance, combined filters, sort, offer categories, expiration/redemption limits and text contrast. Web and Android production bundles export successfully.

Browser checks use the actual app with explicit demo mode: Today, weekend, 2 km, offer categories, nearest ordering and plan navigation. Review screenshots are saved outside the repository under outputs/nearry-compact-ui. Before store release, check the final binary on a phone, especially large text, image loading, Google/email auth, photo upload/cropping and the chat keyboard.

No database migration or production-data update is required. The native launcher artwork remains the existing release asset; this PR changes the in-app presentation.
