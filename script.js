'use strict';

// Варіант 7. Усі елементи сторінки отримуємо через DOM.
const QUIZ_LENGTH = 10;
const SESSION_KEY = 'mnozhymo_session_v1';
const HISTORY_KEY = 'mnozhymo_history_v1';
const THEME_KEY = 'mnozhymo_theme_v1';

const byId = (id) => document.getElementById(id);
const ui = {
  themeToggle: byId('themeToggle'),
  viewTraining: byId('viewTraining'),
  viewStatistics: byId('viewStatistics'),
  viewAbout: byId('viewAbout'),
  activeExercise: byId('activeExercise'),
  finishScreen: byId('finishScreen'),
  questionCounter: byId('questionCounter'),
  tableBadge: byId('tableBadge'),
  segmentProgress: byId('segmentProgress'),
  questionText: byId('questionText'),
  answerOptions: byId('answerOptions'),
  feedback: byId('feedback'),
  feedbackIcon: byId('feedbackIcon'),
  feedbackTitle: byId('feedbackTitle'),
  feedbackText: byId('feedbackText'),
  nextButton: byId('nextButton'),
  scoreRing: byId('scoreRing'),
  scorePercent: byId('scorePercent'),
  overallScore: byId('overallScore'),
  correctCount: byId('correctCount'),
  wrongCount: byId('wrongCount'),
  answeredCount: byId('answeredCount'),
  personalBest: byId('personalBest'),
  tableSelect: byId('tableSelect'),
  newQuizButton: byId('newQuizButton'),
  retryButton: byId('retryButton'),
  finishHeading: byId('finishHeading'),
  finishScore: byId('finishScore'),
  finishDescription: byId('finishDescription'),
  finishCorrect: byId('finishCorrect'),
  finishWrong: byId('finishWrong'),
  mistakesReview: byId('mistakesReview'),
  historySessions: byId('historySessions'),
  historyBest: byId('historyBest'),
  historyAverage: byId('historyAverage'),
  historyTotalCorrect: byId('historyTotalCorrect'),
  historyList: byId('historyList'),
  clearStatsButton: byId('clearStatsButton')
};

function readSaved(key, fallback) {
  try {
    const data = window.localStorage.getItem(key);
    return data === null ? fallback : JSON.parse(data);
  } catch (error) {
    return fallback;
  }
}

function save(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Тренування працює й тоді, коли браузер заборонив сховище.
  }
}

function shuffle(list) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function makeOptions(answer, a, b) {
  const alternatives = new Set([
    a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b,
    answer + 10, answer - 10, answer + 2, answer - 2,
    answer + 5, answer - 5, answer + 1, answer - 1,
    answer + 7, answer - 7, answer + 3, answer - 3
  ]);
  alternatives.delete(answer);
  const suitable = shuffle([...alternatives].filter((n) => Number.isInteger(n) && n > 0 && n <= 110));
  // Додаткова перевірка, щоб завжди було рівно чотири різних варіанти.
  let extra = 1;
  while (suitable.length < 3) {
    const candidate = answer + extra;
    if (!suitable.includes(candidate)) suitable.push(candidate);
    extra++;
  }
  return shuffle([answer, ...suitable.slice(0, 3)]);
}

function createQuestions(table) {
  let pairs = [];
  if (table === 'all') {
    // У довільному режимі не повторюються навіть перестановки 3×4 і 4×3.
    for (let a = 2; a <= 10; a++) {
      for (let b = a; b <= 10; b++) pairs.push({ a, b });
    }
  } else {
    const a = Number(table);
    for (let b = 1; b <= 10; b++) pairs.push({ a, b });
  }
  return shuffle(pairs).slice(0, QUIZ_LENGTH).map(({ a, b }) => ({
    a, b, answer: a * b, options: makeOptions(a * b, a, b)
  }));
}

