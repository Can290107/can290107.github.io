(function() {
  const DATE_ROULETTE_SPIN_DURATION_MS = 2400;
  const DATE_ROULETTE_PREVIEW_INTERVAL_MS = 100;

  let currentRouletteIdea = "";
  let lastPreviewIdea = "";
  let isRouletteSpinning = false;
  let previewIntervalId = null;
  let finishTimeoutId = null;

  function getRouletteElements() {
    return {
      preview: document.getElementById("dateRoulettePreview"),
      wheel: document.getElementById("dateRouletteWheel"),
      spinButton: document.getElementById("dateRouletteSpinButton"),
      result: document.getElementById("dateRouletteResult"),
      resultText: document.getElementById("dateRouletteResultText"),
      todoButton: document.getElementById("dateRouletteTodoButton"),
      againButton: document.getElementById("dateRouletteAgainButton")
    };
  }

  function getDateIdeas() {
    if (!Array.isArray(window.dateRouletteIdeas)) {
      return [];
    }

    return window.dateRouletteIdeas
      .map(function(idea) {
        return typeof idea === "string" ? idea.trim() : "";
      })
      .filter(Boolean);
  }

  function pickRandomIdea(ideas, excludedIdea) {
    if (!ideas.length) {
      return "";
    }

    if (ideas.length === 1) {
      return ideas[0];
    }

    let nextIdea = excludedIdea;

    while (nextIdea === excludedIdea) {
      nextIdea = ideas[Math.floor(Math.random() * ideas.length)];
    }

    return nextIdea;
  }

  function updatePreviewText(text) {
    const elements = getRouletteElements();
    if (elements.preview) {
      elements.preview.textContent = text;
    }
  }

  function clearSpinTimers() {
    if (previewIntervalId) {
      clearInterval(previewIntervalId);
      previewIntervalId = null;
    }

    if (finishTimeoutId) {
      clearTimeout(finishTimeoutId);
      finishTimeoutId = null;
    }
  }

  function setButtonStates(spinDisabled) {
    const elements = getRouletteElements();

    if (elements.spinButton) {
      elements.spinButton.disabled = spinDisabled;
    }

    if (elements.againButton) {
      elements.againButton.disabled = spinDisabled;
    }

    if (elements.todoButton) {
      elements.todoButton.disabled = spinDisabled || !currentRouletteIdea;
    }
  }

  function hideResult() {
    const elements = getRouletteElements();
    if (elements.result) {
      elements.result.classList.add("hidden");
    }
  }

  function showResult(idea) {
    const elements = getRouletteElements();

    if (elements.resultText) {
      elements.resultText.textContent = idea;
    }

    if (elements.result) {
      elements.result.classList.remove("hidden");
    }
  }

  function setTodoButtonLabel(label) {
    const elements = getRouletteElements();
    if (elements.todoButton) {
      elements.todoButton.textContent = label;
    }
  }

  function spinRoulette() {
    if (isRouletteSpinning) {
      return;
    }

    const ideas = getDateIdeas();
    const elements = getRouletteElements();

    if (!ideas.length || !elements.wheel) {
      return;
    }

    isRouletteSpinning = true;
    currentRouletteIdea = "";
    setTodoButtonLabel("Zur Liste hinzufügen");
    hideResult();
    setButtonStates(true);
    elements.wheel.classList.add("is-spinning");

    const cyclePreview = function() {
      lastPreviewIdea = pickRandomIdea(ideas, lastPreviewIdea);
      updatePreviewText(lastPreviewIdea);
    };

    cyclePreview();
    previewIntervalId = setInterval(cyclePreview, DATE_ROULETTE_PREVIEW_INTERVAL_MS);

    finishTimeoutId = setTimeout(function() {
      clearSpinTimers();

      currentRouletteIdea = pickRandomIdea(ideas, lastPreviewIdea);
      lastPreviewIdea = currentRouletteIdea;
      updatePreviewText(currentRouletteIdea);
      showResult(currentRouletteIdea);

      elements.wheel.classList.remove("is-spinning");
      isRouletteSpinning = false;
      setButtonStates(false);
    }, DATE_ROULETTE_SPIN_DURATION_MS);
  }

  async function addRouletteIdeaToList() {
    if (!currentRouletteIdea || typeof window.addTodo !== "function") {
      return;
    }

    const todoInput = document.getElementById("todoInput");
    const elements = getRouletteElements();

    if (!todoInput || !elements.todoButton) {
      return;
    }

    todoInput.value = `🎡 ${currentRouletteIdea}`;
    elements.todoButton.disabled = true;

    const wasSaved = await window.addTodo();

    if (!wasSaved) {
      elements.todoButton.disabled = false;
      setTodoButtonLabel("Noch mal versuchen");
      return;
    }

    setTodoButtonLabel("Zur Liste hinzugefügt");

    setTimeout(function() {
      if (!isRouletteSpinning) {
        elements.todoButton.disabled = false;
      }
      setTodoButtonLabel("Zur Liste hinzufügen");
    }, 1600);
  }

  function bindButton(button, handler) {
    if (!button || button.dataset.bound === "true") {
      return;
    }

    button.dataset.bound = "true";
    button.addEventListener("click", handler);
  }

  function initializeDateRoulette() {
    const currentPageName = typeof window.getCurrentPageName === "function"
      ? window.getCurrentPageName()
      : (window.location.pathname.split("/").pop() || "index.html");

    if (currentPageName !== "tools.html") {
      return;
    }

    const ideas = getDateIdeas();
    const elements = getRouletteElements();

    if (!elements.preview || !elements.spinButton) {
      return;
    }

    bindButton(elements.spinButton, spinRoulette);
    bindButton(elements.againButton, spinRoulette);
    bindButton(elements.todoButton, function() {
      addRouletteIdeaToList();
    });

    if (!ideas.length) {
      updatePreviewText("Noch keine Date-Ideen verfügbar");
      elements.spinButton.disabled = true;
      return;
    }

    if (!currentRouletteIdea) {
      lastPreviewIdea = pickRandomIdea(ideas, lastPreviewIdea);
      updatePreviewText(lastPreviewIdea);
    }

    setButtonStates(false);
  }

  window.initializeDateRoulette = initializeDateRoulette;
})();