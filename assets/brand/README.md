# Nearry · Around You

Approved identity: an open dark-ink location pin and a separate burnt-orange nearby point.
The wordmark is original outlined lettering. No font needs installing.

- Ink `#252A26`, clay `#C14D2F`, paper `#FAF9F5`.
- The symbol canvas is 256 square. Its dot is centred at (216,114), radius18.
- `pin.svg` omits the point so it can animate independently. `wordmark.svg` is tightly cropped.
- `pin.png` is a 1024px export; `wordmark.png` is a 1722px export. Keep these committed.
- Re-export both PNGs after editing SVG masters. `npm run assets` then composes the native
  icon, adaptive foreground/monochrome, static splash and favicon from those PNGs.
- Native launcher and splash changes require rebuilding the app. Expo Go does not show
  the app's installed launcher icon or an exact standalone native splash.

The React loading UI uses the same pin and wordmark exports. Source SVGs contain no
external font dependencies, raster images or filter effects.

The Android system splash uses a pin-only image in the same position as the React
composition, since Android 12+ masks its native splash image. The wordmark appears
in the React reveal. iOS uses the complete native composition.
