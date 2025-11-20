import { ARCHETYPES } from "../data/archetypes.js";
import { QUESTIONS } from "../data/questions.js";

const PROGRESS_KEY = "moneyDnaProgress";
const TOTAL_QUESTIONS = QUESTIONS.length;

const SAMPLE_SCORES = {
  king: 18,
  caregiver: 24,
  lover: 26,
  magician: 19,
  rebel: 19,
  guardian: 28,
  hero: 21,
  unifier: 22
};

const state = {
  currentScreen: "screen-0-preview",
  randomizedQuestions: [],
  currentQuestionIndex: 0,
  answers: [],
  userMeta: {
    name: "",
    email: "",
    telegram: "",
    purpose: ""
  },
  scores: {},
  resultId: null
};

const elements = {
  questionContainer: document.getElementById("test-question-container"),
  progress: document.getElementById("test-progress"),
  archetypeHint: document.getElementById("test-archetype-hint"),
  btnNext: document.getElementById("btn-question-next"),
  btnPrev: document.getElementById("btn-question-prev"),
  resumeModal: document.getElementById("resume-modal"),
  resumeMessage: document.getElementById("resume-message"),
  contactModal: document.getElementById("contact-modal"),
  contactStatus: document.getElementById("contact-modal-status"),
  summaryTop3: document.getElementById("summary-top3"),
  summaryAll: document.getElementById("summary-all"),
  detailsContainer: document.getElementById("details-container"),
  actionChecklist: document.getElementById("action-checklist")
};

const userInputs = {
  name: document.getElementById("input-name"),
  email: document.getElementById("input-email"),
  telegram: document.getElementById("input-telegram"),
  purpose: document.getElementById("input-purpose")
};

initApp();

function initApp() {
  wireButtons();
  wireQuestionInteractions();
  wireUserForm();

  const progressData = loadProgressFromLocalStorage();
  const urlParams = new URLSearchParams(window.location.search);
  const sharedResultId = urlParams.get("id");

  initStackedCardsAnimation();

  if (sharedResultId) {
    fetchResultById(sharedResultId);
    return;
  }

  if (progressData && progressData.answers?.length < TOTAL_QUESTIONS) {
    promptResume(progressData.currentQuestionIndex || 0);
  }
}

function wireButtons() {
  document.querySelectorAll("[data-start-test]").forEach((btn) => {
    btn.addEventListener("click", () => showScreen("screen-1-instructions"));
  });

  document.querySelectorAll("[data-screen-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-screen-target");
      if (!target) return;
      if (
        target === "screen-3-summary" &&
        !state.answers.length &&
        !Object.keys(state.scores).length
      ) {
        loadSampleResult();
        renderSummary();
        renderDetails();
      }
      showScreen(target);
    });
  });

  document
    .getElementById("btn-instructions-next")
    .addEventListener("click", () => showScreen("screen-1-1-user-data"));

  document
    .getElementById("btn-begin-questions")
    .addEventListener("click", () => {
      updateUserMetaFromInputs();
      startTestFlow();
    });

  elements.btnNext.addEventListener("click", handleNextClick);
  elements.btnPrev.addEventListener("click", handlePrevClick);

  document
    .getElementById("btn-view-details")
    .addEventListener("click", () => {
      renderDetails();
      showScreen("screen-4-details");
    });

  document
    .getElementById("btn-request-report")
    .addEventListener("click", () => {
      handleReportRequest();
    });

  document
    .getElementById("btn-resume-continue")
    .addEventListener("click", () => {
      hideResumeModal();
      resumeExistingTest();
    });

  document
    .getElementById("btn-resume-reset")
    .addEventListener("click", () => {
      hideResumeModal();
      clearProgress();
      resetTestState();
      showScreen("screen-0-preview");
    });

  document
    .getElementById("btn-contact-cancel")
    .addEventListener("click", () => {
      closeContactModal();
    });

  document
    .getElementById("btn-contact-submit")
    .addEventListener("click", () => {
      const email = document.getElementById("modal-email").value.trim();
      const telegram = document.getElementById("modal-telegram").value.trim();
      if (!email && !telegram) {
        elements.contactStatus.textContent =
          "Вкажи email або Telegram, щоб ми знали, куди надсилати.";
        return;
      }
      state.userMeta.email = email || state.userMeta.email;
      state.userMeta.telegram = telegram || state.userMeta.telegram;
      updateInputsFromState();
      sendReportRequest(email || state.userMeta.email, telegram || state.userMeta.telegram).then(
        (success) => {
          if (success) {
            closeContactModal();
          }
        }
      );
    });

}

