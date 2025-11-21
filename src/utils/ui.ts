export function normalizeStringForSearch(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD') // Normalize to NFD form (decomposed form)
    .replace(/[\u0300-\u036f]/g, ''); // Remove combining diacritical marks
}