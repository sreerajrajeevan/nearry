import test from "node:test";
import assert from "node:assert/strict";
import { colors } from "../src/theme/colors";

function luminance(hex: string) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const [dark, light] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (light + 0.05) / (dark + 0.05);
}

test("small body text, secondary text, links, placeholders and primary buttons meet 4.5:1 contrast", () => {
  for (const [foreground, background] of [
    [colors.coralDeep, colors.background],
    [colors.coralDeep, colors.surface],
    [colors.textDim, colors.coralSoft],
    [colors.text, colors.background],
    [colors.textDim, colors.background],
    [colors.textFaint, colors.background],
    [colors.accent, colors.background],
    [colors.onAccent, colors.accent],
    [colors.clayDeep, colors.claySoft],
    [colors.text, colors.surface],
    [colors.textDim, colors.surface],
    [colors.textDim, colors.surfaceRaised],
    [colors.onSage, colors.sage],
    [colors.onGold, colors.gold],
    [colors.onAccent, colors.forest],
    [colors.sageSoft, colors.forest],
    [colors.gold, colors.forest],
    [colors.goldSoft, colors.forest],
    [colors.text, colors.sandSoft],
    [colors.red, colors.background],
    [colors.red, colors.dangerSoft],
    [colors.onAccent, colors.red],
    [colors.success, colors.sageSoft],
    [colors.textDim, colors.sandSoft],
    [colors.textDim, colors.goldSoft],
  ])
    assert.ok(
      contrast(foreground, background) >= 4.5,
      `${foreground} on ${background} has insufficient contrast`,
    );
});
