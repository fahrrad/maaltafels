import './style.css';
import {
  initialState,
  generateQuestion,
  answerQuestion,
  advanceLevel,
  calcStars,
  LEVEL_NAMES,
  QUESTIONS_PER_LEVEL,
  CHOICES_PER_LEVEL,
  MAX_LEVEL,
  TIMER_SECS,
  HIGHSCORE_KEY,
  type GameState,
} from './game';

let state: GameState = initialState();
let questionStartTime = 0;
let timerInterval: ReturnType<typeof setInterval> | null = null;

const CORRECT_EMOJIS = ['⭐', '🌟', '✨', '💫', '🚀', '🛸', '🪐', '🌙', '☄️', '🌠'];
const WRONG_EMOJIS = ['💥', '🌑', '😬'];
const CELEBRATION_EMOJIS = ['🎉', '🥳', '⭐', '🌟', '🚀', '🛸', '🏆', '💫', '✨', '🪐'];

// ── Persistence ───────────────────────────────────────────────────────────────
function loadHighScore(): number {
  return parseInt(localStorage.getItem(HIGHSCORE_KEY) ?? '0', 10) || 0;
}
function saveHighScore(score: number) {
  if (score > loadHighScore()) localStorage.setItem(HIGHSCORE_KEY, String(score));
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function startTimer() {
  stopTimer();
  questionStartTime = Date.now();
  timerInterval = setInterval(updateTimerUI, 80);
}

function stopTimer() {
  if (timerInterval !== null) { clearInterval(timerInterval); timerInterval = null; }
}

function elapsedMs() { return Date.now() - questionStartTime; }

function updateTimerUI() {
  const bar = document.getElementById('timer-bar');
  if (!bar) { stopTimer(); return; }
  const remaining = Math.max(0, 1 - elapsedMs() / (TIMER_SECS * 1000));
  bar.style.width = `${remaining * 100}%`;
  if (remaining > 0.6) {
    bar.style.background = 'linear-gradient(90deg,#4ade80,#22c55e)';
  } else if (remaining > 0.3) {
    bar.style.background = 'linear-gradient(90deg,#fbbf24,#f59e0b)';
  } else {
    bar.style.background = 'linear-gradient(90deg,#f87171,#ef4444)';
  }
  if (remaining === 0) handleTimeout();
}

function handleTimeout() {
  if (state.phase !== 'playing') return;
  stopTimer();

  const q = state.currentQuestion!;
  const key = `${Math.min(q.a, q.b)}x${Math.max(q.a, q.b)}`;
  const newWrong = new Map(state.wrongAnswers);
  newWrong.set(key, (newWrong.get(key) ?? 0) + 1);
  const newLives = state.lives - 1;

  state = {
    ...state,
    lives: newLives,
    streak: 0,
    wrongAnswers: newWrong,
    wrongsThisLevel: state.wrongsThisLevel + 1,
    questionsAnswered: state.questionsAnswered + 1,
    wrongChoiceIndex: null,   // null = timeout (no button tapped)
    hintActive: false,
    phase: newLives <= 0 ? 'gameover' : 'wrong',
  };

  if (state.phase === 'gameover') { render(); return; }

  render();

  // Highlight the correct answer and lock all buttons
  const correctIdx = q.choices.indexOf(q.answer);
  const correctBtn = document.querySelector<HTMLButtonElement>(`[data-index="${correctIdx}"]`);
  if (correctBtn) correctBtn.classList.add('correct');
  document.querySelectorAll<HTMLButtonElement>('.keypad-btn').forEach(b => { b.disabled = true; });
  spawnParticles(window.innerWidth / 2, window.innerHeight / 2, ['💥', '⏰', '🌑'], 4);

  // Auto-advance after showing the answer briefly
  setTimeout(() => {
    state = { ...state, phase: 'playing', currentQuestion: generateQuestion(state) };
    render();
  }, 1500);
}

// ── Stars ─────────────────────────────────────────────────────────────────────
function starsHtml(count: number, size = 'text-2xl'): string {
  return Array.from({ length: 3 }, (_, i) =>
    `<span class="${size} transition-all ${i < count ? 'opacity-100' : 'opacity-20 grayscale'}">⭐</span>`
  ).join('');
}

// ── Visual FX ─────────────────────────────────────────────────────────────────
function createStars() {
  const container = document.getElementById('star-canvas');
  if (!container) return;
  for (let i = 0; i < 70; i++) {
    const star = document.createElement('div');
    const size = Math.random() * 2.5 + 1;
    star.style.cssText = `
      position:absolute;left:${Math.random()*100}%;top:${Math.random()*100}%;
      width:${size}px;height:${size}px;background:white;border-radius:50%;
      animation:twinkle ${Math.random()*3+1.5}s ${Math.random()*4}s ease-in-out infinite;
      opacity:${Math.random()*0.7+0.2};
    `;
    container.appendChild(star);
  }
}

function spawnParticles(x: number, y: number, emojis: string[], count = 6) {
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'star-particle';
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 80 + 30;
    el.style.cssText = `position:fixed;left:${x}px;top:${y}px;font-size:1.6rem;pointer-events:none;z-index:9999;`;
    document.body.appendChild(el);
    el.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(angle)*dist}px),calc(-50% + ${Math.sin(angle)*dist-70}px)) scale(1.6)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 500, easing: 'ease-out', fill: 'forwards' }).onfinish = () => el.remove();
  }
}

