import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { transcribeAudioFile } from "@/lib/import/transcription";

const MAX_AUDIO_FILE_SIZE = 25 * 1024 * 1024;

export async function POST(request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
    }

    if (typeof file.size === "number" && file.size > MAX_AUDIO_FILE_SIZE) {
      return NextResponse.json(
        { error: "Audio file must be 25MB or smaller" },
        { status: 400 },
      );
    }

    const transcript = await transcribeAudioFile(file);
    const wordCount = transcript.lines.reduce((total, line) => {
      return total + String(line.text || "").split(/\s+/).filter(Boolean).length;
    }, 0);

    return NextResponse.json({
      transcript: transcript.text,
      lines: transcript.lines,
      lineCount: transcript.lines.length,
      wordCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to transcribe audio" },
      { status: 500 },
    );
  }
}
