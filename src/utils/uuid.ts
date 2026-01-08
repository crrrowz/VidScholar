// src/utils/uuid.ts
/**
 * UUID v4 Generator
 * 
 * Generates RFC 4122 compliant UUID v4 strings.
 * Used for globally unique note identification across devices.
 */

/**
 * Generate a UUID v4 string
 * Uses crypto.getRandomValues for better randomness when available
 */
export function generateUUID(): string {
    // Use crypto API if available (browser/node)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);

        // Set version (4) and variant (RFC 4122)
        arr[6] = (arr[6] & 0x0f) | 0x40; // Version 4
        arr[8] = (arr[8] & 0x3f) | 0x80; // Variant RFC 4122

        return formatUUID(arr);
    }

    // Fallback to Math.random (less secure but functional)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Format byte array as UUID string
 */
function formatUUID(arr: Uint8Array): string {
    const hex = Array.from(arr, b => b.toString(16).padStart(2, '0'));
    return [
        hex.slice(0, 4).join(''),
        hex.slice(4, 6).join(''),
        hex.slice(6, 8).join(''),
        hex.slice(8, 10).join(''),
        hex.slice(10, 16).join('')
    ].join('-');
}

/**
 * Generate a note-specific UUID with prefix for easy identification
 */
export function generateNoteId(): string {
    return `note-${generateUUID()}`;
}

/**
 * Generate a video-specific UUID with prefix
 */
export function generateVideoId(): string {
    return `video-${generateUUID()}`;
}

/**
 * Validate if a string is a valid UUID format
 */
export function isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

/**
 * Validate if a string is a valid note ID (with prefix)
 */
export function isValidNoteId(str: string): boolean {
    if (!str.startsWith('note-')) return false;
    return isValidUUID(str.substring(5));
}

export default generateUUID;