function wireQuestionInteractions() {
  elements.questionContainer.addEventListener("change", (event) => {
    const input = event.target;
    if (input.matches("input[type='radio'][data-question]")) {
      handleAnswerSelection(
        Number(input.getAttribute("data-question")),
        Number(input.value)
      );
    }
  });
}

function wireUserForm() {
  Object.entries(userInputs).forEach(([key, input]) => {
    input.addEventListener("input", (event) => {
      state.userMeta[key] = event.target.value;
      saveProgressToLocalStorage();
    });
  });
}

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((el) => {
    el.classList.add("hidden");
  });
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.remove("hidden");
    state.currentScreen = screenId;
  }
}

function startTestFlow() {
  state.randomizedQuestions = shuffleArray([...QUESTIONS]);
  state.currentQuestionIndex = 0;
  state.answers = [];
  showScreen("screen-2-test");
  renderCurrentQuestion();
  saveProgressToLocalStorage();
}

function resumeExistingTest() {
  if (!state.randomizedQuestions.length) {
    state.randomizedQuestions = [...QUESTIONS];
  }
  showScreen("screen-2-test");
  renderCurrentQuestion();
}

function renderCurrentQuestion() {
  const start = state.currentQuestionIndex;
  const questionsSlice = state.randomizedQuestions.slice(start, start + 3);
  if (!questionsSlice.length) {
    elements.questionContainer.innerHTML =
      "<p>Натисни «Почати тест», щоб побачити перші питання.</p>";
    return;
  }

  const total = state.randomizedQuestions.length;
  const currentNumber = Math.min(state.currentQuestionIndex + 3, total);
  elements.progress.textContent = `${currentNumber} / ${total}`;
  elements.archetypeHint.textContent = "";

  const options = [
    { value: 1, label: "Зовсім не про мене" },
    { value: 2, label: "Рідко проявляється" },
    { value: 3, label: "Іноді, залежно від обставин" },
    { value: 4, label: "Часто, природно для мене" },
    { value: 5, label: "Це я на 100%" }
  ];

  const cards = questionsSlice
    .map((q) => {
      const answer = state.answers.find((a) => a.questionId === q.id);
      const scale = options
        .map(
          (opt) => `
            <label class="scale-option">
              <input
                type="radio"
                name="question-${q.id}"
                value="${opt.value}"
                ${answer?.value === opt.value ? "checked" : ""}
                data-question="${q.id}"
              />
              <span>${opt.value}</span>
            </label>
          `
        )
        .join("");

      return `
        <article class="question-card">
          <p class="question-hint">${ARCHETYPES[q.archetype]?.name || ""}</p>
          <h3>${q.text}</h3>
          <div class="scale-row">${scale}</div>
        </article>
      `;
    })
    .join("");

  elements.questionContainer.innerHTML = cards;

  elements.btnPrev.disabled = state.currentQuestionIndex === 0;
  elements.btnNext.textContent =
    state.currentQuestionIndex + 3 >= TOTAL_QUESTIONS ? "Завершити" : "Далі";
  checkBlockCompletion();
}

function checkBlockCompletion() {
  const start = state.currentQuestionIndex;
  const questionsSlice = state.randomizedQuestions.slice(start, start + 3);
  const allAnswered = questionsSlice.every((q) =>
    state.answers.some((a) => a.questionId === q.id)
  );
  elements.btnNext.disabled = !allAnswered;
}

