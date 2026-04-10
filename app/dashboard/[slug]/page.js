import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import ListDetailPage from "@/components/dashboard/ListDetailPage";
import { serializeList } from "@/lib/lists/serializers";
import { getWordListByUserSlug } from "@/lib/lists/service";
import { getSignedAudioUrl } from "@/lib/storage/r2";

export default async function WordListDetailRoute({ params }) {
  const { slug } = await params;
  const session = await auth();

  if (!session) {
    redirect(`/login?callbackUrl=/dashboard/${slug}`);
  }

  let serializedList = null;

  try {
    const wordList = await getWordListByUserSlug(session.user.id, slug);
    const audioUrl = await getSignedAudioUrl(wordList.audioKey);
    serializedList = serializeList(wordList, { audioUrl });
  } catch (error) {
    if (error.code === "FORBIDDEN") {
      redirect("/dashboard");
    }

    if (error.code === "NOT_FOUND") {
      notFound();
    }

    throw error;
  }

  return <ListDetailPage list={serializedList} isOwner />;
}
