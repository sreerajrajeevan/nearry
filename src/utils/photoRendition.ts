/** Only generated immutable companions have a thumbnail. Legacy URLs stay valid. */
export function photoThumbnail(uri: string): string {
  try {
    const url = new URL(uri);
    if (
      url.protocol === "https:" &&
      /\/storage\/v1\/object\/public\/photos\/[^/]+\/[^/]+\/[^/]+-full\.jpg$/.test(
        url.pathname,
      )
    ) {
      url.pathname = url.pathname.replace(/-full\.jpg$/, "-thumb.jpg");
      return url.toString();
    }
  } catch {}
  return uri;
}
