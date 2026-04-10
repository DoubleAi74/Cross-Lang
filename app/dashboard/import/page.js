import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ImportWizard from "@/components/import/ImportWizard";
import { MAX_LISTS_PER_USER } from "@/lib/constants";
import { countUserLists } from "@/lib/lists/service";

export default async function ImportPage() {
  const session = await auth();

  if (!session) {
    redirect("/login?callbackUrl=/dashboard/import");
  }

  const listCount = await countUserLists(session.user.id);
  const atLimit = listCount >= MAX_LISTS_PER_USER;

  return <ImportWizard atLimit={atLimit} />;
}