function showFloatingText(x: number, y: number, text: string, color: string) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `position:fixed;left:${x}px;top:${y}px;font-size:1.4rem;font-weight:900;color:${color};pointer-events:none;z-index:9999;text-shadow:0 2px 8px rgba(0,0,0,0.8);transform:translate(-50%,-50%);`;
  document.body.appendChild(el);
  el.animate([
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
    { transform: 'translate(-50%,calc(-50% - 80px)) scale(1.3)', opacity: 0 },
  ], { duration: 1200, easing: 'ease-out', fill: 'forwards' }).onfinish = () => el.remove();
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  const app = document.getElementById('app')!;
  app.innerHTML = '';
  if (state.phase === 'gameover') { renderGameOver(); return; }
  if (state.phase === 'victory') { renderVictory(); return; }
  if (state.phase === 'levelup') { renderLevelUp(); return; }
  renderGame();
}

function renderGame() {
  if (!state.currentQuestion) state = { ...state, currentQuestion: generateQuestion(state) };
  const q = state.currentQuestion!;
  const hs = loadHighScore();
  const app = document.getElementById('app')!;

  const livesHtml = Array.from({ length: 3 }, (_, i) =>
    `<span class="transition-all duration-300 ${i < state.lives ? '' : 'opacity-20 grayscale'}">${i < state.lives ? '❤️' : '🖤'}</span>`
  ).join('');

  const numChoices = CHOICES_PER_LEVEL[state.level] ?? 4;
  const gridCols = numChoices === 9 ? 'grid-cols-3' : 'grid-cols-2';
  const btnPy = numChoices === 9 ? 'py-3' : numChoices === 6 ? 'py-4' : 'py-6';
  const btnText = numChoices === 9 ? 'text-2xl' : 'text-3xl';

  const keysHtml = q.choices.map((choice, i) => {
    let cls = '';
    if (state.phase === 'wrong' && i === state.wrongChoiceIndex) cls = 'wrong';
    else if (state.phase === 'wrong' && state.hintActive && choice === q.answer) cls = 'hint-highlight';
    const disabled = state.phase === 'wrong' && i === state.wrongChoiceIndex ? 'disabled' : '';
    return `<button class="keypad-btn ${cls} ${btnPy} ${btnText} font-black" data-index="${i}" ${disabled}>${choice}</button>`;
  }).join('');

  const wrongMsg = state.phase === 'wrong'
    ? state.wrongChoiceIndex === null
      ? `<div class="mt-2 animate-bounce-in">
           <div class="text-orange-400 font-bold text-sm">⏰ Te langzaam!</div>
         </div>`
      : `<div class="mt-2 animate-bounce-in">
           <div class="text-red-400 font-bold text-sm">Probeer nog eens! 💪</div>
           <div class="text-blue-200 text-xs mt-0.5">Het juiste antwoord zit er nog steeds bij!</div>
         </div>`
    : '';

  const streakHtml = state.streak >= 3
    ? `<div class="streak-badge rounded-full px-2 py-0.5 text-xs font-bold text-orange-300 flex items-center gap-1">🔥 ${state.streak}</div>` : '';

  // Level progress: dots for each question in the level
  const levelProgressHtml = Array.from({ length: QUESTIONS_PER_LEVEL }, (_, i) =>
    `<div class="h-2 rounded-full flex-1 transition-all duration-300 ${i < state.questionsCorrectThisLevel ? 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.7)]' : 'bg-white/10'}"></div>`
  ).join('');

  app.innerHTML = `
    <div class="star-bg min-h-dvh flex flex-col px-4 py-3 select-none">
      <div id="star-canvas" class="fixed inset-0 pointer-events-none overflow-hidden z-0"></div>

      <!-- Top bar -->
      <div class="relative z-10 flex items-center justify-between mb-1">
        <div class="flex gap-1 text-2xl">${livesHtml}</div>
        <div class="flex gap-2 items-center">
          ${streakHtml}
          <div class="score-badge rounded-full px-3 py-0.5 text-sm font-bold text-yellow-300 flex items-center gap-1">⭐ ${state.score}</div>
        </div>
        <div class="text-xs text-blue-300 font-semibold text-right">
          <div>Lv ${state.level}</div>
          <div class="text-blue-400/60">${LEVEL_NAMES[state.level]}</div>
        </div>
      </div>

      <!-- High score -->
      ${hs > 0 ? `<div class="relative z-10 text-center text-xs text-yellow-500/50 mb-1">Record: ${hs} ⭐</div>` : ''}

      <!-- Level progress dots -->
      <div class="relative z-10 flex gap-1 mb-2">
        ${levelProgressHtml}
      </div>

      <!-- Timer bar -->
      <div class="relative z-10 mb-3">
        <div class="w-full h-2 rounded-full bg-white/10 overflow-hidden">
          <div id="timer-bar" class="h-full rounded-full" style="width:100%;background:linear-gradient(90deg,#4ade80,#22c55e);transition:background 0.3s"></div>
        </div>
        <div class="flex justify-between text-xs text-white/30 mt-0.5">
          <span>⚡ snel = meer punten</span>
          <span>${TIMER_SECS}s</span>
        </div>
      </div>

      <!-- Question card -->
      <div class="relative z-10 question-card rounded-2xl p-4 mb-4 text-center" id="question-card">
        <div class="absolute -top-4 -right-2 text-4xl opacity-50 animate-float">🪐</div>
        <div class="absolute -top-3 -left-2 text-2xl opacity-40 animate-float" style="animation-delay:1.2s">⭐</div>
        <div class="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-1 flex items-center justify-center gap-2">
          <span>${state.questionsCorrectThisLevel + 1} / ${QUESTIONS_PER_LEVEL}</span>
          <span class="opacity-40">·</span>
          <span>${starsHtml(calcStars(state.wrongsThisLevel), 'text-sm')}</span>
        </div>
        <div class="text-white font-black text-5xl tracking-wide">
          <span class="text-yellow-300">${q.a}</span>
          <span class="text-blue-300 mx-2">×</span>
          <span class="text-yellow-300">${q.b}</span>
          <span class="text-blue-300 mx-2">=</span>
          <span class="text-white/40">?</span>
        </div>
        ${wrongMsg}
      </div>

      <!-- Keypad -->
      <div class="relative z-10 grid ${gridCols} gap-3" id="keypad">
        ${keysHtml}
      </div>

      ${state.bestStreak > 2 ? `<div class="relative z-10 text-center mt-3 text-blue-400/50 text-xs">Beste reeks: ${state.bestStreak} 🔥</div>` : ''}
    </div>
  `;

  createStars();
  if (state.phase === 'playing') startTimer();

  document.getElementById('keypad')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!btn || btn.disabled) return;
    const idx = parseInt(btn.dataset.index ?? '-1');
    if (idx < 0) return;
    handleAnswer(idx, btn);
  });
}

