import { createHmac, timingSafeEqual } from "node:crypto";

const IMPORT_TOKEN_TTL_SECONDS = 60 * 60 * 2;

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET or NEXTAUTH_SECRET is required.");
  }

  return secret;
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value) {
  return Buffer.from(String(value || ""), "base64url").toString("utf8");
}

function signValue(value) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

export function createImportToken(userId) {
  const payload = JSON.stringify({
    userId: String(userId),
    exp: Math.floor(Date.now() / 1000) + IMPORT_TOKEN_TTL_SECONDS,
  });
  const encodedPayload = encodeBase64Url(payload);
  const signature = signValue(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyImportToken(token) {
  const [encodedPayload, signature] = String(token || "").split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  let payload = null;

  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload));
  } catch {
    return null;
  }

  if (!payload?.userId || !payload?.exp) {
    return null;
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return {
    id: String(payload.userId),
  };
}
