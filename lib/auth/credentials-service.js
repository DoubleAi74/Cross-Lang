import connectMongoose from "@/lib/db/mongoose";
import UserCredential from "@/models/UserCredential";
import { hashPassword, verifyPassword } from "@/lib/auth/passwords";
import clientPromise from "@/lib/db/mongodb";

function validateRegistrationInput(email, password) {
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    throw new Error("Invalid email address");
  }

  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  if (password.length > 72) {
    throw new Error("Password must be at most 72 characters");
  }
}

async function createAuthUser(email) {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const users = db.collection("users");
  const result = await users.insertOne({
    email: email.toLowerCase(),
    emailVerified: null,
    createdAt: new Date(),
  });

  return result.insertedId;
}

export async function registerWithCredentials(email, password) {
  validateRegistrationInput(email, password);
  await connectMongoose();

  const existing = await UserCredential.findOne({ email: email.toLowerCase() });

  if (existing) {
    throw Object.assign(new Error("Email already registered"), {
      code: "EMAIL_EXISTS",
    });
  }

  const userId = await createAuthUser(email);
  const passwordHash = await hashPassword(password);
  await UserCredential.create({
    userId,
    email: email.toLowerCase(),
    passwordHash,
  });

  return { id: userId.toString(), email: email.toLowerCase() };
}

export async function loginWithCredentials(email, password) {
  await connectMongoose();
  const credential = await UserCredential.findOne({ email: email.toLowerCase() });

  if (!credential) {
    throw new Error("Invalid email or password");
  }

  const valid = await verifyPassword(password, credential.passwordHash);

  if (!valid) {
    throw new Error("Invalid email or password");
  }

  return { id: credential.userId.toString(), email: credential.email };
}
