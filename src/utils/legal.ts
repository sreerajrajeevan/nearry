export type LegalPage = "privacy" | "terms";
export const POLICY_VERSION = "2026-10-19";
export const legalContact = {
  owner: process.env.EXPO_PUBLIC_LEGAL_OWNER?.trim() || "Nearry",
  email: process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || "",
};
export const legalConfigured =
  !!process.env.EXPO_PUBLIC_LEGAL_OWNER?.trim() &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(legalContact.email);
export function legalSections(
  page: LegalPage,
): { title: string; body: string }[] {
  const contact = legalContact.email
    ? `Contact ${legalContact.owner} at ${legalContact.email} for support, privacy requests or safety concerns.`
    : "Public support contact details will be provided before Nearry is released. This preview policy is not yet ready for public launch.";
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
        body: "Hosts and businesses are responsible for accurate details, availability and delivering their plans or services. Nearry does not currently process payments. Confirm prices and arrangements directly with the host or business. Verification is a document review, not a guarantee of safety or service quality. Meet responsibly and use public places where appropriate. Nearry is not an emergency service.",
      },
      {
        title: "Leaving and changes",
        body: "You can request permanent account deletion in Safety & privacy. Upcoming commitments will be cancelled and your content removed through the deletion process. Material changes to these terms will be shown for acceptance in the app. Nothing in these terms limits rights you have under applicable consumer law.",
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
      body: "We store your email and sign-in identifiers, name, account type and the profile details you choose to provide, such as your photo, bio, interests, gender or business information. Google sign-in provides identity information through Supabase Auth. We do not ask for a phone number or store a Google password. Posts, uploads, requests, bookings, chat messages, reports, blocks and notification read states are stored to operate those features.",
    },
    {
      title: "Location and permissions",
      body: "Location access is optional. With permission, coordinates are used to find nearby results and may be sent to our place-search service and its provider, Geoapify. Manual area selection is available. We do not continuously track your background location. Photo selection provides access to the image you choose. Push notifications require separate phone permission and a device push token.",
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
      title: "Service providers",
      body: "Supabase provides authentication, database, file storage and server functions. Geoapify provides searched-place suggestions. Expo and the phone platform’s Apple/Google push services deliver notifications. Resend is used to email business-review links to authorised reviewers. Google is used when you choose Google sign-in. These providers process relevant data to deliver those services; processing locations depend on the configured provider infrastructure.",
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