function handleAnswer(idx: number, btn: HTMLButtonElement) {
  if (state.phase !== 'playing' && state.phase !== 'wrong') return;
  if (state.phase === 'wrong' && idx === state.wrongChoiceIndex) return;

  const elapsed = elapsedMs();
  stopTimer();

  const rect = btn.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const { newState, correct, pointsEarned, label } = answerQuestion(state, idx, elapsed);
  state = newState;

  if (correct) {
    btn.classList.add('correct');
    spawnParticles(cx, cy, CORRECT_EMOJIS, 8);
    const floatText = label ? `${label} +${pointsEarned}` : `+${pointsEarned}`;
    showFloatingText(cx, cy - 20, floatText, label ? '#fde68a' : '#fbbf24');
    document.querySelectorAll<HTMLButtonElement>('.keypad-btn').forEach(b => { b.disabled = true; });
    setTimeout(() => {
      if (['levelup', 'victory', 'gameover'].includes(state.phase)) {
        render();
      } else {
        state = { ...state, phase: 'playing', currentQuestion: generateQuestion(state) };
        render();
      }
    }, 750);
  } else {
    btn.classList.add('wrong');
    btn.disabled = true;
    spawnParticles(cx, cy, WRONG_EMOJIS, 3);
    showFloatingText(cx, cy, '-1 ❤️', '#f87171');
    const card = document.getElementById('question-card');
    card?.classList.add('animate-shake');
    setTimeout(() => card?.classList.remove('animate-shake'), 600);
    render();
    const wrongBtn = document.querySelector<HTMLButtonElement>(`[data-index="${state.wrongChoiceIndex}"]`);
    if (wrongBtn) { wrongBtn.disabled = true; wrongBtn.classList.add('wrong'); }
  }
}

