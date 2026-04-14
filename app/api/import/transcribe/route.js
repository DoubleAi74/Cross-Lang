import { NextResponse } from "next/server";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { transcribeStoredAudio } from "@/lib/import/transcription";
import { isOwnedAudioKey } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request) {
  const sessionUser = await getRequestSessionUser(request);

  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const audioKey = String(body?.audioKey || "").trim();
    const fileName = String(body?.fileName || "").trim() || "audio.mp3";

    if (!audioKey) {
      return NextResponse.json({ error: "Audio key is required" }, { status: 400 });
    }

    if (!isOwnedAudioKey(audioKey, sessionUser.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const abortController = new AbortController();
        let closed = false;

        const close = () => {
          if (closed) {
            return;
          }

          closed = true;
          controller.close();
        };

        const send = (event, data) => {
          if (closed) {
            return;
          }

          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        const handleAbort = () => {
          abortController.abort();
        };

        request.signal.addEventListener("abort", handleAbort);

        send("progress", {
          stage: "starting",
          message: "Starting transcription...",
        });

        try {
          const transcript = await transcribeStoredAudio({
            audioKey,
            fileName,
            signal: abortController.signal,
            onProgress(payload) {
              send("progress", payload);
            },
            onDelta(delta, text) {
              send("delta", { delta, text });
            },
          });
          const wordCount = transcript.lines.reduce((total, line) => {
            return total + String(line.text || "").split(/\s+/).filter(Boolean).length;
          }, 0);

          send("complete", {
            transcript: transcript.text,
            lines: transcript.lines,
            lineCount: transcript.lines.length,
            wordCount,
          });
        } catch (error) {
          if (error?.name !== "AbortError" && !request.signal.aborted) {
            send("error", {
              message: error.message || "Failed to transcribe audio",
            });
          }
        } finally {
          request.signal.removeEventListener("abort", handleAbort);
          close();
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
      { error: error.message || "Failed to transcribe audio" },
      { status: 500 },
    );
  }
}
