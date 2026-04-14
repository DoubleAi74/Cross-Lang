import { NextResponse } from "next/server";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { MAX_LISTS_PER_USER } from "@/lib/constants";
import { extractWordEntries } from "@/lib/import/word-extraction";
import { serializeListMeta } from "@/lib/lists/serializers";
import { countUserLists, createAudioWordList } from "@/lib/lists/service";
import { isOwnedAudioKey } from "@/lib/storage/r2";
import { ValidationError } from "@/lib/lists/validators";

export const runtime = "nodejs";

export async function POST(request) {
  const sessionUser = await getRequestSessionUser(request);

  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const listCount = await countUserLists(sessionUser.id);

    if (listCount >= MAX_LISTS_PER_USER) {
      return NextResponse.json(
        { error: `List limit reached (${MAX_LISTS_PER_USER})` },
        { status: 409 },
      );
    }

    const body = await request.json();
    const audioKey = String(body?.audioKey || "").trim();
    const audioFileName = String(body?.audioFileName || "").trim();
    const name = String(body?.name || "").trim();
    const sentences = Array.isArray(body?.sentences) ? body.sentences : null;
    const storyMetadata = body?.storyMetadata || null;

    if (!name) {
      throw new ValidationError("name", "Name is required");
    }

    if (name.length > 120) {
      throw new ValidationError("name", "Name must be 120 characters or fewer");
    }

    if (!audioKey) {
      throw new ValidationError("audioKey", "Audio key is required");
    }

    if (!isOwnedAudioKey(audioKey, sessionUser.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!Array.isArray(sentences) || !sentences.length) {
      throw new ValidationError("sentences", "Sentences are required");
    }

    const wordEntries = extractWordEntries(sentences);
    const wordList = await createAudioWordList(sessionUser.id, {
      name,
      audioKey,
      audioFileName: audioFileName || null,
      sentences,
      storyMetadata,
      wordEntries,
    });

    return NextResponse.json(
      serializeListMeta(wordList),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

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
