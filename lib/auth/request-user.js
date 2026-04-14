import { getToken } from "next-auth/jwt";

function getAuthSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
}

export async function getRequestSessionUser(request) {
  const token = await getToken({
    req: request,
    secret: getAuthSecret(),
  });

  if (!token?.userId) {
    return null;
  }

  return {
    id: String(token.userId),
    email: token.email || null,
    name: token.name || null,
    username: token.username || null,
  };
}
