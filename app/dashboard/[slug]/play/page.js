import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import GameplayPage from "@/components/gameplay/GameplayPage";
import { getWordListByUserSlug } from "@/lib/lists/service";

export default async function GameplayRoute({ params }) {
  const session = await auth();
  const { slug } = await params;

  if (!session) {
    redirect(`/login?callbackUrl=/dashboard/${slug}/play`);
  }

  let wordList = null;

  try {
    wordList = await getWordListByUserSlug(session.user.id, slug);
  } catch (error) {
    if (error.code === "FORBIDDEN") {
      redirect("/dashboard");
    }

    if (error.code === "NOT_FOUND") {
      notFound();
    }

    throw error;
  }

  return <GameplayPage listId={String(wordList._id)} listSlug={wordList.slug} />;
}
