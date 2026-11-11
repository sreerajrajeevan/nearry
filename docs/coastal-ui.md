# Coastal UI refresh

The supplied Nearry reference guides this version: petrol-teal chrome, warm cream pages, coral actions, photographic community cards and a horizontal local-offer rail. Nunito Sans is bundled in regular, bold and extra-bold weights. No font or decorative header image needs a third-party request at runtime.

## Coverage

- Home: scenic header, area chooser, notifications, conversations, profile, search/filters; category-filtered offer rail; community photo cards; existing date, audience, cost, distance and sorting options.
- Navigation: Home, Explore, Create, Messages, Profile. **My activity** and **My posts** are direct Profile entries. Booking notifications and the booking completion action open the relocated Activity stack screen.
- Welcome, Personal/Business authentication, onboarding, create/edit forms, search/results, Activity, Profile/settings, chat, plan details, business dashboard and business management inherit shared colours, typography, fields, cards, headings, buttons, loading and dialog surfaces.
- Chat retains its keyboard-aware composer, send/error state and conversation actions. Joining still opens plan details and requires the existing profile/audience checks and host approval.
- Native splash, launcher and navigation-area colours match the theme. Existing reduced-motion support, press feedback and stack transitions remain active.

No backend schema, authorization policy, production record or credential changes are required. Decorative scenery and demo-only photos are documented in `assets/coastal/README.md`. Live plans and offers use their uploaded photography and real counts; this redesign does not fabricate reviews, attendees, savings or a saved-plan feature.

## Review

Use the explicit Personal/Business demos for review without production writes. Verify Home date filters and filter sheet, each offer category including an empty category, See all offers, post details/request state, Profile → My activity/My posts, Messages and its long-press options, Create/Edit location and photos, Business offers/bookings, and welcome/auth/legal navigation.

An Android rebuild is required for the new Expo gradient dependency; an update of the existing JavaScript bundle alone is insufficient. Test the resulting build on a phone for keyboard behaviour, gallery/crop permissions, large text, gesture and three-button navigation, Google/email auth and reduced motion before release. A browser preview and Android bundle export do not substitute for those device checks.
