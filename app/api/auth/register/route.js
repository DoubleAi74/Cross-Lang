import { NextResponse } from "next/server";
import { registerWithCredentials } from "@/lib/auth/credentials-service";

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    const user = await registerWithCredentials(email, password);
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (error) {
    if (error.code === "EMAIL_EXISTS") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (
      error.message.includes("Invalid") ||
      error.message.includes("Password")
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
