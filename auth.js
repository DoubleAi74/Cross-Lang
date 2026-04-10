import NextAuth from "next-auth";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import clientPromise from "@/lib/db/mongodb";
import { loginWithCredentials } from "@/lib/auth/credentials-service";
import { ensureUsername } from "@/lib/auth/users";

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          return await loginWithCredentials(
            credentials?.email || "",
            credentials?.password || "",
          );
        } catch {
          return null;
        }
      },
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.AUTH_EMAIL_FROM,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.username = await ensureUsername(user.id, user.email);
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.username = token.username ?? null;
      return session;
    },
  },
});