function renderLevelUp() {
  stopTimer();
  const app = document.getElementById('app')!;
  const next = Math.min(state.level + 1, MAX_LEVEL);
  const starsEarned = calcStars(state.wrongsThisLevel);

  app.innerHTML = `
    <div class="star-bg min-h-dvh flex flex-col items-center justify-center px-6 py-8 text-center">
      <div id="star-canvas" class="fixed inset-0 pointer-events-none overflow-hidden z-0"></div>
      <div class="relative z-10 w-full max-w-sm">
        <div class="text-8xl mb-3 animate-bounce-in">🚀</div>
        <div class="text-yellow-300 text-4xl font-black mb-1 animate-bounce-in" style="animation-delay:.1s">Level ${state.level} klaar!</div>
        <div class="flex justify-center gap-3 my-4 animate-bounce-in" style="animation-delay:.2s">
          ${Array.from({length:3},(_,i)=>`
            <span class="text-5xl ${i < starsEarned ? 'animate-star-burst' : 'opacity-20 grayscale'}" style="animation-delay:${0.3+i*0.15}s">⭐</span>
          `).join('')}
        </div>
        <div class="text-blue-200 text-base mb-1 animate-bounce-in" style="animation-delay:.6s">Je wordt ${LEVEL_NAMES[next]}!</div>
        <div class="text-white/50 text-sm mb-6 animate-bounce-in" style="animation-delay:.7s">
          Score: ${state.score} ⭐ &nbsp;|&nbsp; Reeks: ${state.bestStreak} 🔥
        </div>
        <button id="continue-btn" class="keypad-btn w-full py-5 text-xl font-black rounded-2xl animate-bounce-in" style="animation-delay:.8s">
          🛸 Door naar Level ${next}!
        </button>
      </div>
    </div>
  `;
  createStars();
  setTimeout(() => spawnParticles(window.innerWidth/2, window.innerHeight/2, CELEBRATION_EMOJIS, 14), 300);
  document.getElementById('continue-btn')?.addEventListener('click', () => {
    state = advanceLevel(state);
    state = { ...state, currentQuestion: generateQuestion(state) };
    render();
  });
}

