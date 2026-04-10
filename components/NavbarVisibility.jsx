"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";

function shouldHideNavbar(pathname) {
  return /^\/dashboard\/[^/]+\/play(?:\/|$)/.test(pathname || "");
}

export default function NavbarVisibility({ sessionUser }) {
  const pathname = usePathname();

  if (shouldHideNavbar(pathname)) {
    return null;
  }

  return <Navbar sessionUser={sessionUser} />;
}