function validSession(data) {
  return data && typeof data === 'object' &&
    (data.table === 'all' || (/^[2-9]$/.test(String(data.table)))) &&
    Array.isArray(data.questions) && data.questions.length === QUIZ_LENGTH &&
    data.questions.every((q) =>
      Number.isInteger(q.a) && Number.isInteger(q.b) && q.answer === q.a * q.b &&
      Array.isArray(q.options) && q.options.length === 4 &&
      new Set(q.options).size === 4 && q.options.includes(q.answer)
    ) &&
    Array.isArray(data.answers) && data.answers.length <= QUIZ_LENGTH &&
    data.answers.every((record, i) =>
      record && Number.isInteger(record.choice) &&
      data.questions[i].options.includes(record.choice) &&
      record.correct === (record.choice === data.questions[i].answer)
    ) &&
    Number.isInteger(data.index) && data.index >= 0 && data.index < QUIZ_LENGTH &&
    Number.isInteger(data.correct) && data.correct === data.answers.filter((answer) => answer.correct).length &&
    (data.phase === 'playing' || data.phase === 'complete') &&
    (data.phase === 'complete'
      ? data.answers.length === QUIZ_LENGTH
      : data.answers.length === data.index || data.answers.length === data.index + 1);
}

let history = readSaved(HISTORY_KEY, []);
if (!Array.isArray(history)) history = [];
history = history.filter((item) => item && Number.isFinite(item.percent) && Number.isFinite(item.correct) && typeof item.date === 'string').slice(0, 100);

function freshSession(table) {
  return { table, questions: createQuestions(table), index: 0, answers: [], correct: 0, phase: 'playing', completedAt: null };
}

const restored = readSaved(SESSION_KEY, null);
let session = validSession(restored) ? restored : freshSession('all');