function handleAnswerSelection(questionId, value) {
  const question = state.randomizedQuestions.find((q) => q.id === questionId);
  if (!question) return;

  const existingIndex = state.answers.findIndex((a) => a.questionId === questionId);
  const answerObj = {
    questionId,
    archetype: question.archetype,
    value: Number(value)
  };

  if (existingIndex >= 0) {
    state.answers[existingIndex] = answerObj;
  } else {
    state.answers.push(answerObj);
  }

  checkBlockCompletion();
  saveProgressToLocalStorage();
}

function handleNextClick() {
  if (state.currentQuestionIndex + 3 >= TOTAL_QUESTIONS) {
    completeTest();
    return;
  }
  state.currentQuestionIndex += 3;
  renderCurrentQuestion();
  saveProgressToLocalStorage();
}

function handlePrevClick() {
  if (state.currentQuestionIndex === 0) return;
  state.currentQuestionIndex = Math.max(0, state.currentQuestionIndex - 3);
  renderCurrentQuestion();
  saveProgressToLocalStorage();
}

async function completeTest() {
  calculateScores();
  renderSummary();
  renderDetails();
  showScreen("screen-3-summary");
  clearProgress();
  await persistResults();
}

function calculateScores() {
  const scores = {};
  Object.keys(ARCHETYPES).forEach((key) => {
    scores[key] = 0;
  });

  state.answers.forEach((a) => {
    if (scores[a.archetype] == null) scores[a.archetype] = 0;
    scores[a.archetype] += a.value;
  });

  state.scores = scores;
  return scores;
}

function getTopArchetypes(limit = 3) {
  return Object.entries(state.scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, score]) => ({ key, score }));
}

function renderSummary() {
  const top = getTopArchetypes(3);
  if (!top.length) {
    elements.summaryTop3.innerHTML =
      "<p>Спершу заверши тест, щоб побачити результат.</p>";
    document.getElementById("result-dominant").innerHTML = "";
    document.getElementById("result-chart").innerHTML = "";
    document.getElementById("result-description").innerHTML = "";
    return;
  }

  const roleHints = [
    "Домінантний архетип — ядро твоєї фінансової енергії.",
    "Підтримуюча енергія, яка вирівнює стратегію.",
    "Потенціал росту, що хоче більше простору."
  ];

  elements.summaryTop3.innerHTML = top
    .map(({ key, score }, idx) => {
      const data = ARCHETYPES[key];
      return `
        <article class="archetype-card">
          <div class="stat-number">${String(idx + 1).padStart(2, "0")}</div>
          <div class="archetype-card__body">
            <strong>${data?.name || key}</strong>
            <p class="archetype-score">${score} балів</p>
            <p>${roleHints[idx] || ""}</p>
            <p>${data?.shortDescription || ""}</p>
          </div>
        </article>
      `;
    })
    .join("");

  const scoreValues = Object.values(state.scores);
  const maxScore = scoreValues.length ? Math.max(...scoreValues) : 0;
  elements.summaryAll.innerHTML = Object.keys(ARCHETYPES)
    .map((key, index) => {
      const data = ARCHETYPES[key];
      const score = state.scores[key] || 0;
      const width = maxScore ? Math.round((score / maxScore) * 100) : 0;
      return `
        <article class="archetype-mini">
          <div class="archetype-mini__header">
            <div class="mini-title">
              <span class="mini-rank">${String(index + 1).padStart(2, "0")}</span>
              <strong>${data.name}</strong>
            </div>
            <span class="mini-score">${score} балів</span>
          </div>
          <div class="mini-bar">
            <span style="width: ${width}%"></span>
          </div>
        </article>
      `;
    })
    .join("");

  renderResultHero(top);
}

