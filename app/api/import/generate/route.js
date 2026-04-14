import { NextResponse } from "next/server";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { generateStoryJson } from "@/lib/import/story-generation";

export const runtime = "nodejs";
export const maxDuration = 300;

function mapProgressPayload(payload) {
  return {
    stage: payload?.mode || "processing",
    message: [payload?.title, payload?.detail].filter(Boolean).join(" "),
    completed: payload?.completed ?? 0,
    total: payload?.total ?? 0,
  };
}

function toStoryMetadata(story) {
  return {
    title: story?.title || null,
    level: story?.level || null,
    storyId: story?.id || null,
  };
}

export async function POST(request) {
  const sessionUser = await getRequestSessionUser(request);

  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const transcript = String(body?.transcript || "").trim();
    const lines = Array.isArray(body?.lines) ? body.lines : [];

    if (!transcript) {
      return NextResponse.json({ error: "Transcript is required" }, { status: 400 });
    }

    if (!lines.length) {
      return NextResponse.json({ error: "Transcript lines are required" }, { status: 400 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const send = (event, data) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        try {
          const result = await generateStoryJson({
            lines,
            onProgress(payload) {
              send("progress", mapProgressPayload(payload));
            },
            onChunkComplete(payload) {
              send("chunk-complete", {
                completedChunks: payload.completedChunks,
                totalChunks: payload.totalChunks,
                sentences: payload.mergedSentences,
              });
            },
          });

          send("complete", {
            sentences: result.sentences,
            storyMetadata: toStoryMetadata(result.story),
          });
        } catch (error) {
          send("error", {
            message: error.message || "Failed to generate translations",
          });
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

    return NextResponse.json(
      { error: error.message || "Failed to start generation" },
      { status: 500 },
    );
  }
}
