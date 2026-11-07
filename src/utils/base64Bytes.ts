/** Decode file-system base64 without Node Buffer (also runs on native Hermes). */
export function base64Bytes(value: string): Uint8Array {
  const text = value.replace(/\s/g, "");
  if (!text || text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text))
    throw new Error("Could not read this image. Please take it again.");
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes = new Uint8Array(
    (text.length / 4) * 3 -
      (text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0),
  );
  let position = 0;
  for (let i = 0; i < text.length; i += 4) {
    const n =
      (alphabet.indexOf(text[i]) << 18) |
      (alphabet.indexOf(text[i + 1]) << 12) |
      ((alphabet.indexOf(text[i + 2]) & 63) << 6) |
      (alphabet.indexOf(text[i + 3]) & 63);
    for (const shift of [16, 8, 0])
      if (position < bytes.length) bytes[position++] = (n >> shift) & 255;
  }
  return bytes;
}