function renderResultHero(top) {
  const dominant = top[0];
  const dominantEl = document.getElementById("result-dominant");
  const chartEl = document.getElementById("result-chart");
  const descEl = document.getElementById("result-description");

  if (!dominant) {
    dominantEl.innerHTML = "";
    chartEl.innerHTML = "";
    descEl.innerHTML = "";
    return;
  }

  const dominantData = ARCHETYPES[dominant.key];
  dominantEl.innerHTML = `
    <p class="result-badge">Твій домінантний архетип</p>
    <h3>${dominantData.name}</h3>
    <p class="result-score">${dominant.score} балів</p>
    <p>${dominantData.shortDescription}</p>
  `;

  const orderedKeys = Object.keys(ARCHETYPES);
  const values = orderedKeys.map((key) => state.scores[key] || 0);
  const maxScore = Math.max(...values, 35);

  const legend = orderedKeys
    .map(
      (key, index) => `
        <li class="legend-item">
          <span class="legend-dot" style="background:${ARCHETYPE_COLORS[key] || "#94a3b8"}"></span>
          <span>${ARCHETYPES[key].name}</span>
          <strong>${values[index]}</strong>
        </li>
      `
    )
    .join("");

  chartEl.innerHTML = `
    <canvas id="radar-chart" width="420" height="420"></canvas>
    <ul class="chart-legend">${legend}</ul>
  `;
  const radarCanvas = document.getElementById("radar-chart");
  drawRadarChart(radarCanvas, orderedKeys, values, maxScore);

  const long = dominantData.longDescription;
  const dominantSections = [
    { label: "Ключова енергія", value: long.coreEnergy },
    { label: "Як проявляється у фінансах", value: long.inFinance },
    { label: "Тінь", value: long.shadow },
    { label: "Подарунок зрілості", value: long.gift },
    { label: "Потенціал", value: long.potential },
    { label: "Мантра", value: long.mantra }
  ];
  descEl.innerHTML = `
    <article class="result-detail">
      <h4>${dominantData.name}: повний розбір</h4>
      <dl class="detail-list">
        ${dominantSections
          .map(
            ({ label, value }) => `
              <div class="detail-row">
                <dt>${label}</dt>
                <dd>${value}</dd>
              </div>
            `
          )
          .join("")}
      </dl>
    </article>
  `;
}

