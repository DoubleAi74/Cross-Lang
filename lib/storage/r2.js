import {
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

export async function uploadAudio(fileBuffer, userId, originalFilename) {
  if (!fileBuffer) {
    throw new AppError("No audio buffer was provided for upload.", {
      code: "missing_audio_buffer",
      stage: "storage_upload",
      source: "r2",
    });
  }

  const objectKey = createObjectKey(userId, originalFilename);

  try {
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: getBucketName(),
        Key: objectKey,
        Body: fileBuffer,
        ContentType: "audio/mpeg",
      }),
    );
  } catch (error) {
    throw new AppError("Failed to upload audio to Cloudflare R2.", {
      code: "audio_upload_failed",
      stage: "storage_upload",
      source: "r2",
      details: error?.message || String(error),
    });
  }

  return objectKey;
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
