import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "@/lib/errors";

let client = null;

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new AppError(`Missing ${name}. Add it to your server environment.`, {
      code: "missing_r2_config",
      stage: "storage_configuration",
      source: "r2",
      details: { env: name },
    });
  }

  return value;
}

function getBucketName() {
  return getRequiredEnv("R2_BUCKET_NAME");
}

function getR2Client() {
  if (client) {
    return client;
  }

  const accountId = getRequiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = getRequiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = getRequiredEnv("R2_SECRET_ACCESS_KEY");

  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return client;
}

function sanitizeFilename(filename) {
  const normalized = String(filename || "audio.mp3")
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "audio.mp3";
}

function createObjectKey(userId, filename) {
  return `audio/${userId}/${Date.now()}-${sanitizeFilename(filename)}`;
}

function normalizeContentType(contentType) {
  const cleaned = String(contentType || "").trim();

  return cleaned || "audio/mpeg";
}

export function isOwnedAudioKey(objectKey, userId) {
  const cleanedKey = String(objectKey || "").trim();
  const cleanedUserId = String(userId || "").trim();

  if (!cleanedKey || !cleanedUserId) {
    return false;
  }

  return cleanedKey.startsWith(`audio/${cleanedUserId}/`);
}

export async function createSignedAudioUpload({
  userId,
  originalFilename,
  contentType,
}) {
  const objectKey = createObjectKey(userId, originalFilename);
  const normalizedContentType = normalizeContentType(contentType);

  try {
    const uploadUrl = await getSignedUrl(
      getR2Client(),
      new PutObjectCommand({
        Bucket: getBucketName(),
        Key: objectKey,
        ContentType: normalizedContentType,
      }),
      { expiresIn: 60 * 15 },
    );

    return {
      objectKey,
      uploadUrl,
      headers: {
        "Content-Type": normalizedContentType,
      },
    };
  } catch (error) {
    throw new AppError("Failed to generate a signed audio upload URL.", {
      code: "signed_audio_upload_failed",
      stage: "storage_upload",
      source: "r2",
      details: error?.message || String(error),
    });
  }
}

export async function getAudioObject(objectKey, signal) {
  if (!objectKey) {
    throw new AppError("Audio key is required.", {
      code: "missing_audio_key",
      stage: "storage_read",
      source: "r2",
    });
  }

  try {
    const response = await getR2Client().send(
      new GetObjectCommand({
        Bucket: getBucketName(),
        Key: objectKey,
      }),
      signal ? { abortSignal: signal } : undefined,
    );

    if (!response.Body) {
      throw new AppError("Audio file is missing from storage.", {
        code: "audio_not_found",
        stage: "storage_read",
        source: "r2",
      });
    }

    const bytes = await response.Body.transformToByteArray();

    return {
      buffer: Buffer.from(bytes),
      contentType: normalizeContentType(response.ContentType),
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error?.name === "AbortError") {
      throw error;
    }

    throw new AppError("Failed to fetch audio from Cloudflare R2.", {
      code: "audio_fetch_failed",
      stage: "storage_read",
      source: "r2",
      details: error?.message || String(error),
    });
  }
}

export async function deleteAudioObject(objectKey) {
  if (!objectKey) {
    return;
  }

  try {
    await getR2Client().send(
      new DeleteObjectCommand({
        Bucket: getBucketName(),
        Key: objectKey,
      }),
    );
  } catch (error) {
    throw new AppError("Failed to delete audio from Cloudflare R2.", {
      code: "audio_delete_failed",
      stage: "storage_delete",
      source: "r2",
      details: error?.message || String(error),
    });
  }
}

export async function getSignedAudioUrl(objectKey) {
  if (!objectKey) {
    return null;
  }

  try {
    return getSignedUrl(
      getR2Client(),
      new GetObjectCommand({
        Bucket: getBucketName(),
        Key: objectKey,
      }),
      { expiresIn: 60 * 60 },
    );
  } catch (error) {
    throw new AppError("Failed to generate a signed audio URL.", {
      code: "signed_audio_url_failed",
      stage: "storage_read",
      source: "r2",
      details: error?.message || String(error),
    });
  }
}
