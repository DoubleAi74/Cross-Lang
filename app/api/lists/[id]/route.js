import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { serializeList, serializeListMeta } from "@/lib/lists/serializers";
import { getSignedAudioUrl } from "@/lib/storage/r2";
import {
  deleteWordList,
  getWordList,
  updateWordList,
} from "@/lib/lists/service";
import { ValidationError } from "@/lib/lists/validators";

export async function GET(request, { params }) {
  void request;

  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const wordList = await getWordList(id, session.user.id);
    const audioUrl = await getSignedAudioUrl(wordList.audioKey);
    return NextResponse.json(serializeList(wordList, { audioUrl }));
  } catch (error) {
    if (error.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Word list not found" }, { status: 404 });
    }

    if (error.code === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to fetch word list" },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const wordList = await updateWordList(id, session.user.id, body);
    return NextResponse.json(serializeListMeta(wordList));
  } catch (error) {
    if (error.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Word list not found" }, { status: 404 });
    }

    if (error.code === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, field: error.field },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update word list" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  void request;

  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await deleteWordList(id, session.user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Word list not found" }, { status: 404 });
    }

    if (error.code === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to delete word list" },
      { status: 500 },
    );
  }
}
