/** Decode the native file reader's base64 without browser-only APIs. */
export function imageBytesFromBase64(value: string): Uint8Array {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = value.replace(/\s/g, "");
  if (!clean || clean.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean))
    throw new Error("Could not read this photo. Please choose it again.");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  const bytes = new Uint8Array((clean.length / 4) * 3 - padding);
  let offset = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = alphabet.indexOf(clean[i]),
      b = alphabet.indexOf(clean[i + 1]);
    const c = alphabet.indexOf(clean[i + 2]),
      d = alphabet.indexOf(clean[i + 3]);
    bytes[offset++] = (a << 2) | (b >> 4);
    if (offset < bytes.length) bytes[offset++] = ((b & 15) << 4) | (c >> 2);
    if (offset < bytes.length) bytes[offset++] = ((c & 3) << 6) | d;
  }
  return bytes;
}