function renderVictory() {
  stopTimer();
  saveHighScore(state.score);
  const hs = loadHighScore();
  const newRecord = state.score >= hs;
  const pct = state.questionsAnswered > 0 ? Math.round(state.questionsCorrect / state.questionsAnswered * 100) : 100;
  const allStars = [...state.starsPerLevel, calcStars(state.wrongsThisLevel)];
  const totalStars = allStars.reduce((s, n) => s + n, 0);

  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div class="star-bg min-h-dvh flex flex-col items-center justify-center px-6 py-8 text-center">
      <div id="star-canvas" class="fixed inset-0 pointer-events-none overflow-hidden z-0"></div>
      <div class="relative z-10 w-full max-w-sm">
        <div class="text-9xl mb-2 animate-bounce-in">🏆</div>
        <div class="text-yellow-300 text-4xl font-black mb-1 animate-bounce-in" style="animation-delay:.15s">GEWELDIG!</div>
        ${newRecord ? `<div class="text-orange-300 font-black text-lg mb-1 animate-bounce-in" style="animation-delay:.2s">🎉 Nieuw record!</div>` : ''}
        <div class="text-white text-lg mb-4 animate-bounce-in" style="animation-delay:.25s">Je bent een ${LEVEL_NAMES[MAX_LEVEL]}!</div>
        <div class="question-card rounded-2xl p-4 mb-4 animate-bounce-in" style="animation-delay:.35s">
          <div class="text-blue-300 text-xs uppercase tracking-widest mb-3">Sterren per level</div>
          <div class="flex flex-col gap-1.5">
            ${allStars.map((s,i) => `
              <div class="flex items-center justify-between px-2">
                <span class="text-blue-200 text-sm">Lv ${i+1} — ${LEVEL_NAMES[i+1]}</span>
                <span>${starsHtml(s,'text-base')}</span>
              </div>
            `).join('')}
          </div>
          <div class="border-t border-blue-800 mt-3 pt-2 flex justify-between px-2">
            <span class="text-yellow-300 font-bold text-sm">Totaal</span>
            <span class="text-yellow-300 font-bold">${totalStars} / ${MAX_LEVEL * 3} ⭐</span>
          </div>
        </div>
        <div class="question-card rounded-2xl p-4 mb-5 animate-bounce-in" style="animation-delay:.45s">
          <div class="grid grid-cols-2 gap-3 text-center">
            <div><div class="text-yellow-300 text-3xl font-black">${state.score}</div><div class="text-blue-300 text-xs">Punten</div></div>
            <div><div class="text-blue-300 text-3xl font-black">${hs}</div><div class="text-blue-300 text-xs">Record</div></div>
            <div><div class="text-orange-400 text-3xl font-black">${state.bestStreak}</div><div class="text-blue-300 text-xs">Beste reeks</div></div>
            <div><div class="text-green-400 text-3xl font-black">${pct}%</div><div class="text-blue-300 text-xs">Juist</div></div>
          </div>
        </div>
        <button id="restart-btn" class="keypad-btn w-full py-5 text-xl font-black rounded-2xl animate-bounce-in" style="animation-delay:.6s">
          🚀 Opnieuw spelen!
        </button>
      </div>
    </div>
  `;
  createStars();
  for (let i = 0; i < 5; i++) {
    setTimeout(() => spawnParticles(Math.random()*window.innerWidth, Math.random()*window.innerHeight*0.6, CELEBRATION_EMOJIS, 10), i*350);
  }
  document.getElementById('restart-btn')?.addEventListener('click', () => {
    state = { ...initialState(), currentQuestion: generateQuestion(initialState()) };
    render();
  });
}

function renderGameOver() {
  stopTimer();
  saveHighScore(state.score);
  const hs = loadHighScore();
  const worst = Array.from(state.wrongAnswers.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const tipsHtml = worst.length === 0
    ? '<div class="text-green-400 text-sm">Je deed het geweldig! 🌟</div>'
    : worst.map(([key]) => {
        const [a, b] = key.split('x').map(Number);
        return `<div class="text-yellow-300 text-xl font-bold">${a} × ${b} = ${a*b} 🪐</div>`;
      }).join('');

  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div class="star-bg min-h-dvh flex flex-col items-center justify-center px-6 py-8 text-center">
      <div id="star-canvas" class="fixed inset-0 pointer-events-none overflow-hidden z-0"></div>
      <div class="relative z-10 w-full max-w-sm">
        <div class="text-8xl mb-4 animate-bounce-in">🌑</div>
        <div class="text-red-400 text-3xl font-black mb-2 animate-bounce-in" style="animation-delay:.1s">Geen levens meer!</div>
        <div class="flex justify-center gap-3 items-center mb-4 animate-bounce-in" style="animation-delay:.2s">
          <div class="text-yellow-300 font-bold">Score: ${state.score} ⭐</div>
          <div class="text-blue-400 text-sm">Record: ${hs} ⭐</div>
        </div>
        <div class="question-card rounded-2xl p-4 mb-6 animate-bounce-in" style="animation-delay:.3s">
          <div class="text-blue-200 text-sm mb-2">Oefen deze sommen 💡</div>
          ${tipsHtml}
        </div>
        <button id="retry-btn" class="keypad-btn w-full py-5 text-xl font-black rounded-2xl animate-bounce-in" style="animation-delay:.4s">
          🚀 Probeer opnieuw!
        </button>
      </div>
    </div>
  `;
  createStars();
  document.getElementById('retry-btn')?.addEventListener('click', () => {
    state = { ...initialState(), currentQuestion: generateQuestion(initialState()) };
    render();
  });
}

state = { ...state, currentQuestion: generateQuestion(state) };
render();
