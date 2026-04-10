import PasswordResetForm from "@/components/auth/PasswordResetForm";

export default async function ResetPasswordPage({ searchParams }) {
  const { token, email } = await searchParams;

  return (
    <div className="min-h-[calc(100vh-4.5rem)] px-6 py-16">
      <div className="mx-auto flex max-w-4xl justify-center">
        <PasswordResetForm token={token} email={email} />
      </div>
    </div>
  );
}
