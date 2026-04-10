import { notFound } from "next/navigation";
import { auth } from "@/auth";
import ListDetailPage from "@/components/dashboard/ListDetailPage";
import PublicListDetail from "@/components/dashboard/PublicListDetail";
import { serializeList, serializePublicList } from "@/lib/lists/serializers";
import { getWordList, getWordListBySlug } from "@/lib/lists/service";
import { getSignedAudioUrl } from "@/lib/storage/r2";

export default async function PublicListDetailRoute({ params }) {
  const { username, slug } = await params;
  const [wordList, session] = await Promise.all([
    getWordListBySlug(username, slug),
    auth(),
  ]);

  if (!wordList) {
    notFound();
  }

  const isOwner = session?.user?.id === String(wordList.userId);

  if (isOwner) {
    const ownedWordList = await getWordList(String(wordList._id), session.user.id);
    const audioUrl = await getSignedAudioUrl(ownedWordList.audioKey);
    return <ListDetailPage list={serializeList(ownedWordList, { audioUrl })} isOwner />;
  }

  const audioUrl = await getSignedAudioUrl(wordList.audioKey);

  return (
    <PublicListDetail
      list={serializePublicList(wordList, { audioUrl })}
      username={username}
    />
  );
}
