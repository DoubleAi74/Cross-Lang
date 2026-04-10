import { NextResponse } from "next/server";
import { confirmPasswordReset } from "@/lib/auth/password-reset-service";

export async function POST(request) {
  try {
    const { token, password } = await request.json();
    const result = await confirmPasswordReset(token, password);
    return NextResponse.json({ ok: true, email: result.email });
  } catch (error) {
    if (
      error.message.includes("invalid") ||
      error.message.includes("expired") ||
      error.message.includes("Password")
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
