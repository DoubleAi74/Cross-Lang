import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { MAX_LISTS_PER_USER } from "@/lib/constants";
import { serializeListMeta } from "@/lib/lists/serializers";
import { countUserLists, createWordList, listWordLists } from "@/lib/lists/service";
import { ValidationError } from "@/lib/lists/validators";

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lists = await listWordLists(session.user.id);
  return NextResponse.json(lists.map(serializeListMeta));
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

    const body = await request.json();
    const wordList = await createWordList(session.user.id, body);

    return NextResponse.json(serializeListMeta(wordList), { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, field: error.field },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to create word list" },
      { status: 500 },
    );
  }
}
