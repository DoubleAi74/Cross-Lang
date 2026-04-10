import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { MAX_LISTS_PER_USER } from "@/lib/constants";
import { extractWordEntries } from "@/lib/import/word-extraction";
import { serializeListMeta } from "@/lib/lists/serializers";
import { countUserLists, createAudioWordList } from "@/lib/lists/service";
import { uploadAudio } from "@/lib/storage/r2";
import { ValidationError } from "@/lib/lists/validators";

function parseJsonField(value, fieldName) {
  try {
    return JSON.parse(String(value || ""));
  } catch {
    throw new ValidationError(fieldName, `Invalid ${fieldName} JSON`);
  }
}

export async function POST(request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const listCount = await countUserLists(session.user.id);

    if (listCount >= MAX_LISTS_PER_USER) {
      return NextResponse.json(
        { error: `List limit reached (${MAX_LISTS_PER_USER})` },
        { status: 409 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const name = String(formData.get("name") || "").trim();
    const sentences = parseJsonField(formData.get("sentences"), "sentences");
    const storyMetadata = parseJsonField(
      formData.get("storyMetadata"),
      "storyMetadata",
    );

    if (!file || typeof file.arrayBuffer !== "function") {
      throw new ValidationError("file", "Audio file is required");
    }

    if (!name) {
      throw new ValidationError("name", "Name is required");
    }

    if (name.length > 120) {
      throw new ValidationError("name", "Name must be 120 characters or fewer");
    }

    if (!Array.isArray(sentences) || !sentences.length) {
      throw new ValidationError("sentences", "Sentences are required");
    }

    let audioKey = null;
    let warning = null;

    try {
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      audioKey = await uploadAudio(fileBuffer, session.user.id, file.name);
    } catch (error) {
      warning = error.message || "Audio upload failed; saving list without audio.";
    }

    const wordEntries = extractWordEntries(sentences);
    const wordList = await createAudioWordList(session.user.id, {
      name,
      audioKey,
      audioFileName: file.name || null,
      sentences,
      storyMetadata,
      wordEntries,
    });

    return NextResponse.json(
      {
        ...serializeListMeta(wordList),
        warning,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, field: error.field },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to save imported list" },
      { status: 500 },
    );
  }
}
