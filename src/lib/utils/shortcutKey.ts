/**
 * The letter a shortcut fires on, taken from the physical key.
 *
 * Non-Latin layouts (Persian, Cyrillic, ...) report a localized `event.key`, so
 * `Ctrl+W` arrives as `event.key === "ش"`. `event.code` stays "KeyW" there.
 */
export function shortcutKey(event: KeyboardEvent) {
  return event.code?.startsWith("Key")
    ? event.code.slice(3).toLowerCase()
    : event.key.toLowerCase();
}
