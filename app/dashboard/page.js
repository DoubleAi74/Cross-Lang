import { redirect } from "next/navigation";
import { auth } from "@/auth";
import CreateListModal from "@/components/dashboard/CreateListModal";
import WordListGrid from "@/components/dashboard/WordListGrid";
import { serializeListMeta } from "@/lib/lists/serializers";
import { listWordLists } from "@/lib/lists/service";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const lists = await listWordLists(session.user.id);
  const serializedLists = lists.map(serializeListMeta);

  return (
    <div className="min-h-[calc(100vh-4.5rem)] px-6 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-7xl space-y-10">
        <section className="page-enter grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-forest/75">
              Dashboard
            </p>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-5xl leading-tight sm:text-6xl">
                My Word Lists
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-ink/66">
                Build focused Hindi decks, import vocabulary from songs, and
                jump into quizzes or sentence generation from a single home
                base.
              </p>
            </div>
          </div>

          <CreateListModal initialCount={serializedLists.length} />
        </section>

        <WordListGrid
          lists={serializedLists}
          username={session.user.username || session.user.email?.split("@")[0]}
        />
      </div>
    </div>
  );
}