function drawRadarChart(canvas, labels, values, maxScore) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const padding = 65;
  const radius = Math.min(width, height) / 2 - padding;
  const axes = labels.length;
  const levels = 5;

  ctx.clearRect(0, 0, width, height);
  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, "#ffffff");
  bgGradient.addColorStop(1, "#eef3ff");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(centerX, centerY);

  for (let level = levels; level >= 1; level--) {
    const r = (radius * level) / levels;
    ctx.beginPath();
    for (let i = 0; i <= axes; i++) {
      const angle = (-Math.PI / 2) + ((2 * Math.PI * i) / axes);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = level % 2 === 0 ? "rgba(10, 132, 255, 0.08)" : "rgba(255, 214, 10, 0.06)";
    ctx.fill();
    ctx.strokeStyle = "rgba(5, 6, 26, 0.08)";
    ctx.stroke();
  }

  labels.forEach((label, index) => {
    const angle = (-Math.PI / 2) + ((2 * Math.PI * index) / axes);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "rgba(5, 6, 26, 0.12)";
    ctx.stroke();

    const labelDistance = radius + 25;
    const labelX = Math.cos(angle) * labelDistance;
    const labelY = Math.sin(angle) * labelDistance;
    const text = `${ARCHETYPES[label].name} (${values[index]})`;

    ctx.save();
    ctx.translate(labelX, labelY);
    ctx.fillStyle = "#1f2342";
    ctx.font = "12px 'Space Grotesk', 'Inter', sans-serif";
    ctx.textAlign = labelX > 0 ? "left" : labelX < 0 ? "right" : "center";
    ctx.textBaseline = labelY > 8 ? "top" : labelY < -8 ? "bottom" : "middle";
    ctx.fillText(text, 0, 0);
    ctx.restore();
  });

  ctx.beginPath();
  values.forEach((val, index) => {
    const ratio = maxScore ? Math.min(val / maxScore, 1) : 0;
    const r = ratio * radius;
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / axes;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(10, 132, 255, 0.2)";
  ctx.fill();
  ctx.strokeStyle = "#0a84ff";
  ctx.lineWidth = 2;
  ctx.stroke();

  values.forEach((val, index) => {
    const ratio = maxScore ? Math.min(val / maxScore, 1) : 0;
    const r = ratio * radius;
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / axes;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ff9f0a";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fill();
  });

  ctx.restore();
}

function renderDetails() {
  const top = getTopArchetypes(3);
  elements.detailsContainer.innerHTML = top
    .map(({ key, score }) => {
      const data = ARCHETYPES[key];
      if (!data) return "";
      const desc = data.longDescription;
      const sections = [
        { label: "Ключова енергія", value: desc.coreEnergy },
        { label: "Як проявляється у фінансах", value: desc.inFinance },
        { label: "Тінь", value: desc.shadow },
        { label: "Дар", value: desc.gift },
        { label: "Потенціал", value: desc.potential },
        { label: "Мантра", value: desc.mantra }
      ];
      return `
        <article class="detail-item">
          <div class="detail-item__head">
            <h4>${data.name}</h4>
            <span class="detail-item__score">${score} балів</span>
          </div>
          <dl class="detail-list">
            ${sections
              .map(
                ({ label, value }) => `
                  <div class="detail-row">
                    <dt>${label}</dt>
                    <dd>${value}</dd>
                  </div>
                `
              )
              .join("")}
          </dl>
        </article>
      `;
    })
    .join("");

  const checklist = buildNextSteps(top);
  elements.actionChecklist.innerHTML = checklist
    .map((tip) => `<li>${tip}</li>`)
    .join("");
}

function buildNextSteps(top) {
  const tips = [];
  if (top[0]) {
    tips.push(
      `Посили ${ARCHETYPES[top[0].key].name}: виділи час на головну фінансову стратегію тижня.`
    );
  }
  if (top[1]) {
    tips.push(
      `Дай роль ${ARCHETYPES[top[1].key].name}: доручи йому підтримуючі завдання чи партнерства.`
    );
  }
  if (top[2]) {
    tips.push(
      `Розвивай ${ARCHETYPES[top[2].key].name}: обери один експеримент, щоб ця енергія заговорила голосніше.`
    );
  }
  if (state.userMeta.purpose) {
    tips.push(
      `Зістав результат з твоїм наміром «${state.userMeta.purpose}» і зафіксуй конкретний крок.`
    );
  }
  tips.push("Зроби ревізію фінансів через 30 днів і порівняй прогрес.");
  return tips.slice(0, 5);
}

function saveProgressToLocalStorage() {
  if (!state.randomizedQuestions.length) return;
  const data = {
    randomizedQuestions: state.randomizedQuestions.map((q) => q.id),
    currentQuestionIndex: state.currentQuestionIndex,
    answers: state.answers,
    userMeta: state.userMeta
  };
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
}

function loadProgressFromLocalStorage() {
  const raw = localStorage.getItem(PROGRESS_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    state.currentQuestionIndex = data.currentQuestionIndex || 0;
    state.answers = data.answers || [];
    state.userMeta = {
      ...state.userMeta,
      ...(data.userMeta || {})
    };
    state.randomizedQuestions = (data.randomizedQuestions || [])
      .map((id) => QUESTIONS.find((q) => q.id === id))
      .filter(Boolean);
    updateInputsFromState();
    return data;
  } catch (e) {
    console.error("Не вдалося відновити прогрес", e);
    return null;
  }
}

function clearProgress() {
  localStorage.removeItem(PROGRESS_KEY);
}

function resetTestState() {
  state.randomizedQuestions = [];
  state.currentQuestionIndex = 0;
  state.answers = [];
  state.scores = {};
  state.resultId = null;
}

function promptResume(currentIndex) {
  elements.resumeMessage.textContent = `Ви зупинились на питанні ${
    currentIndex + 1
  } з ${TOTAL_QUESTIONS}. Продовжити?`;
  elements.resumeModal.classList.remove("hidden");
}

function hideResumeModal() {
  elements.resumeModal.classList.add("hidden");
}

function initStackedCardsAnimation() {
  const cards = document.querySelectorAll(".stat-section .stat-card");
  const mediaQuery = window.matchMedia("(max-width: 600px)");
  if (!cards.length || !mediaQuery.matches) return;

  cards.forEach((card) => card.classList.add("is-visible"));
}

function loadSampleResult() {
  state.scores = { ...SAMPLE_SCORES };
  state.resultId = null;
  state.answers = [];
}

function updateUserMetaFromInputs() {
  Object.entries(userInputs).forEach(([key, input]) => {
    state.userMeta[key] = input.value.trim();
  });
}

function updateInputsFromState() {
  Object.entries(userInputs).forEach(([key, input]) => {
    input.value = state.userMeta[key] || "";
  });
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function persistResults() {
  if (state.resultId) return state.resultId;
  if (!state.answers.length) return null;
  try {
    const payload = {
      name: state.userMeta.name || null,
      email: state.userMeta.email || null,
      telegram: state.userMeta.telegram || null,
      purpose: state.userMeta.purpose || null,
      answers: state.answers,
      scores: state.scores,
      topArchetypes: getTopArchetypes(3)
    };
    const response = await fetch("/api/results", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      console.error("Не вдалося зберегти результат");
      return null;
    }
    const data = await response.json();
    if (data?.id) {
      state.resultId = data.id;
      return data.id;
    }
    return null;
  } catch (err) {
    console.error("Помилка збереження результату", err);
    return null;
  }
}

async function handleReportRequest() {
  const email = state.userMeta.email?.trim();
  const telegram = state.userMeta.telegram?.trim();
  if (!state.resultId) {
    await persistResults();
  }
  if (email || telegram) {
    sendReportRequest(email, telegram);
  } else {
    elements.contactStatus.textContent = "";
    document.getElementById("modal-email").value = "";
    document.getElementById("modal-telegram").value = "";
    openContactModal();
  }
}

async function sendReportRequest(email, telegram) {
  if (!state.resultId) {
    elements.contactStatus.textContent =
      "Спершу заверши тест, щоб ми згенерували результат.";
    return false;
  }
  try {
    const response = await fetch("/api/send-report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        resultId: state.resultId,
        email: email || null,
        telegram: telegram || null
      })
    });
    if (!response.ok) {
      elements.contactStatus.textContent =
        "Не вдалось надіслати. Спробуй ще раз пізніше.";
      return false;
    }
    elements.contactStatus.textContent = "Готово! Перевір скриньку або Telegram.";
    return true;
  } catch (err) {
    console.error("Помилка відправки", err);
    elements.contactStatus.textContent =
      "Не вдалось надіслати. Спробуй ще раз пізніше.";
    return false;
  }
}

