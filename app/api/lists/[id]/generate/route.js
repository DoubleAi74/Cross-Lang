import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { serializeError } from "@/lib/errors";
import { generateLevel, resolveWordSet } from "@/lib/generation/service";
import { serializeList } from "@/lib/lists/serializers";
import { getWordList, updateSession } from "@/lib/lists/service";

export async function POST(request, { params }) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const wordList = await getWordList(id, session.user.id);
    const body = await request.json();
    const action = body?.action;
    const count = body?.count;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const send = (event, data) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        try {
          send("progress", {
            stage: "words",
            message: "Preparing word set...",
          });

          const resolvedWordSet = await resolveWordSet(wordList, action, count);

          send("word-set", {
            currentWordSet: resolvedWordSet.word_set,
          });

          const levelResult = await generateLevel(wordList, {
            action,
            count,
            nextWordSet: resolvedWordSet,
            onProgress(payload) {
              send("progress", payload);
            },
          });

          send("progress", {
            stage: "saving",
            message: "Saving...",
          });

          const savedWordList = await updateSession(id, session.user.id, {
            levelNumber: levelResult.levelNumber,
            currentLevel: levelResult.currentLevel,
            previousLevel: levelResult.previousLevel,
            previousLevelSentences: levelResult.previousLevelSentences,
            currentWordSet: levelResult.nextWordSet,
          });
          const serialized = serializeList(savedWordList);

          send("complete", {
            levelNumber: serialized.session.levelNumber,
            currentLevel: serialized.session.currentLevel,
            previousLevel: serialized.session.previousLevel,
            currentWordSet: serialized.currentWordSet,
            previousLevelSentences: serialized.session.previousLevelSentences,
          });
        } catch (error) {
          send("error", serializeError(error, "generation"));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (error.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Word list not found" }, { status: 404 });
    }

    if (error.code === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to start generation" },
      { status: 500 },
    );
  }
}
