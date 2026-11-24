import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAY_STORE_URL,
  planIdFromLink,
  planShareMessage,
  planShareUrl,
} from "../src/utils/shareLink";
import { planErrorSection } from "../src/utils/planComposer";
import { requiredMeetingPlaceMessage } from "../src/utils/postLocation";

const id = "6f1c2b9e-1d2a-4c3b-9a8e-1234567890ab";
const page = "https://nearry.example/open.html";

test("a shared plan carries a link that opens that plan", () => {
  assert.equal(planShareUrl(id, page), `${page}?plan=${id}`);
  const message = planShareMessage(
    {
      id,
      title: "Badminton tonight",
      when: "Today, 7:00 pm",
      where: "Unity Sports Hub",
    },
    page,
  );
  assert.match(message, /Badminton tonight/);
  assert.match(message, /Today, 7:00 pm · Unity Sports Hub/);
  assert.ok(message.endsWith(`${page}?plan=${id}`));
});

test("without a hosted page the link is the Play Store listing", () => {
  assert.equal(planShareUrl(id, ""), PLAY_STORE_URL);
  assert.equal(
    planShareUrl(id, "http://insecure.example/open.html"),
    PLAY_STORE_URL,
  );
  assert.equal(planShareUrl("bad id!", page), PLAY_STORE_URL);
});

test("app and web links both lead to the plan; anything else is ignored", () => {
  assert.equal(planIdFromLink(`nearry://plan/${id}`), id);
  assert.equal(planIdFromLink(`${page}?plan=${id}`), id);
  assert.equal(planIdFromLink("nearry://plan/<script>"), null);
  assert.equal(planIdFromLink("https://evil.example/"), null);
  assert.equal(planIdFromLink(null), null);
});

test("publishing with a gap points at the section that needs it", () => {
  assert.equal(planErrorSection("Choose what you’re planning."), 1);
  assert.equal(
    planErrorSection("Give your activity a title (min 4 characters)."),
    2,
  );
  assert.equal(
    planErrorSection("Add a few more details (min 10 characters)."),
    2,
  );
  assert.equal(planErrorSection("Pick a date and time for your post."), 3);
  assert.equal(
    planErrorSection("Start time must be at least 15 minutes in the future."),
    3,
  );
  assert.equal(planErrorSection(requiredMeetingPlaceMessage), 4);
  assert.equal(planErrorSection("Choose an age range between 18 and 100."), 5);
  assert.equal(planErrorSection("Enter a valid amount for this plan."), 6);
});

test("new-plan links carry a venue id from the app scheme or the share page", async () => {
  const { newPlanVenueFromLink } = await import("../src/utils/shareLink");
  assert.equal(newPlanVenueFromLink("nearry://new-plan?venue=v_1"), "v_1");
  assert.equal(
    newPlanVenueFromLink("https://x.github.io/nearry/open.html?newplan=abc-9"),
    "abc-9",
  );
  assert.equal(newPlanVenueFromLink("https://x.test/open.html?plan=p1"), null);
  assert.equal(
    newPlanVenueFromLink("http://x.test/open.html?newplan=v1"),
    null,
  );
  assert.equal(newPlanVenueFromLink("nearry://new-plan?venue=bad%20id"), null);
  assert.equal(newPlanVenueFromLink("other://new-plan?venue=v1"), null);
  assert.equal(newPlanVenueFromLink(null), null);
});

test("new-plan share URL needs an https base and a clean venue id", async () => {
  const { newPlanShareUrl } = await import("../src/utils/shareLink");
  assert.equal(
    newPlanShareUrl("v1", "https://x.test/open.html"),
    "https://x.test/open.html?newplan=v1",
  );
  assert.equal(
    newPlanShareUrl("v1", "https://x.test/open.html?a=1"),
    "https://x.test/open.html?a=1&newplan=v1",
  );
  assert.equal(newPlanShareUrl("v1", "http://x.test/open.html"), null);
  assert.equal(newPlanShareUrl("v1", ""), null);
  assert.equal(newPlanShareUrl("bad id", "https://x.test/open.html"), null);
});
