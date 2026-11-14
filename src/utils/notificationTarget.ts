import type { AccountType } from "../navigation/types";
import type { AppNotification } from "../services/mappers";

export function notificationTarget(notice: AppNotification, role: AccountType) {
  if (
    role === "personal" &&
    notice.kind === "plan_group_message" &&
    notice.refId
  )
    return { screen: "PlanGroup", params: { messageId: notice.refId } };
  if (notice.kind === "message" && notice.refId)
    return { screen: "Conversation", params: { conversationId: notice.refId } };
  if (role === "personal") {
    if (notice.kind === "selfie_review")
      return { screen: "SelfieVerification", params: undefined };
    if (
      [
        "join_request",
        "request_approved",
        "request_declined",
        "post_cancelled",
      ].includes(notice.kind) &&
      notice.refId
    )
      return { screen: "PostDetails", params: { postId: notice.refId } };
    return { screen: "PersonalTabs", params: { screen: "Activity" } };
  }
  return {
    screen: "BusinessTabs",
    params: {
      screen: notice.kind.startsWith("verification_") ? "Business" : "Bookings",
    },
  };
}
