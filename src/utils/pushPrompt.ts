/** The phone's notification permission, as expo-notifications reports it. */
export type PushPermission = {
  status: "granted" | "denied" | "undetermined";
  canAskAgain: boolean;
};

export const pushPromptKey = (accountId: string) =>
  `nearry.push-prompt.v1:${accountId}`;

/**
 * Offer notifications once per account on this phone, after sign-up and
 * onboarding, only when the phone can still show its permission dialog.
 * Someone who already allowed, or turned it off for good, is never nagged.
 */
export function shouldOfferPush({
  realDevice,
  readyAccount,
  alreadyAsked,
  permission,
}: {
  realDevice: boolean;
  readyAccount: boolean;
  alreadyAsked: boolean;
  permission: PushPermission;
}) {
  return (
    realDevice &&
    readyAccount &&
    !alreadyAsked &&
    permission.status !== "granted" &&
    permission.canAskAgain
  );
}

export function pushPromptCopy(accountType: "personal" | "business") {
  return accountType === "business"
    ? {
        title: "Turn on notifications?",
        body: "Know right away when someone books, cancels or messages your business.",
      }
    : {
        title: "Turn on notifications?",
        body: "Know right away when someone asks to join your plan, a host lets you in, or you get a message.",
      };
}
