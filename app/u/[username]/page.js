import { notFound } from "next/navigation";
import { auth } from "@/auth";
import PublicProfile from "@/components/dashboard/PublicProfile";
import clientPromise from "@/lib/db/mongodb";
import { serializeListMeta } from "@/lib/lists/serializers";
import { listWordLists } from "@/lib/lists/service";

async function getUserByUsername(username) {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  return db.collection("users").findOne({ username });
}

export default async function PublicProfileRoute({ params }) {
  const { username } = await params;
  const [user, session] = await Promise.all([getUserByUsername(username), auth()]);

  if (!user) {
    notFound();
  }

  const lists = await listWordLists(String(user._id));
  const serializedLists = lists.map(serializeListMeta);
  const isOwner = session?.user?.id === String(user._id);

  return (
    <PublicProfile
      lists={serializedLists}
      username={username}
      isOwner={isOwner}
    />
  );
}
