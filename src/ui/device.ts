/** Сенсорный экран без точной мыши: прогулка управляется джойстиком и свайпом (§7.1). */
export function isTouchDevice(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}
