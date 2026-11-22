import { test } from "node:test";
import assert from "node:assert/strict";
import { chatIdentity } from "../src/utils/chatIdentity";
import { messageParts, isSafeUrl } from "../src/utils/messageLinks";

test("business chats are titled by the business, with the person underneath", () => {
  assert.deepEqual(
    chatIdentity({
      name: "Renil",
      isBusiness: true,
      businessName: "Café Nine",
      booking: true,
      contextTitle: "Sip More, Pay Less!",
    }),
    {
      kind: "business",
      title: "Café Nine",
      subtitle: "Renil",
      tag: "Business",
    },
  );
  // No business name on file yet: fall back to the person, still marked Business.
  assert.deepEqual(chatIdentity({ name: "Renil", isBusiness: true }), {
    kind: "business",
    title: "Renil",
    subtitle: "Business",
    tag: "Business",
  });
});

test("customer and plan chats say what they are about", () => {
  assert.deepEqual(
    chatIdentity({ name: "Sree", booking: true, contextTitle: "Haircut" }),
    {
      kind: "customer",
      title: "Sree",
      subtitle: "Booking · Haircut",
      tag: "Booking",
    },
  );
  assert.deepEqual(chatIdentity({ name: "Anjali", contextTitle: "Football" }), {
    kind: "plan",
    title: "Anjali",
    subtitle: "Plan · Football",
    tag: "Plan",
  });
});

test("links in messages become tappable, punctuation and unsafe schemes do not", () => {
  assert.deepEqual(messageParts("https://wa.me/918075012815"), [
    { text: "https://wa.me/918075012815", url: "https://wa.me/918075012815" },
  ]);
  assert.deepEqual(messageParts("Call wa.me/9180 now."), [
    { text: "Call " },
    { text: "wa.me/9180", url: "https://wa.me/9180" },
    { text: " now." },
  ]);
  const insta =
    "https://www.instagram.com/reel/DfwUqO0xlT/?cplk=MXZrcjczdmc0aTZ4OA==";
  assert.deepEqual(messageParts(`see ${insta}!`), [
    { text: "see " },
    { text: insta, url: insta },
    { text: "!" },
  ]);
  assert.deepEqual(messageParts("menu at www.cafe.in, open 9am"), [
    { text: "menu at " },
    { text: "www.cafe.in", url: "https://www.cafe.in" },
    { text: ", open 9am" },
  ]);
  assert.deepEqual(messageParts("no links here"), [{ text: "no links here" }]);
  assert.equal(isSafeUrl("javascript:alert(1)"), false);
  assert.equal(isSafeUrl("https://localhost"), false);
  assert.deepEqual(messageParts("javascript:alert(1)"), [
    { text: "javascript:alert(1)" },
  ]);
});
