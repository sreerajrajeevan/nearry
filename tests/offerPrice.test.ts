import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatRupees,
  offerPayment,
  offerPriceLabel,
  offerPriceShort,
} from "../src/utils/offerPrice";

test("rupee prices keep paise and use Indian grouping", () => {
  assert.equal(formatRupees(19900), "₹199");
  assert.equal(formatRupees(4950), "₹49.50");
  assert.equal(formatRupees(5), "₹0.05");
  assert.equal(formatRupees(1250000), "₹12,500");
  assert.equal(formatRupees(12345600), "₹1,23,456");
});

test("every offer price says it is paid at the venue", () => {
  assert.equal(offerPriceLabel(undefined), null);
  assert.equal(offerPriceLabel(0), "Free");
  assert.equal(offerPriceShort(19900), "₹199 at venue");
  assert.equal(offerPriceShort(0), "Free");
  assert.equal(offerPriceShort(undefined), "Pay at venue");
  assert.deepEqual(offerPayment(19900), {
    amount: "₹199",
    note: "Nothing is paid in the app.",
  });
  assert.match(offerPayment(undefined).note, /Nothing is paid in the app/);
  assert.equal(offerPayment(0).amount, "Free");
});
