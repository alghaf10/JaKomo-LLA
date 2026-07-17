// Step-type registry for LessonScreen. Maps step.type -> renderer component,
// replacing the old inline ternary (where 'quiz' was the implicit fall-through).
import WordStep from './WordStep';
import TeachStep from './TeachStep';
import QuizStep from './QuizStep';
import ListenStep from './ListenStep';
import FillStep from './FillStep';
import BuildStep from './BuildStep';
import SpeakStep from './SpeakStep';
import MatchStep from './MatchStep';

export const STEP_COMPONENTS = {
  word: WordStep,
  teach: TeachStep,
  quiz: QuizStep,
  listen: ListenStep,
  fill: FillStep,
  build: BuildStep,
  speak: SpeakStep,
  match: MatchStep,
};

// Steps that produce a right/wrong result and count toward the score.
// 'word' and 'teach' are presentation-only.
export const GRADABLE_TYPES = new Set(['quiz', 'listen', 'fill', 'build', 'speak', 'match']);

export const isGradable = (step) => !!step && GRADABLE_TYPES.has(step.type);
