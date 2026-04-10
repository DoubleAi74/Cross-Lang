import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureUsername, updateUsername } from "@/lib/auth/users";

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const username = await ensureUsername(session.user.id, session.user.email);
  return NextResponse.json({ username });
}

export async function PATCH(request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { username } = await request.json();
    const updated = await updateUsername(session.user.id, username);
    return NextResponse.json({ username: updated });
  } catch (error) {
    if (error.code === "USERNAME_TAKEN") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error.code === "INVALID_USERNAME") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
