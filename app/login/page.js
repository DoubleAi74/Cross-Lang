import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LoginForm from "@/components/auth/LoginForm";

export default async function LoginPage({ searchParams }) {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  const { callbackUrl } = await searchParams;

  return (
    <div className="min-h-[calc(100vh-4.5rem)] px-6 py-16">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-forest/80">
            Cross-Lang
          </p>
          <h1 className="max-w-xl text-5xl leading-tight sm:text-6xl">
            Sign in to continue your Hindi practice.
          </h1>
          <p className="max-w-lg text-lg leading-8 text-ink/70">
            Use your email and password or request a magic link. New accounts get a
            shareable username automatically.
          </p>
        </div>
        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </div>
  );
}
