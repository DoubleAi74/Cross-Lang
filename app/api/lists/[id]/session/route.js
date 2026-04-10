import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { serializeList } from "@/lib/lists/serializers";
import { updateSession } from "@/lib/lists/service";
import { ValidationError } from "@/lib/lists/validators";

export async function PATCH(request, { params }) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const wordList = await updateSession(id, session.user.id, body);
    const serialized = serializeList(wordList);

    return NextResponse.json({
      session: serialized.session,
      currentWordSet: serialized.currentWordSet,
    });
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
      { error: "Failed to update session" },
      { status: 500 },
    );
  }
}
