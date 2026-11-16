import type { SelfieReviewStatus } from "../services/selfieVerification";

export type VerifyPrompt = {
  title: string;
  body: string;
  cta: string;
  tone: "invite" | "waiting" | "retry";
};

/**
 * What the Profile page's verification card says, or null once the person is
 * verified (a badge by their name takes over).
 */
export function verifyPrompt({
  status,
  checked,
  note,
}: {
  status: SelfieReviewStatus;
  checked: boolean;
  note?: string;
}): VerifyPrompt | null {
  if (checked) return null;
  if (status === "pending")
    return {
      title: "Your selfie is being reviewed",
      body: "We’ll let you know once it’s checked. It usually takes less than a day.",
      cta: "View status",
      tone: "waiting",
    };
  if (status === "rejected")
    return {
      title: "Try your selfie again",
      body: note
        ? `Reviewer note: ${note}`
        : "Your last selfie couldn’t be checked. Try again with a clear face in good light.",
      cta: "Try again",
      tone: "retry",
    };
  if (status === "verified")
    return {
      title: "Verify your new photo",
      body: "You changed your profile photo, so your badge is paused. Take a quick selfie to get it back.",
      cta: "Verify again",
      tone: "invite",
    };
  return {
    title: "Verify your profile",
    body: "Get a verified badge so people know you’re real. It takes one quick selfie.",
    cta: "Get verified",
    tone: "invite",
  };
}
