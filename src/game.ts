export interface Question {
  a: number;
  b: number;
  answer: number;
  choices: number[];
}

export interface GameState {
  score: number;
  streak: number;
  bestStreak: number;
  lives: number;
  level: number;
  questionsAnswered: number;
  questionsCorrect: number;
  questionsCorrectThisLevel: number;
  wrongAnswers: Map<string, number>;
  currentQuestion: Question | null;
  phase: 'playing' | 'correct' | 'wrong' | 'levelup' | 'gameover' | 'victory';
  wrongChoiceIndex: number | null;
  hintActive: boolean;
  wrongsThisLevel: number;
  starsPerLevel: number[];
}

const LIVES = 3;
export const QUESTIONS_PER_LEVEL = 10;
export const MAX_LEVEL = 5;
export const TIMER_SECS = 10;

export const CHOICES_PER_LEVEL: Record<number, number> = {
  1: 4,  // 2×2
  2: 4,  // 2×2
  3: 6,  // 2×3
  4: 6,  // 2×3
  5: 9,  // 3×3
};

const LEVEL_TABLES: Record<number, number[]> = {
  1: [1, 2, 5, 10],
  2: [1, 2, 3, 4, 5, 10],
  3: [1, 2, 3, 4, 5, 6, 7, 10],
  4: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  5: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
};

export function initialState(): GameState {
  return {
    score: 0,
    streak: 0,
    bestStreak: 0,
    lives: LIVES,
    level: 1,
    questionsAnswered: 0,
    questionsCorrect: 0,
    questionsCorrectThisLevel: 0,
    wrongAnswers: new Map(),
    currentQuestion: null,
    phase: 'playing',
    wrongChoiceIndex: null,
    hintActive: false,
    wrongsThisLevel: 0,
    starsPerLevel: [],
  };
}

export function calcStars(wrongs: number): number {
  if (wrongs === 0) return 3;
  if (wrongs <= 2) return 2;
  return 1;
}

// Points for a correct answer: 100 at 0ms, decays linearly to 10 at TIMER_SECS.
// Streak multiplier: +10% per streak step, capped at 2×.
export function timerScore(elapsedMs: number, streak: number): { points: number; label: string } {
  const ratio = Math.max(0, 1 - elapsedMs / (TIMER_SECS * 1000));
  const base = Math.round(10 + 90 * ratio);
  const multiplier = 1 + Math.min(streak, 10) * 0.1;
  const points = Math.round(base * multiplier);
  const label = ratio > 0.7 ? '⚡ Turbo!' : ratio > 0.4 ? '🚀 Snel!' : '';
  return { points, label };
}

export const HIGHSCORE_KEY = 'maaltafels_highscore';

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function generateQuestion(state: GameState): Question {
  const tables = LEVEL_TABLES[state.level];
  const pairs: [number, number][] = [];
  const weights: number[] = [];

  for (const a of tables) {
    for (let b = 1; b <= 10; b++) {
      const key = `${Math.min(a, b)}x${Math.max(a, b)}`;
      const wrongCount = state.wrongAnswers.get(key) ?? 0;
      pairs.push([a, b]);
      weights.push(1 + wrongCount * 3);
    }
  }

  const [a, b] = weightedPick(pairs, weights);
  const answer = a * b;

  const numChoices = CHOICES_PER_LEVEL[state.level] ?? 4;
  const numWrong = numChoices - 1;

  const wrongChoices = new Set<number>();
  const candidates = [
    answer + randomInt(1, 3),
    answer - randomInt(1, 3),
    answer + randomInt(4, 9),
    answer - randomInt(4, 9),
    (a + 1) * b,
    a * (b + 1),
    (a - 1) * b,
    a * (b - 1),
    answer + randomInt(10, 20),
    answer - randomInt(10, 20),
  ];

  for (const w of candidates) {
    if (w > 0 && w !== answer && w <= 100) wrongChoices.add(w);
    if (wrongChoices.size >= numWrong) break;
  }

  while (wrongChoices.size < numWrong) {
    const candidate = randomInt(Math.max(1, answer - 20), Math.min(100, answer + 20));
    if (candidate !== answer) wrongChoices.add(candidate);
  }

  const choices = [answer, ...Array.from(wrongChoices).slice(0, numWrong)];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  return { a, b, answer, choices };
}

export function answerQuestion(
  state: GameState,
  choiceIndex: number,
  elapsedMs: number,
): { newState: GameState; correct: boolean; pointsEarned: number; label: string } {
  const q = state.currentQuestion!;
  const chosen = q.choices[choiceIndex];
  const correct = chosen === q.answer;
  const key = `${Math.min(q.a, q.b)}x${Math.max(q.a, q.b)}`;
  const newState = { ...state, wrongAnswers: new Map(state.wrongAnswers) };

  let pointsEarned = 0;
  let label = '';

  if (correct) {
    const { points, label: speedLabel } = timerScore(elapsedMs, state.streak);
    pointsEarned = points;
    label = speedLabel;

    newState.score = state.score + pointsEarned;
    newState.streak = state.streak + 1;
    newState.bestStreak = Math.max(newState.streak, state.bestStreak);
    newState.questionsAnswered = state.questionsAnswered + 1;
    newState.questionsCorrect = state.questionsCorrect + 1;
    newState.questionsCorrectThisLevel = state.questionsCorrectThisLevel + 1;
    newState.wrongChoiceIndex = null;
    newState.hintActive = false;

    if (newState.wrongAnswers.has(key)) {
      const count = newState.wrongAnswers.get(key)! - 1;
      if (count <= 0) newState.wrongAnswers.delete(key);
      else newState.wrongAnswers.set(key, count);
    }

    if (newState.questionsCorrectThisLevel >= QUESTIONS_PER_LEVEL) {
      newState.phase = state.level >= MAX_LEVEL ? 'victory' : 'levelup';
    } else {
      newState.phase = 'correct';
    }
  } else {
    newState.streak = 0;
    newState.lives = state.lives - 1;
    newState.questionsAnswered = state.questionsAnswered + 1;
    newState.wrongChoiceIndex = choiceIndex;
    newState.wrongAnswers.set(key, (state.wrongAnswers.get(key) ?? 0) + 1);
    newState.wrongsThisLevel = state.wrongsThisLevel + 1;
    newState.hintActive = true;
    newState.phase = newState.lives <= 0 ? 'gameover' : 'wrong';
  }

  return { newState, correct, pointsEarned, label };
}

export function advanceLevel(state: GameState): GameState {
  const stars = [...state.starsPerLevel, calcStars(state.wrongsThisLevel)];
  return {
    ...state,
    level: Math.min(state.level + 1, MAX_LEVEL),
    phase: 'playing',
    hintActive: false,
    wrongChoiceIndex: null,
    wrongsThisLevel: 0,
    questionsCorrectThisLevel: 0,
    starsPerLevel: stars,
  };
}

export const LEVEL_NAMES: Record<number, string> = {
  1: 'Ruimte Cadet',
  2: 'Sterrenpiloot',
  3: 'Planeetrider',
  4: 'Sterrenstrijder',
  5: 'Galactisch Meester',
};
