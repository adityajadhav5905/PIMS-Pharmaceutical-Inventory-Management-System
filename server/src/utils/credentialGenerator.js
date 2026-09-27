import crypto from "crypto";

/**
 * Utility to generate cryptographically secure, random temporary passwords.
 */
export function generateSecureTemporaryPassword(length = 12) {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%^&*";
  const all = uppercase + lowercase + digits + special;

  // Ensure at least one character from each set
  let password = [
    uppercase[crypto.randomInt(0, uppercase.length)],
    lowercase[crypto.randomInt(0, lowercase.length)],
    digits[crypto.randomInt(0, digits.length)],
    special[crypto.randomInt(0, special.length)]
  ];

  // Fill remaining length
  for (let i = password.length; i < length; i++) {
    password.push(all[crypto.randomInt(0, all.length)]);
  }

  // Shuffle array using Fisher-Yates
  for (let i = password.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join("");
}
