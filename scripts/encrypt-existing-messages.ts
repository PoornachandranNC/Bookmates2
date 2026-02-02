import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Load environment variables from .env.local to match Next.js dev config
dotenv.config({ path: '.env.local' });

const keyHex = process.env.MESSAGE_ENCRYPTION_KEY?.trim();
// Debug: log key length to ensure it matches expected 64 hex chars
console.log('MESSAGE_ENCRYPTION_KEY length:', keyHex ? keyHex.length : 'undefined');

if (!keyHex) {
  throw new Error('Missing MESSAGE_ENCRYPTION_KEY environment variable');
}

const key = Buffer.from(keyHex, 'hex');

if (key.length !== 32) {
  throw new Error('MESSAGE_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
}

function encryptMessage(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64'), authTag.toString('base64'), encrypted].join(':');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceKey);

// Heuristic: encrypted messages are stored as "iv:tag:ciphertext" (3 parts)
function isProbablyEncrypted(content: string | null): boolean {
  if (!content) return false;
  const parts = content.split(':');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

async function run() {
  const pageSize = 500;
  let offset = 0;
  let updatedTotal = 0;

  while (true) {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, content, conversation_id')
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Error fetching messages:', error);
      break;
    }
    if (!messages || messages.length === 0) break;

    const toUpdate = messages
      // Only process rows that have a valid id and plaintext content
      .filter((m) => m.id != null && !isProbablyEncrypted(m.content as string | null))
      .map((m) => ({
        id: m.id,
        content: encryptMessage((m.content as string | null) ?? ''),
      }));

    console.log(
      `Fetched ${messages.length} messages at offset ${offset}, ${toUpdate.length} need encryption`,
    );

    if (toUpdate.length > 0) {
      for (const row of toUpdate) {
        const { error: updateError } = await supabase
          .from('messages')
          .update({ content: row.content })
          .eq('id', row.id as number);

        if (updateError) {
          console.error('Error updating message id', row.id, updateError);
          break;
        }
        updatedTotal += 1;
      }
    }

    offset += pageSize;
  }

  console.log(`Done. Encrypted ${updatedTotal} messages.`);

  // Now encrypt existing notifications.message values in-place
  offset = 0;
  updatedTotal = 0;

  while (true) {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('id, message')
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Error fetching notifications:', error);
      break;
    }
    if (!notifications || notifications.length === 0) break;

    const toUpdate = notifications
      .filter((n) => !isProbablyEncrypted(n.message as string | null))
      .map((n) => ({
        id: n.id,
        message: encryptMessage((n.message as string | null) ?? ''),
      }));

    console.log(
      `Fetched ${notifications.length} notifications at offset ${offset}, ${toUpdate.length} need encryption`,
    );

    if (toUpdate.length > 0) {
      for (const row of toUpdate) {
        const { error: updateError } = await supabase
          .from('notifications')
          .update({ message: row.message })
          .eq('id', row.id as number);

        if (updateError) {
          console.error('Error updating notification id', row.id, updateError);
          break;
        }
        updatedTotal += 1;
      }
    }

    offset += pageSize;
  }

  console.log(`Done. Encrypted ${updatedTotal} notifications.`);
}

run().catch((err) => {
  console.error('Fatal error in migration:', err);
  process.exit(1);
});
