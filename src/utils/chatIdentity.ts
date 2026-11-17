/**
 * How a 1:1 chat is named. A business chat shows the business ("Studio Nine")
 * with the person who runs it underneath ("Renil"); plan and customer chats
 * show the person, with what the chat is about underneath.
 */
export type ChatKind = "business" | "customer" | "plan";

export type ChatIdentityInput = {
  /** The other person's own name (profiles.display_name). */
  name: string;
  isBusiness?: boolean;
  businessName?: string | null;
  /** True for a booking chat (customer <-> business). */
  booking?: boolean;
  /** Offer or plan title the chat is about. */
  contextTitle?: string | null;
};

export type ChatIdentity = {
  kind: ChatKind;
  title: string;
  subtitle: string;
  /** Short tag for lists: "Business", "Booking", "Plan". */
  tag: string;
};

export function chatIdentity(c: ChatIdentityInput): ChatIdentity {
  const name = c.name.trim() || "Someone";
  const context = c.contextTitle?.trim();
  if (c.isBusiness) {
    const business = c.businessName?.trim();
    return {
      kind: "business",
      title: business || name,
      subtitle: business && business !== name ? name : "Business",
      tag: "Business",
    };
  }
  if (c.booking)
    return {
      kind: "customer",
      title: name,
      subtitle: context ? `Booking · ${context}` : "Booking",
      tag: "Booking",
    };
  return {
    kind: "plan",
    title: name,
    subtitle: context ? `Plan · ${context}` : "Plan chat",
    tag: "Plan",
  };
}
