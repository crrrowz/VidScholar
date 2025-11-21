// src/utils/time.ts

// 1. Safe formatter for UI (01:20:30) - Handles strings and numbers
export function formatTimestamp(secondsInput: any): string {
  const seconds = Number(secondsInput);

  // Validate
  if (isNaN(seconds) || seconds < 0) {
    return "00:00";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const mDisplay = minutes.toString().padStart(2, '0');
  const sDisplay = secs.toString().padStart(2, '0');

  if (hours > 0) {
    const hDisplay = hours.toString().padStart(2, '0');
    return `${hDisplay}:${mDisplay}:${sDisplay}`;
  }
  
  return `${mDisplay}:${sDisplay}`;
}

// 2. Safe formatter for Filenames (01-20-30)
export function formatTime(secondsInput: any): string {
  const seconds = Number(secondsInput);
  if (isNaN(seconds) || seconds < 0) return "00-00";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return `${h.toString().padStart(2, '0')}-${m.toString().padStart(2, '0')}-${s.toString().padStart(2, '0')}`;
}

export function parseTimestamp(timestamp: string): number {
  if (!timestamp) return 0;
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

export function formatDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}_${hour}${minute}`;
}

export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  text = text.trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}