function openContactModal() {
  elements.contactModal.classList.remove("hidden");
}

function closeContactModal() {
  elements.contactModal.classList.add("hidden");
  elements.contactStatus.textContent = "";
}

async function fetchResultById(id) {
  try {
    const response = await fetch(`/api/results/${id}`);
    if (!response.ok) {
      throw new Error("Result not found");
    }
    const data = await response.json();
    if (data?.result) {
      state.answers = data.result.answers || [];
      state.scores = data.result.scores || {};
      state.userMeta = {
        ...state.userMeta,
        name: data.result.name || "",
        email: data.result.email || "",
        telegram: data.result.telegram || "",
        purpose: data.result.purpose || ""
      };
      state.resultId = data.result.id;
      updateInputsFromState();
      renderSummary();
      renderDetails();
      showScreen("screen-3-summary");
    }
  } catch (err) {
    console.error("Не вдалося завантажити результат", err);
    showScreen("screen-0-preview");
  }
}

function closeContactModalIfNeeded(event) {
  if (event.target === elements.contactModal) {
    closeContactModal();
  }
}

elements.contactModal.addEventListener("click", closeContactModalIfNeeded);
elements.resumeModal.addEventListener("click", (event) => {
  if (event.target === elements.resumeModal) {
    hideResumeModal();
  }
});
const ARCHETYPE_COLORS = {
  king: "#ffb347",
  caregiver: "#ffa8a8",
  lover: "#ff7eb6",
  magician: "#9f7aea",
  rebel: "#ff6b6b",
  guardian: "#4c6ef5",
  hero: "#ffd43b",
  unifier: "#38bdf8"
};
