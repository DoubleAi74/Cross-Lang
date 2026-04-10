import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { auth } from "@/auth";
import NavbarVisibility from "@/components/NavbarVisibility";
import { buildSessionUser } from "@/lib/auth/session-user";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-fraunces",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

export const metadata = {
  title: "Cross-Lang",
  description: "Cross-Lang application scaffold",
};

export default async function RootLayout({ children }) {
  const session = await auth();
  const sessionUser = session?.user?.id
    ? await buildSessionUser(session.user.id)
    : null;

  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable}`}>
      <body>
        <NavbarVisibility sessionUser={sessionUser} />
        <main>{children}</main>
      </body>
    </html>
  );
}
