import test from "node:test";
import assert from "node:assert/strict";
import { createAppAlertQueue } from "../src/services/appAlert";

test("notices queued before the host mounts remain available in order", () => {
  const queue = createAppAlertQueue();
  queue.alert("Your Business account", "We opened your Business space.");
  const first = queue.getSnapshot()!;
  queue.alert("Saved");
  assert.equal(queue.getSnapshot(), first);
  assert.equal(first.buttons[0].text, "Got it");
  queue.choose(first.id, 0);
  assert.equal(queue.getSnapshot()?.title, "Saved");
});

test("cancel never runs the destructive action, and stale/double taps are inert", () => {
  const queue = createAppAlertQueue();
  let deleted = 0;
  let canceled = 0;
  queue.alert("Delete?", undefined, [
    { text: "Keep it", style: "cancel", onPress: () => canceled++ },
    { text: "Delete", style: "destructive", onPress: () => deleted++ },
  ]);
  const id = queue.getSnapshot()!.id;
  queue.choose(id, 7);
  assert.equal(queue.getSnapshot()?.id, id);
  queue.choose(id, 0);
  queue.choose(id, 1);
  assert.equal(canceled, 1);
  assert.equal(deleted, 0);
  assert.equal(queue.getSnapshot(), null);
});

test("confirm callback runs once and can open an error dialog without being overwritten", () => {
  const queue = createAppAlertQueue();
  let calls = 0;
  queue.alert("Delete?", undefined, [
    {
      text: "Delete",
      style: "destructive",
      onPress: () => {
        calls++;
        queue.alert("Could not delete", "Check your connection and try again.");
      },
    },
  ]);
  const id = queue.getSnapshot()!.id;
  queue.choose(id, 0);
  queue.choose(id, 0);
  queue.dismiss(id);
  assert.equal(calls, 1);
  assert.equal(queue.getSnapshot()?.title, "Could not delete");
});

test("backdrop and Back cannot silently accept or dismiss a required confirmation", () => {
  const queue = createAppAlertQueue();
  let dismissed = 0;
  let accepted = 0;
  queue.alert("Confirm", undefined, [{ onPress: () => accepted++ }], {
    onDismiss: () => dismissed++,
  });
  queue.dismiss(queue.getSnapshot()!.id);
  assert.equal(queue.getSnapshot()?.title, "Confirm");
  assert.equal(accepted, 0);
  assert.equal(dismissed, 0);
});

test("an explicitly dismissible dialog calls only onDismiss and advances safely", () => {
  const queue = createAppAlertQueue();
  let dismissed = 0;
  let pressed = 0;
  queue.alert("Notice", undefined, [{ onPress: () => pressed++ }], {
    cancelable: true,
    onDismiss: () => dismissed++,
  });
  const id = queue.getSnapshot()!.id;
  queue.alert("Next");
  queue.dismiss(id);
  queue.dismiss(id);
  assert.equal(dismissed, 1);
  assert.equal(pressed, 0);
  assert.equal(queue.getSnapshot()?.title, "Next");
});

test("subscriber cleanup and copied button configuration survive caller mutation", () => {
  const queue = createAppAlertQueue();
  let updates = 0;
  const stop = queue.subscribe(() => updates++);
  const buttons = [{ text: "Continue" }];
  const options = { cancelable: false };
  queue.alert("Account", undefined, buttons, options);
  buttons[0].text = "Changed";
  options.cancelable = true;
  assert.equal(queue.getSnapshot()?.buttons[0].text, "Continue");
  queue.dismiss(queue.getSnapshot()!.id);
  assert.equal(updates, 1);
  stop();
  queue.choose(queue.getSnapshot()!.id, 0);
  assert.equal(updates, 1);
  assert.equal(queue.getSnapshot(), null);
});
