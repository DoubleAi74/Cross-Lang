"use client";

export default function FeedbackPanel({ answerRecord, correctAnswer }) {
  if (!answerRecord) {
    return (
      <div className="rounded-[1.5rem] border border-ink/10 bg-white/70 px-4 py-4 text-sm text-ink/65">
        Tap the English sentence that matches the Hindi prompt. Your first
        choice locks in the answer for that round.
      </div>
    );
  }

  return (
    <div
      className={`rounded-[1.5rem] border px-4 py-4 ${
        answerRecord.isCorrect
          ? "border-forest/20 bg-forest/10 text-forest"
          : "border-coral/20 bg-coral/10 text-coral"
      }`}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.24em]">
        {answerRecord.isCorrect ? "Correct" : "Not quite"}
      </p>
      <p className="mt-2 text-sm font-medium">
        {answerRecord.isCorrect
          ? "Nice read. You're ready for the next sentence."
          : `The correct answer was: "${correctAnswer}"`}
      </p>
    </div>
  );
}
