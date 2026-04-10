import { ensureUsername, getUserById } from "@/lib/auth/users";

export async function buildSessionUser(userId) {
  const user = await getUserById(userId);

  if (!user) {
    return null;
  }

  const username = await ensureUsername(userId, user.email);

  return {
    id: userId.toString(),
    email: user.email,
    name: user.name || null,
    username,
  };
}
