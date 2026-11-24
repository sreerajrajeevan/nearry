export type LegalPage = "privacy" | "terms" | "child-safety";
export const POLICY_VERSION = "2026-10-19";
export function legalUpdated(page: LegalPage): string {
  return page === "terms" ? "19 October 2026" : "24 November 2026";
}
export function legalTitle(page: LegalPage): string {
  return page === "privacy"
    ? "Your privacy"
    : page === "child-safety"
      ? "Child safety standards"
      : "Community guidelines & terms";
}
export const legalContact = {
  owner: process.env.EXPO_PUBLIC_LEGAL_OWNER?.trim() || "Nearry",
  email: process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || "",
};
export const legalConfigured =
  !!process.env.EXPO_PUBLIC_LEGAL_OWNER?.trim() &&
  !/^(your |example|todo|change.?me)/i.test(legalContact.owner) &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(legalContact.email) &&
  !/(^|\.)(localhost|example\.(com|org|net)|invalid|test)$/.test(
    legalContact.email.split("@")[1].toLowerCase(),
  );
export function legalSections(
  page: LegalPage,
): { title: string; body: string }[] {
  const contact = legalContact.email
    ? `Contact ${legalContact.owner} at ${legalContact.email} for support, privacy requests or safety concerns.`
    : "Public support contact details will be provided before Nearry is released. This preview policy is not yet ready for public launch.";
  if (page === "child-safety")
    return [
      {
        title: "An adult community with standards that protect children",
        body: `Nearry is operated by ${legalContact.owner} and is intended for people aged 18 and over. Child sexual abuse and exploitation (CSAE) are prohibited on Nearry, including in profiles, photos, posts, offers and private messages. These standards apply even though Nearry does not allow children to create accounts.`,
      },
      {
        title: "Prohibited content and behaviour",
        body: "Do not create, upload, request, promote or share child sexual abuse material (CSAM), including computer-generated material. Grooming, sexual solicitation of a child, sextortion, trafficking and any behaviour that sexually exploits or endangers a child are prohibited. Do not use Nearry to arrange or facilitate these activities elsewhere.",
      },
      {
        title: "Report a concern in the app",
        body: "Use Report on a post, photo, offer, venue, message or person and choose Safety concern, including child safety. For a message, hold the message bubble to open its report option. You can also block the person from the conversation. Reports are private and the reported person cannot see who submitted them. Provide enough context to locate the concern, but do not download, copy, forward or upload suspected illegal images as evidence. Nearry is not an emergency service; contact local emergency services if someone is in immediate danger.",
      },
      {
        title: "How concerns are handled",
        body: "We review reports, remove confirmed violating content and restrict or suspend responsible accounts. When we obtain actual knowledge of CSAM on Nearry, we take appropriate action and report it to the relevant regional authority or the National Center for Missing & Exploited Children, as applicable under law. We preserve and disclose evidence only as required or permitted by law. We cooperate with lawful requests from competent authorities. Submitting a report in Nearry does not contact emergency services or law enforcement on your behalf.",
      },
      {
        title: "Child safety contact",
        body: `${contact} For a child-safety concern, use the subject “Nearry child safety” and describe where the concern appears. Do not email suspected CSAM, passwords or sign-in codes. This contact also handles questions from the relevant child-safety authorities.`,
      },
    ];
  if (page === "terms")
    return [
      {
        title: "Welcome to the neighbourhood",
        body: `Nearry is operated by ${legalContact.owner}. By accepting these terms, you agree to use Nearry respectfully and only for lawful plans, services and conversations. You must be at least 18 to create an account. Do not impersonate someone or submit false business information.`,
      },
      {
        title: "Keep people safe",
        body: "Do not post harassment, threats, hate, sexual exploitation, non-consensual images, scams, illegal goods, spam or someone else’s private information. Upload only content you have the right to share. Do not misuse photos, location or verification information.",
      },
      {
        title: "Your content and plans",
        body: "You retain your rights to your content and allow Nearry to store and display it to operate the service. Posts and their attached photos are public, including to people with a link. Chat is limited to the relevant participants, except content submitted in a report may be reviewed by the Nearry team.",
      },
      {
        title: "Reports and moderation",
        body: "Use Report on a post, photo, offer or conversation to flag a concern. We may remove content or suspend accounts that violate these rules. False or abusive reports are not allowed. Blocking stops new contact and new joins/bookings between those accounts; it does not automatically cancel existing commitments. Contact support to ask about a moderation decision.",
      },
      {
        title: "Bookings and meeting others",
        body: "Hosts and businesses are responsible for accurate details, availability and delivering their plans or services. Nearry does not currently process payments. Confirm prices and arrangements directly with the host or business. Business verification is a document review and optional personal selfie review is a human photo comparison, not proof of legal identity, age, liveness or safety. Meet responsibly and use public places where appropriate. Nearry is not an emergency service.",
      },
      {
        title: "Leaving and changes",
        body: "You can request permanent account deletion in Safety & privacy. Upcoming commitments will be cancelled and your content removed through the deletion process. Material changes to these terms will be shown for acceptance in the app. Nothing in these terms limits rights you have under applicable consumer law.",
      },
      {
        title: "Google Maps place search",
        body: "When using Google Maps place search, you are also bound by the Google Maps/Google Earth Additional Terms of Service: https://maps.google.com/help/terms_maps/. Google's Privacy Policy is available at https://policies.google.com/privacy.",
      },
      { title: "Contact", body: contact },
    ];
  return [
    {
      title: "Who operates Nearry",
      body: `${legalContact.owner} operates Nearry, an app for finding nearby plans, places and business offers. This notice describes the data used by the features currently available. ${contact}`,
    },
    {
      title: "Account and activity data",
      body: "We store your email and sign-in identifiers, name, account type and the profile details you choose to provide, such as your photo, bio, interests, gender, self-declared age or business information. Age is private and is required with gender before creating or joining a plan. Google sign-in provides identity information through Supabase Auth. We do not ask for a phone number or store a Google password. Posts, uploads, requests, bookings, chat messages, reports, blocks and notification read states are stored to operate those features.",
    },
    {
      title: "Location and permissions",
      body: "Location access is optional. With permission, coordinates are used to find nearby results and may be sent to our place-search service and its configured provider, Google Maps Platform or Geoapify. Search text and the selected place are sent to that provider to return suggestions and coordinates. Manual area selection is available. The area you choose at sign-up or in Notification preferences is kept until you remove it or delete your account; areas taken from GPS are rounded to about 1 km. It is used to show nearby plans and, if you turn them on, to send “players needed” alerts for plans near you. We do not continuously track your background location. Photo selection provides access to the image you choose. Push notifications require separate phone permission and a device push token.",
    },
    {
      title: "Google Maps place search",
      body: "Google Maps place search is subject to the Google Maps/Google Earth Additional Terms of Service (https://maps.google.com/help/terms_maps/) and Google Privacy Policy (https://policies.google.com/privacy). Google predictions and selected locations are labelled separately from Nearry posts and registered businesses. We do not save a Google search history or import Google places into our business directory. When you attach a meeting spot to a public plan, we store your independently entered label and place ID, and temporarily cache Google coordinates for up to 29 days for nearby filtering. Manual coordinates you confirm are stored with your plan. Meeting locations are visible to other users; do not share a private home address.",
    },
    {
      title: "Optional selfie verification",
      body: "Personal accounts may choose a private camera selfie review against their current public profile picture. Nearry stores the selfie in a private bucket for trusted human review and stores your consent, result and review note. Only an approved boolean is shown to other users as 'Selfie checked'. This is not legal identity, age or certified liveness verification. You can cancel a pending review or remove your check in Profile. The original review photo is queued for deletion following a decision, cancellation, profile-photo change, or seven days without a decision. Abandoned uploads are queued after 24 hours. The maintenance worker retries failed removals; minimal consent/result records remain until account deletion. Pending photos are also removed during account deletion. Changing your profile picture revokes the badge. No automated facial recognition or face templates are used in this version.",
    },
    {
      title: "What others can see",
      body: "Your public profile fields, posts, offers, venue details and uploaded public photos can be viewed by other users. Public images can also be accessed by anyone with their URL, so do not upload private documents as post or profile photos. Participants in an authorised conversation see its messages. Only the Nearry review team receives business-verification documents and report evidence. A reported person cannot see who reported them.",
    },
    {
      title: "How and why data is used",
      body: "We use data to authenticate you, show relevant activity, manage requests and bookings, deliver messages and notifications, review businesses, moderate abuse and investigate technical problems. Operational logs may contain request metadata needed for security and reliability. The current app has no advertising or cross-app tracking SDK and does not sell your personal data.",
    },
    {
      title: "Crash reports",
      body: "When the app crashes or hits an unexpected error, it sends a crash report to Sentry when crash reporting is configured in that build so we can fix it: the error and where in the app it happened, the app version, device model and operating system, and the screens visited just before. Reports do not include your name, email, account ID, messages, typed text, location or photos, and anything resembling an email address, phone number or coordinates is removed on your phone before sending. Reports are kept for up to 90 days.",
    },
    {
      title: "Service providers",
      body: "Supabase provides authentication, database, file storage and server functions. Google Maps Platform or Geoapify provides searched-place suggestions, depending on the configured search provider. Expo and the phone platform’s Apple/Google push services deliver notifications. Resend delivers email sign-in codes through Supabase Auth when email sign-in is enabled, and business-review links to authorised reviewers. Google is used when you choose Google sign-in. Sentry receives crash reports when reporting is configured in the installed build. These providers process relevant data to deliver those services; processing locations depend on the configured provider infrastructure.",
    },
    {
      title: "Retention and account deletion",
      body: "Active account data remains while needed to operate your account. Request deletion from Safety & privacy by typing DELETE. The account is deactivated, upcoming plans and bookings are cancelled, participation is withdrawn and a background worker removes stored files before deleting the sign-in account and related records. Shared conversations are removed when an account is deleted. Reports involving that account are removed. Resolved reports for other accounts are normally removed after 90 days. Delivery receipts are retained for up to 30 days. Temporary caches, provider logs and backups may retain copies until their normal expiry; these are not used as active account data.",
    },
    {
      title: "Your choices",
      body: "You can edit your profile, remove eligible posts, block people, report concerns, disable push alerts, revoke phone permissions and request account deletion. Turning off push does not remove in-app activity. Contact support for access, correction, deletion or another privacy request. Some rights and any necessary retention exceptions depend on applicable law; we will explain an exception rather than silently refusing a request.",
    },
    {
      title: "Security and age",
      body: "We use authenticated access, database permissions and restricted server workers to protect data. No service can guarantee absolute security. Nearry is intended for people aged 18 and over; do not create an account if you are under 18. Contact support if an underage account or exposed information needs review.",
    },
    {
      title: "Updates and contact",
      body: `Material changes to these terms and this notice will be shown in the app. ${contact}`,
    },
  ];
}
