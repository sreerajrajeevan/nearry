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
