import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSignedAudioUpload } from "@/lib/storage/r2";

export const runtime = "nodejs";

const MAX_AUDIO_FILE_SIZE = 25 * 1024 * 1024;
const AUDIO_EXTENSION_PATTERN = /\.(mp3|m4a|wav|webm|ogg|mp4|mpeg|aac|flac)$/i;

function normalizeContentType(contentType, fileName) {
  const cleaned = String(contentType || "").trim();

  if (
    cleaned.startsWith("audio/") ||
    cleaned === "video/mp4" ||
    cleaned === "application/octet-stream"
  ) {
    return cleaned === "application/octet-stream" ? inferContentType(fileName) : cleaned;
  }

  return inferContentType(fileName);
}

function inferContentType(fileName) {
  const lowerName = String(fileName || "").toLowerCase();

  if (lowerName.endsWith(".m4a")) {
    return "audio/mp4";
  }

  if (lowerName.endsWith(".wav")) {
    return "audio/wav";
  }

  if (lowerName.endsWith(".ogg")) {
    return "audio/ogg";
  }

  if (lowerName.endsWith(".webm")) {
    return "audio/webm";
  }

  if (lowerName.endsWith(".mp4")) {
    return "video/mp4";
  }

  if (lowerName.endsWith(".flac")) {
    return "audio/flac";
  }

  if (lowerName.endsWith(".aac")) {
    return "audio/aac";
  }

  return "audio/mpeg";
}

export async function POST(request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const fileName = String(body?.fileName || "").trim();
    const fileSize = Number(body?.fileSize || 0);
    const contentType = normalizeContentType(body?.contentType, fileName);

    if (!fileName) {
      return NextResponse.json({ error: "File name is required" }, { status: 400 });
    }

    if (!AUDIO_EXTENSION_PATTERN.test(fileName)) {
      return NextResponse.json(
        { error: "Choose a supported audio file such as MP3, M4A, WAV, OGG, or MP4." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ error: "File size is required" }, { status: 400 });
    }

    if (fileSize > MAX_AUDIO_FILE_SIZE) {
      return NextResponse.json(
        { error: "Audio file must be 25MB or smaller" },
        { status: 400 },
      );
    }

    const upload = await createSignedAudioUpload({
      userId: session.user.id,
      originalFilename: fileName,
      contentType,
    });

    return NextResponse.json({
      audioKey: upload.objectKey,
      uploadUrl: upload.uploadUrl,
      headers: upload.headers,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error.message || "Failed to prepare audio upload" },
      { status: 500 },
    );
  }
}
