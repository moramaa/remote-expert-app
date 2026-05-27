/**
 * Client-side identity helpers.
 * Stores userId + role in localStorage so they survive page refreshes.
 * Never touches the server — all reads/writes are synchronous localStorage ops.
 */

import { v4 as uuidv4 } from 'uuid';

export type UserRole = 'expert' | 'worker' | 'administrator';

const STORAGE_KEYS = {
  userId:    'fieldsync:userId',
  role:      'fieldsync:role',
  sessionId: 'fieldsync:sessionId',
} as const;

// ── Read ────────────────────────────────────────────────────────────────────

export function getStoredUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.userId);
}

export function getStoredRole(): UserRole | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(STORAGE_KEYS.role);
  return v === 'expert' || v === 'worker' || v === 'administrator' ? v : null;
}

export function getStoredSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.sessionId);
}

// ── Write ────────────────────────────────────────────────────────────────────

/** Generate (or return cached) stable user UUID. */
export function ensureUserId(): string {
  let id = getStoredUserId();
  if (!id) {
    id = uuidv4();
    localStorage.setItem(STORAGE_KEYS.userId, id);
  }
  return id;
}

export function storeRole(role: UserRole): void {
  localStorage.setItem(STORAGE_KEYS.role, role);
}

/** Overwrite the stored userId (used by demo mode to set a pre-defined ID). */
export function storeUserId(id: string): void {
  localStorage.setItem(STORAGE_KEYS.userId, id);
}

export function storeSessionId(sessionId: string): void {
  localStorage.setItem(STORAGE_KEYS.sessionId, sessionId);
}

// ── Clear ────────────────────────────────────────────────────────────────────

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEYS.sessionId);
}

export function clearIdentity(): void {
  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
}
