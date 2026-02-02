import crypto from 'crypto';

const keyHex = process.env.MESSAGE_ENCRYPTION_KEY?.trim();

if (!keyHex) {
  throw new Error('Missing MESSAGE_ENCRYPTION_KEY environment variable');
}

const key = Buffer.from(keyHex, 'hex');

if (key.length !== 32) {
  throw new Error('MESSAGE_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
}

export function encryptMessage(plaintext: string): string {
  const iv = crypto.randomBytes(12); // AES-GCM recommended IV size
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  // Store as iv:tag:ciphertext (all base64)
  return [iv.toString('base64'), authTag.toString('base64'), encrypted].join(':');
}

export function decryptMessage(stored: string): string {
  try {
    const parts = stored.split(':');
    if (parts.length !== 3) {
      // Likely legacy plaintext message; return as-is
      return stored;
    }

    const [ivB64, tagB64, ciphertextB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextB64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt message content, returning raw value:', err);
    return stored;
  }
}