function formatPercent(correct, total) {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

function updateScoreboard() {
  const count = session.answers.length;
  const wrong = count - session.correct;
  const percent = formatPercent(session.correct, count);
  ui.scoreRing.style.setProperty('--progress', percent + '%');
  ui.scorePercent.textContent = percent + '%';
  ui.overallScore.textContent = `Загальний рахунок: ${percent}% (${session.correct} правильних із ${count})`;
  ui.correctCount.textContent = session.correct;
  ui.wrongCount.textContent = wrong;
  ui.answeredCount.textContent = `${count}/${QUIZ_LENGTH}`;
  ui.personalBest.textContent = history.length ? Math.max(...history.map((x) => x.percent)) + '%' : '—';
}

function renderProgress() {
  ui.segmentProgress.replaceChildren();
  for (let i = 0; i < QUIZ_LENGTH; i++) {
    const segment = document.createElement('span');
    segment.className = 'segment';
    if (i < session.answers.length) segment.classList.add('is-done');
    else if (i === session.index) segment.classList.add('is-current');
    ui.segmentProgress.appendChild(segment);
  }
  ui.segmentProgress.setAttribute('aria-valuenow', String(session.answers.length));
  ui.segmentProgress.setAttribute('aria-label', `Виконано ${session.answers.length} із ${QUIZ_LENGTH} завдань`);
}

function setFeedback(status, title, detail) {
  ui.feedback.className = 'feedback';
  if (status === 'correct') ui.feedback.classList.add('is-success');
  if (status === 'wrong') ui.feedback.classList.add('is-error');
  ui.feedbackIcon.textContent = status === 'correct' ? '✓' : status === 'wrong' ? '×' : 'i';
  ui.feedbackTitle.textContent = title;
  ui.feedbackText.textContent = detail;
}

function renderAnswers(question, savedAnswer) {
  ui.answerOptions.replaceChildren();
  question.options.forEach((value, i) => {
    const label = document.createElement('label');
    label.className = 'answer-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'answer';
    input.value = String(value);
    input.checked = savedAnswer !== undefined && savedAnswer.choice === value;
    input.disabled = savedAnswer !== undefined;
    input.setAttribute('aria-label', `Варіант ${i + 1}: ${value}`);

    const content = document.createElement('span');
    content.className = 'option-content';
    const circle = document.createElement('span');
    circle.className = 'radio-circle';
    circle.setAttribute('aria-hidden', 'true');
    const number = document.createElement('span');
    number.textContent = value;
    const shortcut = document.createElement('small');
    shortcut.className = 'option-key';
    shortcut.textContent = String(i + 1);
    shortcut.setAttribute('aria-hidden', 'true');
    content.append(circle, number, shortcut);
    label.append(input, content);

    if (savedAnswer !== undefined) {
      label.classList.add('is-locked');
      if (value === question.answer) label.classList.add('is-correct');
      else if (value === savedAnswer.choice) label.classList.add('is-wrong');
    }
    input.addEventListener('change', () => chooseAnswer(value));
    ui.answerOptions.append(label);
  });
}

function renderQuestion() {
  const question = session.questions[session.index];
  const savedAnswer = session.answers[session.index];
  ui.questionCounter.textContent = `Завдання ${session.index + 1} із ${QUIZ_LENGTH}`;
  ui.tableBadge.textContent = session.table === 'all' ? 'Різні таблиці' : `Таблиця на ${session.table}`;
  ui.questionText.textContent = `${question.a} × ${question.b} = ?`;
  renderProgress();
  renderAnswers(question, savedAnswer);

  if (!savedAnswer) {
    setFeedback('neutral', 'Одна відповідь — одна спроба', 'Обери варіант. Після вибору змінити його вже не можна.');
  } else if (savedAnswer.correct) {
    setFeedback('correct', 'Правильно! Чудова робота.', `${question.a} × ${question.b} = ${question.answer}. Можна переходити далі.`);
  } else {
    setFeedback('wrong', `Помилка, правильна відповідь — ${question.answer}`, `${question.a} × ${question.b} = ${question.answer}. У наступному завданні все вийде!`);
  }
  ui.nextButton.disabled = !savedAnswer;
  ui.nextButton.querySelector('span').textContent = session.index === QUIZ_LENGTH - 1 ? 'Показати результат' : 'Наступне завдання';
}

function chooseAnswer(value) {
  // Перевіряємо не лише стан radio: це гарантує саме ОДНУ спробу.
  if (session.phase !== 'playing' || session.answers.length !== session.index) return;
  const question = session.questions[session.index];
  if (!question.options.includes(value)) return;
  const correct = value === question.answer;
  session.answers.push({ choice: value, correct });
  if (correct) session.correct++;
  save(SESSION_KEY, session);
  render();
}

function nextQuestion() {
  if (session.phase !== 'playing' || session.answers.length !== session.index + 1) return;
  if (session.index === QUIZ_LENGTH - 1) {
    finishQuiz();
  } else {
    session.index++;
    save(SESSION_KEY, session);
    render();
    ui.questionText.focus({ preventScroll: true });
  }
}

function finishQuiz() {
  if (session.phase === 'complete' || session.answers.length !== QUIZ_LENGTH) return;
  session.phase = 'complete';
  session.completedAt = new Date().toISOString();
  const percent = formatPercent(session.correct, QUIZ_LENGTH);
  history.unshift({ date: session.completedAt, table: session.table, correct: session.correct, percent });
  history = history.slice(0, 100);
  save(HISTORY_KEY, history);
  save(SESSION_KEY, session);
  render();
}

function renderFinish() {
  const percent = formatPercent(session.correct, QUIZ_LENGTH);
  ui.finishHeading.textContent = percent === 100 ? 'Без жодної помилки!' : percent >= 80 ? 'Чудова робота!' : percent >= 50 ? 'Гарний початок!' : 'Практика робить майстром!';
  ui.finishScore.textContent = percent + '%';
  ui.finishDescription.textContent = `Правильних відповідей: ${session.correct} із ${QUIZ_LENGTH}. ${percent === 100 ? 'Так тримати!' : 'Спробуй ще раз і покращ свій рекорд.'}`;
  ui.finishCorrect.textContent = session.correct;
  ui.finishWrong.textContent = QUIZ_LENGTH - session.correct;

  ui.mistakesReview.replaceChildren();
  const mistakes = session.answers
    .map((answer, index) => ({ ...answer, question: session.questions[index] }))
    .filter((answer) => !answer.correct);
  if (mistakes.length) {
    const heading = document.createElement('h3');
    heading.textContent = 'Розбір помилок';
    ui.mistakesReview.appendChild(heading);
    mistakes.forEach(({ choice, question }) => {
      const row = document.createElement('div');
      row.className = 'mistake-line';
      const example = document.createElement('strong');
      example.textContent = `${question.a} × ${question.b}`;
      const yours = document.createElement('span');
      yours.textContent = `твоя відповідь: ${choice}`;
      const correct = document.createElement('b');
      correct.textContent = `правильно: ${question.answer}`;
      row.append(example, yours, correct);
      ui.mistakesReview.appendChild(row);
    });
  }
}

function render() {
  const done = session.phase === 'complete';
  ui.activeExercise.hidden = done;
  ui.finishScreen.hidden = !done;
  ui.tableSelect.value = session.table;
  updateScoreboard();
  if (done) renderFinish();
  else renderQuestion();
  renderStatistics();
}

function startNewQuiz() {
  if (session.phase === 'playing' && session.answers.length > 0 &&
      !window.confirm('Почати нове тренування? Поточний незавершений результат буде втрачено.')) return;
  const table = ui.tableSelect.value;
  session = freshSession(table);
  save(SESSION_KEY, session);
  switchView('training');
  render();
}

function safeDate(date) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? 'Дата невідома' : parsed.toLocaleString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderStatistics() {
  ui.historySessions.textContent = history.length;
  ui.historyBest.textContent = history.length ? Math.max(...history.map((x) => x.percent)) + '%' : '—';
  ui.historyAverage.textContent = history.length ? Math.round(history.reduce((sum, item) => sum + item.percent, 0) / history.length) + '%' : '—';
  ui.historyTotalCorrect.textContent = history.reduce((sum, item) => sum + item.correct, 0);
  ui.historyList.replaceChildren();

  if (history.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Поки що немає завершених тренувань. Виконай 10 завдань, і тут з’явиться результат.';
    ui.historyList.appendChild(empty);
    return;
  }
  history.slice(0, 12).forEach((item) => {
    const line = document.createElement('div');
    line.className = 'history-item';
    const info = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item.table === 'all' ? 'Усі таблиці' : `Таблиця на ${item.table}`;
    const meta = document.createElement('small');
    meta.textContent = `${safeDate(item.date)} · ${item.correct} правильних із 10`;
    info.append(title, meta);
    const bar = document.createElement('div');
    bar.className = 'history-bar';
    const fill = document.createElement('div');
    fill.className = 'history-bar-fill';
    fill.style.width = Math.min(100, Math.max(0, item.percent)) + '%';
    bar.appendChild(fill);
    const pct = document.createElement('div');
    pct.className = 'history-percent';
    pct.textContent = item.percent + '%';
    line.append(info, bar, pct);
    ui.historyList.appendChild(line);
  });
}

function switchView(view) {
  ui.viewTraining.hidden = view !== 'training';
  ui.viewStatistics.hidden = view !== 'statistics';
  ui.viewAbout.hidden = view !== 'about';
  document.querySelectorAll('.nav-button').forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (view === 'statistics') renderStatistics();
  if (window.innerWidth < 740) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  ui.themeToggle.setAttribute('aria-pressed', String(dark));
  ui.themeToggle.setAttribute('aria-label', dark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему');
  document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#101629' : '#f5f7fd');
  save(THEME_KEY, dark ? 'dark' : 'light');
}

// Події кнопок та клавіатури.
ui.nextButton.addEventListener('click', nextQuestion);
ui.newQuizButton.addEventListener('click', startNewQuiz);
ui.retryButton.addEventListener('click', startNewQuiz);
ui.themeToggle.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
ui.clearStatsButton.addEventListener('click', () => {
  if (!history.length) return;
  if (window.confirm('Очистити історію всіх завершених тренувань?')) {
    history = [];
    save(HISTORY_KEY, history);
    render();
  }
});
byId('goTrainButton').addEventListener('click', () => switchView('training'));
byId('brandLink').addEventListener('click', (event) => { event.preventDefault(); switchView('training'); });
document.querySelectorAll('.nav-button').forEach((button) => {
  button.addEventListener('click', () => switchView(button.dataset.view));
});
document.addEventListener('keydown', (event) => {
  if (ui.viewTraining.hidden || event.altKey || event.ctrlKey || event.metaKey ||
      ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (session.phase !== 'playing') return;
  if (/^[1-4]$/.test(event.key) && session.answers.length === session.index) {
    const selected = session.questions[session.index].options[Number(event.key) - 1];
    chooseAnswer(selected);
  } else if (event.key === 'Enter' && session.answers.length === session.index + 1 &&
             !['BUTTON', 'A'].includes(document.activeElement.tagName)) {
    nextQuestion();
  }
});

setTheme(readSaved(THEME_KEY, 'light'));
render();
