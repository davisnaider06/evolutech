import crypto from 'crypto';
import { getPaymentEncryptionSecret } from '../config/secrets';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  // A cadeia PAYMENT_KEYS_ENCRYPTION_SECRET -> JWT_SECRET vive em config/secrets
  // e nao pode mudar de ordem: credenciais de gateway salvas antes da chave
  // dedicada existir foram criptografadas com o JWT_SECRET.
  return crypto.createHash('sha256').update(getPaymentEncryptionSecret()).digest();
}

export function encryptSecret(plainText: string): string {
  const value = String(plainText || '').trim();
  if (!value) return '';

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(cipherText: string): string {
  const value = String(cipherText || '').trim();
  if (!value) return '';

  const [ivRaw, tagRaw, encryptedRaw] = value.split(':');
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    return value;
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivRaw, 'base64');
  const tag = Buffer.from(tagRaw, 'base64');
  const encrypted = Buffer.from(encryptedRaw, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

