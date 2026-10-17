/** Detect actual image bytes rather than trusting a filename or picker MIME. */
export function proofImageType(bytes: Uint8Array): {
  extension: string;
  contentType: string;
} {
  if (!bytes.length || bytes.length > 10 * 1024 * 1024)
    throw new Error("Choose a proof image smaller than 10 MB.");
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { extension: "jpg", contentType: "image/jpeg" };
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte))
    return { extension: "png", contentType: "image/png" };
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return { extension: "webp", contentType: "image/webp" };
  throw new Error("Choose a JPEG, PNG, or WebP image.");
}
