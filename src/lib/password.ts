/**
 * Edge-compatible password hashing using Scrypt from @noble/hashes
 * Replaces bcryptjs for Edge Runtime compatibility
 */

import { scrypt } from '@noble/hashes/scrypt.js';
import { randomBytes, bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

// Scrypt parameters - secure defaults
// N = 2^14 (16384) - CPU/memory cost
// r = 8 - block size
// p = 1 - parallelization
// dkLen = 32 - derived key length (256 bits)
const SCRYPT_N = 2 ** 14;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_DKLEN = 32;

/**
 * Hash a password using Scrypt
 * Returns format: "salt:hash" (both hex encoded)
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scrypt(password, salt, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, dkLen: SCRYPT_DKLEN });
  return `${bytesToHex(salt)}:${bytesToHex(hash)}`;
}

/**
 * Verify a password against a stored hash
 * @param password - Plain text password to verify
 * @param storedHash - Stored hash in format "salt:hash"
 * @returns true if password matches
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  // Check for reset required marker
  if (storedHash === 'RESET_REQUIRED') {
    return false;
  }

  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }

  const [saltHex, hashHex] = parts;
  if (!saltHex || !hashHex) {
    return false;
  }

  try {
    const salt = hexToBytes(saltHex);
    const expectedHash = hexToBytes(hashHex);
    const computedHash = scrypt(password, salt, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, dkLen: SCRYPT_DKLEN });

    // Constant-time comparison to prevent timing attacks
    if (computedHash.length !== expectedHash.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < computedHash.length; i++) {
      result |= computedHash[i] ^ expectedHash[i];
    }

    return result === 0;
  } catch {
    return false;
  }
}

/**
 * Check if a stored hash needs migration (is bcrypt format)
 * Bcrypt hashes start with $2a$, $2b$, or $2y$
 */
export function isBcryptHash(storedHash: string): boolean {
  return storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$');
}

/**
 * Check if password reset is required
 */
export function isResetRequired(storedHash: string): boolean {
  return storedHash === 'RESET_REQUIRED';
}
