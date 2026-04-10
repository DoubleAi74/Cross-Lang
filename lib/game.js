import { shuffle } from "@/lib/utils";

export function buildQuestionOptions(sentence) {
  return {
    questionNumber: sentence.nm,
    devanagari: sentence.dv,
    romanised_hindi: sentence.rm,
    correctAnswer: sentence.en,
    options: shuffle([sentence.en, ...sentence.sim]),
  };
}

function getQuestionByNumber(level, questionNumber) {
  return (
    level.questions.find((question) => question.questionNumber === questionNumber) ||
    null
  );
}

function getAnswerForQuestion(level, questionNumber) {
  return (
    level.answers.find((item) => item.questionNumber === questionNumber) || null
  );
}

export function buildLevelState(
  sentenceSet,
  previousLevelSentences = null,
  wordCount = 0,
  displayWordSet = null,
) {
  return {
    wordCount,
    sentences: sentenceSet.sentences,
    questions: sentenceSet.sentences.map(buildQuestionOptions),
    answers: [],
    isComplete: false,
    previousLevelSentences,
    displayWordSet,
    nextAction: null,
    nextWordSet: null,
  };
}

export function submitAnswer(level, questionNumber, selectedOption) {
  const currentQuestion = getQuestionByNumber(level, questionNumber);

  if (!currentQuestion) {
    return { level, didUpdate: false };
  }

  const existingAnswer = getAnswerForQuestion(level, currentQuestion.questionNumber);

  if (existingAnswer) {
    return { level, didUpdate: false };
  }

  const answers = [
    ...level.answers,
    {
      questionNumber: currentQuestion.questionNumber,
      selectedOption,
      correctOption: currentQuestion.correctAnswer,
      isCorrect: selectedOption === currentQuestion.correctAnswer,
    },
  ];
  const isComplete = answers.length >= level.questions.length;

  const nextLevel = {
    ...level,
    answers,
    isComplete,
    previousLevelSentences: isComplete
      ? { sentences: level.sentences }
      : level.previousLevelSentences,
  };

  return {
    level: isComplete
      ? {
          ...nextLevel,
          previousLevelSentences: { sentences: level.sentences },
        }
      : nextLevel,
    didUpdate: true,
  };
}

export function completeLevel(level) {
  if (level.isComplete || !level.questions.length) {
    return { level, didUpdate: false };
  }

  return {
    level: {
      ...level,
      isComplete: true,
      previousLevelSentences: { sentences: level.sentences },
    },
    didUpdate: true,
  };
}
