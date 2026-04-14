import { NextResponse } from "next/server";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { deleteAudioObject, isOwnedAudioKey } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function POST(request) {
  const sessionUser = await getRequestSessionUser(request);

  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const audioKey = String(body?.audioKey || "").trim();

    if (!audioKey) {
      return NextResponse.json({ error: "Audio key is required" }, { status: 400 });
    }

    if (!isOwnedAudioKey(audioKey, sessionUser.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteAudioObject(audioKey);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error.message || "Failed to clean up audio" },
      { status: 500 },
    );
  }
}
