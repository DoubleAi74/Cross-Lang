import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/auth/password-reset-service";

export async function POST(request) {
  try {
    const { email } = await request.json();
    await requestPasswordReset(email);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
