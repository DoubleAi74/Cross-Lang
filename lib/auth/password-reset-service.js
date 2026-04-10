import crypto from "crypto";
import { Resend } from "resend";
import connectMongoose from "@/lib/db/mongoose";
import PasswordResetToken from "@/models/PasswordResetToken";
import UserCredential from "@/models/UserCredential";
import { getUserByEmail } from "@/lib/auth/users";
import { hashPassword } from "@/lib/auth/passwords";

const TOKEN_EXPIRY_MS = 60 * 60 * 1000;

export async function requestPasswordReset(email) {
  await connectMongoose();
  const user = await getUserByEmail(email);

  if (!user) {
    return { ok: true };
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

  await PasswordResetToken.deleteMany({ userId: user._id });
  await PasswordResetToken.create({
    userId: user._id,
    email: email.toLowerCase(),
    tokenHash,
    expiresAt,
  });

  const resetUrl = `${process.env.AUTH_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;
  const resend = new Resend(process.env.AUTH_RESEND_KEY);

  await resend.emails.send({
    from: process.env.AUTH_EMAIL_FROM,
    to: email,
    subject: "Reset your password",
    html: `<p>Click the link below to reset your password. It expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  });

  return { ok: true };
}

export async function confirmPasswordReset(token, newPassword) {
  if (!newPassword || newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  if (newPassword.length > 72) {
    throw new Error("Password must be at most 72 characters");
  }

  await connectMongoose();
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const record = await PasswordResetToken.findOne({ tokenHash });

  if (!record || record.expiresAt < new Date()) {
    throw new Error("Token is invalid or expired");
  }

  const passwordHash = await hashPassword(newPassword);

  await UserCredential.findOneAndUpdate(
    { userId: record.userId },
    { $set: { passwordHash, email: record.email } },
    { upsert: true },
  );

  await PasswordResetToken.deleteOne({ _id: record._id });

  return { ok: true, email: record.email };
}
