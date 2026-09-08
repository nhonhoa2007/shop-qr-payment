import crypto from 'crypto';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}
