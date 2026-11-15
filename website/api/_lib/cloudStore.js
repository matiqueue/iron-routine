import crypto from 'node:crypto';
import { del, get, put } from '@vercel/blob';

const FALLBACK_SECRET = 'ir_cloud_secret_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c';

function getSecret() {
  return process.env.CLOUD_AUTH_SECRET || process.env.BLOB_READ_WRITE_TOKEN || FALLBACK_SECRET;
}

function getEncryptionKey() {
  return crypto.createHash('sha256').update(`enc:${getSecret()}`).digest();
}

export function deriveUserId(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const hash = crypto
    .createHash('sha256')
    .update(`ir_user:${normalized}`)
    .digest('hex')
    .slice(0, 28);
  return `usr_${hash}`;
}

export function hashPin(pin, salt) {
  return crypto.scryptSync(String(pin || '').trim(), salt, 32).toString('hex');
}

export function verifyPin(pin, salt, expectedHash) {
  const computed = Buffer.from(hashPin(pin, salt), 'hex');
  const expected = Buffer.from(String(expectedHash || ''), 'hex');
  if (computed.length !== expected.length) return false;
  return crypto.timingSafeEqual(computed, expected);
}

export function signCloudToken(payload) {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + 60 * 60 * 24 * 90,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(encoded)
    .digest('base64url');
  return `ir_tok_${encoded}.${sig}`;
}

export function verifyCloudToken(rawToken) {
  if (!rawToken || !rawToken.startsWith('ir_tok_')) return null;
  const body = rawToken.slice('ir_tok_'.length);
  const parts = body.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (!parsed.userId || !parsed.email || parsed.exp < now) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function encryptJsonPayload(rawJson) {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(rawJson, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  });
}

export function decryptJsonPayload(storedText) {
  const parsed = JSON.parse(storedText);
  if (!parsed || parsed.v !== 1 || !parsed.iv || !parsed.tag || !parsed.data) {
    return storedText;
  }
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(parsed.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

async function readPrivateDocument(pathname) {
  try {
    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const response = new Response(result.stream);
    return await response.text();
  } catch {
    return null;
  }
}

async function writePrivateDocument(pathname, content) {
  await put(pathname, content, {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function getCloudUser(userId) {
  const raw = await readPrivateDocument(`nosql/users/${userId}.json`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveCloudUser(user) {
  await writePrivateDocument(`nosql/users/${user.userId}.json`, JSON.stringify(user));
}

export async function getCloudBackupJson(userId) {
  const raw = await readPrivateDocument(`nosql/backups/${userId}.json`);
  if (!raw) return null;
  try {
    return decryptJsonPayload(raw);
  } catch {
    return null;
  }
}

export async function saveCloudBackupJson(userId, backupJson) {
  const encrypted = encryptJsonPayload(backupJson);
  await writePrivateDocument(`nosql/backups/${userId}.json`, encrypted);
}

export async function deleteCloudUserAndBackup(userId) {
  try {
    await del([`nosql/users/${userId}.json`, `nosql/backups/${userId}.json`]);
  } catch {}
}

export async function parseJsonBody(req) {
  if (req && req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return req.body;
    }
    if (typeof req.body === 'string') {
      return req.body ? JSON.parse(req.body) : {};
    }
    if (Buffer.isBuffer(req.body)) {
      return JSON.parse(req.body.toString('utf8'));
    }
  }
  if (req && typeof req.json === 'function') {
    return await req.json();
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export function extractBearerToken(req) {
  let auth = '';
  if (req?.headers) {
    if (typeof req.headers.get === 'function') {
      auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    } else {
      auth = req.headers.authorization || req.headers.Authorization || '';
    }
  }
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length).trim();
  }
  return null;
}

export function sendJson(res, body, status = 200) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (res && typeof res.setHeader === 'function') {
    res.statusCode = status;
    for (const [k, v] of Object.entries(headers)) {
      res.setHeader(k, v);
    }
    res.end(JSON.stringify(body));
    return;
  }
  return new Response(JSON.stringify(body), { status, headers });
}
