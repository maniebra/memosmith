/**
 * The letter a shortcut fires on, taken from the physical key.
 *
 * Non-Latin layouts (Persian, Cyrillic, ...) report a localized `event.key`, so
 * `Ctrl+W` arrives as `event.key === "ش"`. `event.code` stays "KeyW" there.
 * WebKitGTK names Shift+Tab after its GTK keysym, "ISO_Left_Tab".
 */
export function shortcutKey(event: KeyboardEvent) {
  if (event.code === "Tab") {
    return "tab";
  }

  return event.code?.startsWith("Key")
    ? event.code.slice(3).toLowerCase()
    : event.key.toLowerCase();
}
