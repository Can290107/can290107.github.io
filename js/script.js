const PRIVATE_PAGES = ["tools.html", "gallery.html", "secret.html"];
const AUTH_SESSION_DAY_KEY = "authSessionDay";
const AUTH_USERNAME_KEY = "authUsername";
const LEGACY_LOGIN_USER_KEY = "loggedInUser";
const LEGACY_LOGIN_TIME_KEY = "loginTimestamp";
const GALLERY_STORAGE_ROOT = window.galleryStorageRoot || "gallery";
const GALLERY_START_YEAR = 2025;
const GALLERY_START_MONTH = 4;
const GALLERY_UPLOAD_MONTH_BUFFER = 12;

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v"];

const authService = window.firebaseAuth;
const authUserMap = window.authUserMap || {};
const storageRefFactory = window.storageRef;

let currentEventKey = null;
let activeGalleryMonth = null;
let todoUnsubscribe = null;
let eventsUnsubscribe = null;
let calendarEvents = {};
let pageFeaturesInitialized = false;
let galleryMonths = [];
let galleryItemsCache = {};
let gallerySource = "storage";
let galleryEmptyStateTitle = "Noch keine Erinnerungen fuer diesen Monat";
let galleryEmptyStateMessage = "Lade den Monatsordner in Firebase Storage hoch oder nutze fuer lokal gespeicherte Dateien das bestehende Galerie-Manifest als Fallback.";

document.addEventListener("DOMContentLoaded", function() {
  bindLoginForm();
  bindEventPopupButtons();
  bindHeartEffect();
  initializeUI();
  initializeMediaLightbox();
  initializeInitialView();
  startAuthFlow();
});

function initializeInitialView() {
  if (getCurrentPageName() === "index.html") {
    showLoginScreen();
  }
}

function getCurrentPageName() {
  const currentPage = window.location.pathname.split("/").pop();
  return currentPage || "index.html";
}

function isProtectedPage() {
  return PRIVATE_PAGES.includes(getCurrentPageName());
}

function getCurrentDayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function clearLocalAuthState() {
  localStorage.removeItem(AUTH_SESSION_DAY_KEY);
  localStorage.removeItem(AUTH_USERNAME_KEY);
  localStorage.removeItem(LEGACY_LOGIN_USER_KEY);
  localStorage.removeItem(LEGACY_LOGIN_TIME_KEY);
}

function persistAuthSession(loginValue) {
  const normalizedValue = loginValue.includes("@")
    ? loginValue.split("@")[0].toLowerCase()
    : loginValue.toLowerCase();

  localStorage.setItem(AUTH_SESSION_DAY_KEY, getCurrentDayKey());
  localStorage.setItem(AUTH_USERNAME_KEY, normalizedValue);
}

function isCurrentSessionValid() {
  return localStorage.getItem(AUTH_SESSION_DAY_KEY) === getCurrentDayKey();
}

function unlockPendingAuthState() {
  document.body.classList.remove("auth-pending");
}

function resolveAuthEmail(loginValue) {
  if (!loginValue) {
    return null;
  }

  if (loginValue.includes("@")) {
    return loginValue;
  }

  return authUserMap[loginValue.toLowerCase()] || null;
}

function getFriendlyAuthErrorMessage(error, loginValue) {
  const errorCode = error && error.code ? error.code : "unknown";

  if (errorCode === "auth/user-not-found") {
    return `Fuer ${loginValue} gibt es noch kein Firebase-Konto.`;
  }

  if (
    errorCode === "auth/wrong-password" ||
    errorCode === "auth/invalid-credential" ||
    errorCode === "auth/invalid-login-credentials" ||
    errorCode === "auth/invalid-email"
  ) {
    return "Benutzername oder Passwort sind falsch.";
  }

  if (errorCode === "auth/too-many-requests") {
    return "Zu viele Login-Versuche. Bitte versuche es spaeter noch einmal.";
  }

  if (errorCode === "auth/network-request-failed") {
    return "Netzwerkfehler beim Login. Bitte pruefe deine Verbindung.";
  }

  return "Login fehlgeschlagen. Bitte pruefe die Firebase-Auth-Einstellungen.";
}

function showLoginError(message) {
  const errorMsg = document.getElementById("errorMsg");
  if (!errorMsg) {
    return;
  }

  errorMsg.textContent = message;
  errorMsg.style.display = "block";
}

function hideLoginError() {
  const errorMsg = document.getElementById("errorMsg");
  if (!errorMsg) {
    return;
  }

  errorMsg.textContent = "";
  errorMsg.style.display = "none";
}

function showMainContent() {
  const loginScreen = document.getElementById("loginScreen");
  const mainContent = document.getElementById("mainContent");

  if (loginScreen) {
    loginScreen.style.display = "none";
  }

  if (mainContent) {
    mainContent.style.display = "block";
  }

  updateRelationshipCounter();
}

function showLoginScreen() {
  const loginScreen = document.getElementById("loginScreen");
  const mainContent = document.getElementById("mainContent");

  if (loginScreen) {
    loginScreen.style.display = "flex";
  }

  if (mainContent) {
    mainContent.style.display = "none";
  }
}

function startAuthFlow() {
  if (!authService) {
    console.error("Firebase Auth ist nicht verfuegbar.");
    if (getCurrentPageName() === "index.html") {
      showLoginScreen();
    }
    unlockPendingAuthState();
    return;
  }

  authService.onAuthStateChanged(async function(user) {
    if (user && !isCurrentSessionValid()) {
      try {
        await authService.signOut();
      } catch (error) {
        console.error("Fehler beim Abmelden der abgelaufenen Session:", error);
      }
      return;
    }

    if (user) {
      handleAuthenticatedState();
      return;
    }

    handleSignedOutState();
  });
}

function handleAuthenticatedState() {
  unlockPendingAuthState();
  hideLoginError();

  if (getCurrentPageName() === "index.html") {
    showMainContent();
  }

  if (!pageFeaturesInitialized) {
    pageFeaturesInitialized = true;
    initializePageFeatures();
  }
}

function handleSignedOutState() {
  clearLocalAuthState();

  if (isProtectedPage()) {
    window.location.replace("index.html");
    return;
  }

  showLoginScreen();
  unlockPendingAuthState();
}

function bindLoginForm() {
  const loginBtn = document.getElementById("loginBtn");
  const usernameInput = document.getElementById("usernameInput");
  const passwordInput = document.getElementById("passwordInput");

  if (loginBtn && loginBtn.dataset.bound !== "true") {
    loginBtn.dataset.bound = "true";
    loginBtn.addEventListener("click", handleLogin);
  }

  [usernameInput, passwordInput].forEach(function(input) {
    if (!input || input.dataset.bound === "true") {
      return;
    }

    input.dataset.bound = "true";
    input.addEventListener("keydown", function(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        handleLogin();
      }
    });
  });
}

async function handleLogin() {
  const usernameInput = document.getElementById("usernameInput");
  const passwordInput = document.getElementById("passwordInput");
  const loginBtn = document.getElementById("loginBtn");

  if (!usernameInput || !passwordInput || !authService) {
    return;
  }

  const loginValue = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!loginValue || !password) {
    showLoginError("Bitte Benutzername und Passwort eingeben.");
    return;
  }

  const email = resolveAuthEmail(loginValue);

  if (!email) {
    showLoginError("Der Benutzername ist nicht fuer Firebase Auth freigeschaltet.");
    return;
  }

  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.textContent = "Anmelden...";
  }

  try {
    persistAuthSession(loginValue);
    await authService.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    await authService.signInWithEmailAndPassword(email, password);

    usernameInput.value = "";
    passwordInput.value = "";
    hideLoginError();

    if (typeof confetti === "function") {
      confetti({
        particleCount: 300,
        spread: 180,
        origin: { y: 0.6 }
      });
    }
  } catch (error) {
    clearLocalAuthState();
    console.error("Firebase Login fehlgeschlagen:", error);
    showLoginError(getFriendlyAuthErrorMessage(error, loginValue));
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.textContent = "Anmelden";
    }
  }
}

async function handleLogout() {
  clearLocalAuthState();

  if (!authService) {
    window.location.href = "index.html";
    return;
  }

  try {
    await authService.signOut();
  } catch (error) {
    console.error("Fehler beim Logout:", error);
  }

  if (getCurrentPageName() !== "index.html") {
    window.location.href = "index.html";
  }
}

function initializeUI() {
  const button = document.getElementById("startBtn");
  const music = document.getElementById("bgMusic");

  if (button && music && button.dataset.bound !== "true") {
    button.dataset.bound = "true";
    button.addEventListener("click", function() {
      music.volume = 0;
      music.play();

      let volume = 0;
      const fade = setInterval(function() {
        if (volume < 1) {
          volume += 0.02;
          music.volume = volume;
        } else {
          clearInterval(fade);
        }
      }, 100);

      button.style.display = "none";
    });
  }

  if (typeof AOS !== "undefined") {
    AOS.init({
      duration: 1000,
      once: true
    });
  }

  const cursor = document.querySelector(".cursor");
  if (cursor && !document.body.dataset.cursorBound) {
    document.body.dataset.cursorBound = "true";
    document.addEventListener("mousemove", function(event) {
      cursor.style.left = event.clientX + "px";
      cursor.style.top = event.clientY + "px";
    });
  }

  if (typeof tsParticles !== "undefined") {
    const particles = document.getElementById("particles");
    if (particles) {
      tsParticles.load("particles", {
        particles: {
          number: { value: 60 },
          color: { value: "#ec4899" },
          shape: { type: "circle" },
          opacity: { value: 0.5 },
          size: { value: 3 },
          move: {
            enable: true,
            speed: 2
          }
        }
      });
    }
  }

  const timelineEvents = document.querySelectorAll(".timeline-event");
  timelineEvents.forEach(function(eventCard) {
    if (eventCard.dataset.bound === "true") {
      return;
    }

    eventCard.dataset.bound = "true";
    eventCard.addEventListener("click", function() {
      timelineEvents.forEach(function(entry) {
        entry.classList.remove("active");
      });

      eventCard.classList.add("active");
      eventCard.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    });
  });
}

function initializePageFeatures() {
  const currentPage = getCurrentPageName();

  if (currentPage === "tools.html") {
    loadTodos();
    loadEvents();
  }

  if (currentPage === "gallery.html") {
    initializeGalleryPage();
  }

  if (currentPage === "secret.html") {
    initializeUploadPage();
  }
}

function updateRelationshipCounter() {
  const startDate = new Date("2025-04-14");
  const relationshipDate = new Date("2025-06-21");
  const today = new Date();

  const diffStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
  const diffRelationship = Math.floor((today - relationshipDate) / (1000 * 60 * 60 * 24));

  const togetherEl = document.getElementById("daysTogether");
  const relationshipEl = document.getElementById("daysRelationship");

  if (togetherEl && relationshipEl) {
    togetherEl.textContent = diffStart + " Tage kennen";
    relationshipEl.textContent = diffRelationship + " Tage zusammen ❤️";
  }
}

let letterStarted = false;

function showLetter() {
  if (letterStarted) {
    return;
  }

  letterStarted = true;

  if (typeof confetti === "function") {
    confetti({
      particleCount: 200,
      spread: 120,
      origin: { y: 0.6 }
    });
  }

  const letter = document.getElementById("loveLetter");
  const textElement = document.getElementById("letterText");

  if (!letter || !textElement) {
    return;
  }

  const text = `Hallo Cansu,

ich habe lange darueber nachgedacht, was ich dir schreiben soll.
Und je mehr ich darueber nachgedacht habe,
desto mehr habe ich gemerkt,
dass es eigentlich keine richtigen Worte dafuer gibt.

Weil das, was ich fuer dich empfinde,
laesst sich nicht einfach erklaeren.
Es ist nicht nur ein Gefuehl.
Es ist etwas, das einfach da ist
die ganze Zeit.

Du bist fuer mich nicht nur meine Freundin.
Du bist die Person,
bei der alles irgendwie still wird.

Egal wie mein Tag war,
egal was in meinem Kopf los ist
wenn ich an dich denke,
wird alles ruhiger.

Und ich glaube, genau das ist das,
was dich fuer mich so besonders macht.

Du bist nicht laut,
nicht aufdringlich,
nicht kompliziert.

Und trotzdem schaffst du es,
mehr in mir ausgeloest zu haben als alles andere.

Ich fuehle mich bei dir einfach richtig.

So, als muesste ich nichts erklaeren.
So, als wuerde alles genau so passen, wie es ist.

Und ich habe das Gefuehl,
dass ich durch dich Dinge gelernt habe,
die ich vorher nie wirklich verstanden habe.

Wie es ist, jemandem wirklich zu vertrauen.
Wie es ist, sich wirklich wohlzufuehlen.
Und wie es ist,
einen Menschen nicht mehr aus seinem Leben wegdenken zu koennen.

Du bist fuer mich zu einem festen Teil geworden.
Nicht irgendwann,
sondern einfach so.

Und genau das macht mir manchmal bewusst,
wie besonders das alles ist.

Weil nichts davon selbstverstaendlich ist.

Ich bin einfach dankbar.
Fuer dich.
Fuer alles, was du bist.
Fuer die Art, wie du denkst,
wie du fuehlst
und wie du mit mir umgehst.

Und ich merke,
dass ich mir genau das immer gewuenscht habe,
ohne es richtig benennen zu koennen.

Ich kann dir nicht versprechen,
dass immer alles perfekt sein wird.

Aber ich kann dir sagen,
dass ich dich immer genauso ehrlich meinen werde,
wie ich es jetzt tue.

Und dass ich dich niemals als selbstverstaendlich sehen werde.

Alles Gute zum Geburtstag ❤️

Ich liebe dich.
Nicht nur heute,
sondern jeden einzelnen Tag.
`;

  letter.classList.add("show");
  textElement.innerHTML = "";

  let index = 0;

  function type() {
    if (index < text.length) {
      textElement.innerHTML += text.charAt(index);
      index += 1;
      setTimeout(type, 40);
    }
  }

  type();
}

function bindHeartEffect() {
  if (document.body.dataset.heartEffectBound === "true") {
    return;
  }

  document.body.dataset.heartEffectBound = "true";
  document.addEventListener("click", function(event) {
    const heart = document.createElement("div");
    heart.classList.add("heart");
    heart.innerHTML = "❤️";
    heart.style.left = event.clientX + "px";
    heart.style.top = event.clientY + "px";

    document.body.appendChild(heart);

    setTimeout(function() {
      heart.remove();
    }, 4000);
  });
}

function openTools() {
  window.location.href = "tools.html";
}

function openGallery() {
  window.location.href = "gallery.html";
}

function openUpload() {
  window.location.href = "secret.html";
}

function goBack() {
  window.location.href = "index.html";
}

function loadTodos() {
  if (todoUnsubscribe) {
    return;
  }

  todoUnsubscribe = onSnapshot(collection("todos"), function(snapshot) {
    const list = document.getElementById("todoList");
    if (!list) {
      return;
    }

    list.innerHTML = "";

    snapshot.forEach(function(docItem) {
      const todo = docItem.data();
      const li = document.createElement("li");
      li.classList.add("todo-item");

      if (todo.done) {
        li.classList.add("done");
      }

      const left = document.createElement("div");
      left.classList.add("todo-left");
      left.textContent = todo.text;
      left.onclick = function() {
        toggleTodo(docItem.id, todo.done);
      };

      const btn = document.createElement("button");
      btn.textContent = "✕";
      btn.onclick = function() {
        deleteTodo(docItem.id);
      };

      li.appendChild(left);
      li.appendChild(btn);
      list.appendChild(li);
    });
  });
}

function addTodo() {
  const input = document.getElementById("todoInput");
  if (!input || !input.value.trim()) {
    return;
  }

  addDoc(collection("todos"), {
    text: input.value.trim(),
    done: false
  });

  input.value = "";
}

function toggleTodo(id, currentState) {
  updateDoc(doc("todos", id), {
    done: !currentState
  });
}

function deleteTodo(id) {
  deleteDoc(doc("todos", id));
}

let currentDate = new Date();

function openPopup(text, key) {
  const popup = document.getElementById("eventPopup");
  const textElement = document.getElementById("eventText");

  if (!popup || !textElement) {
    return;
  }

  popup.classList.remove("hidden");
  textElement.textContent = text;
  currentEventKey = key;
}

function closePopup() {
  const popup = document.getElementById("eventPopup");
  if (popup) {
    popup.classList.add("hidden");
  }
}

function bindEventPopupButtons() {
  const deleteBtn = document.getElementById("deleteEventBtn");
  const editBtn = document.getElementById("editEventBtn");

  if (deleteBtn && deleteBtn.dataset.bound !== "true") {
    deleteBtn.dataset.bound = "true";
    deleteBtn.onclick = function() {
      if (!currentEventKey) {
        return;
      }

      deleteDoc(doc("events", currentEventKey));
      closePopup();
    };
  }

  if (editBtn && editBtn.dataset.bound !== "true") {
    editBtn.dataset.bound = "true";
    editBtn.onclick = function() {
      const newText = prompt("Neuer Text:");
      if (newText && newText.trim() !== "") {
        setDoc(doc("events", currentEventKey), {
          text: newText.trim()
        });
      }
      closePopup();
    };
  }
}

function renderCalendar(events) {
  const grid = document.getElementById("calendarGrid");
  const title = document.getElementById("calendarTitle");

  if (!grid || !title) {
    return;
  }

  grid.style.opacity = 0.3;
  grid.innerHTML = "";

  const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  days.forEach(function(day) {
    const div = document.createElement("div");
    div.textContent = day;
    div.style.fontWeight = "bold";
    div.style.opacity = "0.7";
    grid.appendChild(div);
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  title.textContent = currentDate.toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric"
  });

  let firstDay = new Date(year, month, 1).getDay();
  firstDay = firstDay === 0 ? 6 : firstDay - 1;

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let index = 0; index < firstDay; index += 1) {
    grid.innerHTML += "<div></div>";
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${month}-${day}`;
    const hasEvent = events[key];

    const div = document.createElement("div");
    div.classList.add("calendar-day");

    if (hasEvent) {
      div.classList.add("has-event");
    }

    const today = new Date();
    if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
      div.classList.add("today");
    }

    div.textContent = day;
    div.onclick = function() {
      if (hasEvent) {
        openPopup(hasEvent, key);
      } else {
        const text = prompt("Was wollen wir an diesem Tag machen? ❤️");
        if (text) {
          setDoc(doc("events", key), {
            text: text.trim()
          });
        }
      }
    };

    grid.appendChild(div);
  }

  requestAnimationFrame(function() {
    grid.style.opacity = 1;
  });
}

function changeMonth(direction) {
  currentDate.setMonth(currentDate.getMonth() + direction);
  renderCalendar(calendarEvents);
}

function loadEvents() {
  if (eventsUnsubscribe) {
    return;
  }

  eventsUnsubscribe = onSnapshot(collection("events"), function(snapshot) {
    calendarEvents = {};

    snapshot.forEach(function(docItem) {
      calendarEvents[docItem.id] = docItem.data().text;
    });

    renderCalendar(calendarEvents);
  });
}

function getFallbackGalleryConfig() {
  if (!window.galleryData || typeof window.galleryData !== "object") {
    return {
      months: [],
      items: {}
    };
  }

  return {
    months: Array.isArray(window.galleryData.months) ? window.galleryData.months : [],
    items: window.galleryData.items && typeof window.galleryData.items === "object"
      ? window.galleryData.items
      : {}
  };
}

function getFallbackGalleryItems(monthId) {
  const items = getFallbackGalleryConfig().items;
  return Array.isArray(items[monthId]) ? items[monthId] : [];
}

function canUseHostedGalleryManifest() {
  return isLocalDevelopmentHost();
}

function isLocalDevelopmentHost() {
  const hostname = window.location.hostname;
  return window.location.protocol === "file:" || hostname === "localhost" || hostname === "127.0.0.1";
}

function mergeGalleryMonths(primaryMonths, secondaryMonths) {
  const mergedMonths = new Map();

  primaryMonths.forEach(function(month) {
    if (month && month.id) {
      mergedMonths.set(month.id, month);
    }
  });

  secondaryMonths.forEach(function(month) {
    if (month && month.id && !mergedMonths.has(month.id)) {
      mergedMonths.set(month.id, month);
    }
  });

  return Array.from(mergedMonths.values()).sort(function(a, b) {
    return a.id.localeCompare(b.id);
  });
}

function getGalleryFileName(source) {
  if (!source) {
    return "";
  }

  try {
    const cleanSource = source.split("?")[0].split("#")[0];
    return decodeURIComponent(cleanSource.split("/").pop() || cleanSource).toLowerCase();
  } catch (error) {
    return String(source).toLowerCase();
  }
}

function getGalleryItemFingerprint(item) {
  return [
    item.type || "",
    (item.caption || item.alt || "").toLowerCase(),
    getGalleryFileName(item.src)
  ].join("|");
}

function mergeGalleryItems(primaryItems, secondaryItems) {
  const mergedItems = new Map();

  primaryItems.forEach(function(item) {
    mergedItems.set(getGalleryItemFingerprint(item), item);
  });

  secondaryItems.forEach(function(item) {
    const fingerprint = getGalleryItemFingerprint(item);
    if (!mergedItems.has(fingerprint)) {
      mergedItems.set(fingerprint, item);
    }
  });

  return Array.from(mergedItems.values());
}

function isMonthId(value) {
  return /^\d{4}-\d{2}$/.test(value);
}

function createMonthIdFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthIdToDate(monthId) {
  if (!isMonthId(monthId)) {
    return null;
  }

  const parts = monthId.split("-");
  return new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
}

function formatMonthLabel(monthId) {
  if (!isMonthId(monthId)) {
    return monthId;
  }

  const date = parseMonthIdToDate(monthId);

  if (!date) {
    return monthId;
  }

  return date.toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric"
  });
}

function detectMediaTypeFromName(fileName) {
  const lowerName = fileName.toLowerCase();

  if (IMAGE_EXTENSIONS.some(function(extension) {
    return lowerName.endsWith(extension);
  })) {
    return "image";
  }

  if (VIDEO_EXTENSIONS.some(function(extension) {
    return lowerName.endsWith(extension);
  })) {
    return "video";
  }

  return null;
}

function formatCaptionFromName(fileName) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  return withoutExtension.replace(/[_-]+/g, " ").trim() || fileName;
}

function getLatestKnownGalleryMonthId() {
  const fallbackMonths = getFallbackGalleryConfig().months
    .map(function(month) {
      return month.id;
    })
    .filter(isMonthId)
    .sort();

  return fallbackMonths.length ? fallbackMonths[fallbackMonths.length - 1] : null;
}

function showGalleryLoading(message) {
  const galleryGrid = document.getElementById("galleryGrid");
  if (!galleryGrid) {
    return;
  }

  galleryGrid.innerHTML = `<div class="gallery-loader">${message}</div>`;
}

function setGalleryEmptyStateContent(title, message) {
  galleryEmptyStateTitle = title;
  galleryEmptyStateMessage = message;

  const emptyState = document.getElementById("galleryEmptyState");
  if (!emptyState) {
    return;
  }

  const titleElement = emptyState.querySelector("h3");
  const messageElement = emptyState.querySelector("p");

  if (titleElement) {
    titleElement.textContent = title;
  }

  if (messageElement) {
    messageElement.textContent = message;
  }
}

async function getStorageGalleryMonths() {
  if (!storageRefFactory) {
    return [];
  }

  const rootRef = storageRefFactory(GALLERY_STORAGE_ROOT);
  const result = await rootRef.listAll();

  return result.prefixes
    .map(function(prefix) {
      return prefix.name;
    })
    .filter(isMonthId)
    .sort()
    .map(function(monthId) {
      return {
        id: monthId,
        label: formatMonthLabel(monthId)
      };
    });
}

async function listStorageItemsRecursive(folderRef) {
  const result = await folderRef.listAll();
  let items = result.items.slice();

  for (const prefix of result.prefixes) {
    const nestedItems = await listStorageItemsRecursive(prefix);
    items = items.concat(nestedItems);
  }

  return items.sort(function(a, b) {
    return a.fullPath.localeCompare(b.fullPath);
  });
}

async function getStorageGalleryItems(monthId) {
  if (galleryItemsCache[monthId]) {
    return galleryItemsCache[monthId];
  }

  const monthRef = storageRefFactory(`${GALLERY_STORAGE_ROOT}/${monthId}`);
  const itemRefs = await listStorageItemsRecursive(monthRef);

  const supportedItemRefs = itemRefs.filter(function(itemRef) {
    return Boolean(detectMediaTypeFromName(itemRef.name));
  });

  const items = await Promise.all(supportedItemRefs.map(async function(itemRef) {
    const mediaType = detectMediaTypeFromName(itemRef.name);
    const downloadUrl = await itemRef.getDownloadURL();
    const caption = formatCaptionFromName(itemRef.name);

    return {
      type: mediaType,
      src: downloadUrl,
      alt: caption,
      caption: caption,
      sortKey: itemRef.fullPath
    };
  }));

  items.sort(function(a, b) {
    return a.sortKey.localeCompare(b.sortKey);
  });

  galleryItemsCache[monthId] = items.map(function(item) {
    return {
      type: item.type,
      src: item.src,
      alt: item.alt,
      caption: item.caption
    };
  });

  return galleryItemsCache[monthId];
}

async function initializeGalleryPage() {
  const monthTabs = document.getElementById("galleryMonthTabs");
  const galleryGrid = document.getElementById("galleryGrid");
  const canUseManifest = canUseHostedGalleryManifest();
  const fallbackConfig = canUseManifest
    ? getFallbackGalleryConfig()
    : { months: [], items: {} };

  if (!monthTabs || !galleryGrid) {
    return;
  }

  galleryMonths = [];
  galleryItemsCache = {};
  gallerySource = "storage";
  setGalleryEmptyStateContent(
    "Noch keine Erinnerungen fuer diesen Monat",
    canUseManifest
      ? "Lade den Monatsordner in Firebase Storage hoch oder nutze fuer lokal gespeicherte Dateien das bestehende Galerie-Manifest als Fallback."
      : "Online werden nur Dateien aus Firebase Storage angezeigt. Lokale assets/gallery-Dateien sind im Hosting absichtlich nicht verfuegbar."
  );

  showGalleryLoading("Monate werden geladen...");
  showGalleryEmptyState(false);

  try {
    const storageMonths = await getStorageGalleryMonths();
    if (storageMonths.length && canUseManifest && fallbackConfig.months.length) {
      galleryMonths = mergeGalleryMonths(storageMonths, fallbackConfig.months);
      gallerySource = "hybrid";
    } else if (storageMonths.length) {
      galleryMonths = storageMonths;
      gallerySource = "storage";
    } else {
      galleryMonths = fallbackConfig.months;
      gallerySource = fallbackConfig.months.length ? "manifest" : "storage";

      if (!galleryMonths.length && !canUseManifest) {
        setGalleryEmptyStateContent(
          "Online-Galerie noch leer",
          "Es wurden noch keine Bilder oder Videos nach Firebase Storage hochgeladen. Oeffne die Upload-Seite und lade die Monatsordner dort hoch."
        );
      }
    }
  } catch (error) {
    console.error("Galerie aus Firebase Storage konnte nicht geladen werden:", error);
    galleryMonths = fallbackConfig.months;
    gallerySource = fallbackConfig.months.length ? "manifest" : "storage";

    if (!canUseManifest) {
      setGalleryEmptyStateContent(
        "Firebase Storage konnte nicht geladen werden",
        "Die Online-Galerie konnte nicht aus Firebase Storage gelesen werden. Bitte pruefe Login, Storage Rules und ob der Bucket korrekt eingerichtet ist."
      );
    }
  }

  renderGalleryMonthTabs();

  if (!galleryMonths.length) {
    galleryGrid.innerHTML = "";
    updateGallerySummary(null, 0);
    showGalleryEmptyState(true);
    return;
  }

  await setActiveGalleryMonth(galleryMonths[galleryMonths.length - 1].id);
}

function renderGalleryMonthTabs() {
  const monthTabs = document.getElementById("galleryMonthTabs");
  if (!monthTabs) {
    return;
  }

  monthTabs.innerHTML = "";

  galleryMonths.forEach(function(month) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-month-btn";
    button.dataset.monthId = month.id;
    button.textContent = month.label;
    button.addEventListener("click", function() {
      setActiveGalleryMonth(month.id);
    });
    monthTabs.appendChild(button);
  });
}

async function setActiveGalleryMonth(monthId) {
  activeGalleryMonth = monthId;

  document.querySelectorAll(".gallery-month-btn").forEach(function(button) {
    button.classList.toggle("active", button.dataset.monthId === monthId);
  });

  await renderGalleryItems(monthId);
}

async function renderGalleryItems(monthId) {
  const galleryGrid = document.getElementById("galleryGrid");
  if (!galleryGrid) {
    return;
  }

  showGalleryLoading("Erinnerungen werden geladen...");

  let items = [];
  const fallbackItems = canUseHostedGalleryManifest() ? getFallbackGalleryItems(monthId) : [];

  try {
    if (gallerySource === "storage") {
      items = await getStorageGalleryItems(monthId);
    } else if (gallerySource === "hybrid") {
      const storageItems = await getStorageGalleryItems(monthId);
      items = mergeGalleryItems(storageItems, fallbackItems);
    } else {
      items = fallbackItems;
    }
  } catch (error) {
    console.error("Fehler beim Laden der Galerie-Dateien:", error);
    items = fallbackItems;
    if (items.length) {
      gallerySource = "manifest";
    } else if (!canUseHostedGalleryManifest()) {
      setGalleryEmptyStateContent(
        "Dateien konnten nicht geladen werden",
        "Die Medien dieses Monats konnten nicht aus Firebase Storage geladen werden. Bitte pruefe, ob die Dateien dort hochgeladen wurden und ob dein Konto Zugriff hat."
      );
    }
  }

  galleryGrid.innerHTML = "";

  if (!items.length) {
    updateGallerySummary(monthId, 0);
    showGalleryEmptyState(true);
    return;
  }

  showGalleryEmptyState(false);

  items.forEach(function(item) {
    const card = document.createElement("article");
    card.className = "gallery-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");

    const itemType = item.type === "video" ? "video" : "image";
    const label = item.caption || item.alt || (itemType === "video" ? "Video" : "Foto");
    card.setAttribute("aria-label", label);

    const mediaWrapper = document.createElement("div");
    mediaWrapper.className = "gallery-card-media";

    if (itemType === "video") {
      const video = document.createElement("video");
      video.className = "gallery-card-preview";
      video.src = item.src;
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      mediaWrapper.appendChild(video);
    } else {
      const image = document.createElement("img");
      image.className = "gallery-card-preview";
      image.src = item.src;
      image.alt = item.alt || label;
      image.loading = "lazy";
      mediaWrapper.appendChild(image);
    }

    const badge = document.createElement("span");
    badge.className = "gallery-card-badge";
    badge.textContent = itemType === "video" ? "Video" : "Foto";
    mediaWrapper.appendChild(badge);

    const content = document.createElement("div");
    content.className = "gallery-card-content";

    const caption = document.createElement("p");
    caption.className = "gallery-card-caption";
    caption.textContent = label;

    content.appendChild(caption);
    card.appendChild(mediaWrapper);
    card.appendChild(content);

    card.addEventListener("click", function() {
      openMediaLightbox(item);
    });

    card.addEventListener("keydown", function(event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMediaLightbox(item);
      }
    });

    galleryGrid.appendChild(card);
  });

  updateGallerySummary(monthId, items.length);
}

function updateGallerySummary(monthId, itemCount) {
  const summary = document.getElementById("gallerySummary");
  if (!summary) {
    return;
  }

  if (!monthId) {
    summary.textContent = "Noch keine Monate verfuegbar.";
    return;
  }

  const mediaLabel = itemCount === 1 ? "1 Erinnerung" : `${itemCount} Erinnerungen`;
  summary.textContent = `${formatMonthLabel(monthId)} · ${mediaLabel}`;
}

function showGalleryEmptyState(isEmpty) {
  const emptyState = document.getElementById("galleryEmptyState");
  if (!emptyState) {
    return;
  }

  const titleElement = emptyState.querySelector("h3");
  const messageElement = emptyState.querySelector("p");

  if (titleElement) {
    titleElement.textContent = galleryEmptyStateTitle;
  }

  if (messageElement) {
    messageElement.textContent = galleryEmptyStateMessage;
  }

  emptyState.classList.toggle("hidden", !isEmpty);
}

function initializeMediaLightbox() {
  const lightbox = document.getElementById("mediaLightbox");
  if (!lightbox || lightbox.dataset.bound === "true") {
    return;
  }

  lightbox.dataset.bound = "true";

  lightbox.addEventListener("click", function(event) {
    if (event.target === lightbox) {
      closeMediaLightbox();
    }
  });

  document.addEventListener("keydown", function(event) {
    if (event.key === "Escape") {
      closeMediaLightbox();
    }
  });
}

function openMediaLightbox(item) {
  const lightbox = document.getElementById("mediaLightbox");
  const lightboxContent = document.getElementById("mediaLightboxContent");
  const lightboxCaption = document.getElementById("mediaLightboxCaption");

  if (!lightbox || !lightboxContent || !lightboxCaption) {
    return;
  }

  const itemType = item.type === "video" ? "video" : "image";
  lightboxContent.innerHTML = "";

  if (itemType === "video") {
    const video = document.createElement("video");
    video.className = "media-lightbox-media";
    video.src = item.src;
    video.controls = true;
    video.preload = "metadata";
    video.playsInline = true;
    lightboxContent.appendChild(video);
  } else {
    const image = document.createElement("img");
    image.className = "media-lightbox-media";
    image.src = item.src;
    image.alt = item.alt || item.caption || "Erinnerung";
    image.loading = "eager";
    lightboxContent.appendChild(image);
  }

  lightboxCaption.textContent = item.caption || item.alt || formatMonthLabel(activeGalleryMonth || "");
  lightbox.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeMediaLightbox() {
  const lightbox = document.getElementById("mediaLightbox");
  const lightboxContent = document.getElementById("mediaLightboxContent");

  if (!lightbox || !lightboxContent) {
    return;
  }

  lightbox.classList.add("hidden");
  lightboxContent.innerHTML = "";
  document.body.style.overflow = "";
}

function buildUploadMonthOptions() {
  const months = [];
  const cursor = new Date(GALLERY_START_YEAR, GALLERY_START_MONTH - 1, 1);
  const currentDate = new Date();
  const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const latestKnownMonthId = getLatestKnownGalleryMonthId();
  const latestKnownMonth = latestKnownMonthId ? parseMonthIdToDate(latestKnownMonthId) : null;
  const baseEndMonth = latestKnownMonth && latestKnownMonth > currentMonth ? latestKnownMonth : currentMonth;
  const finalMonth = new Date(baseEndMonth.getFullYear(), baseEndMonth.getMonth() + GALLERY_UPLOAD_MONTH_BUFFER, 1);

  while (cursor <= finalMonth) {
    const monthId = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      id: monthId,
      label: formatMonthLabel(monthId)
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function getUploadInputs() {
  return [
    document.getElementById("galleryMediaInput"),
    document.getElementById("galleryFolderInput")
  ].filter(Boolean);
}

function countSupportedUploadFiles(input) {
  return Array.from((input && input.files) || []).filter(function(file) {
    return Boolean(detectMediaTypeFromName(file.name));
  }).length;
}

function getActiveUploadInput() {
  const activeInputId = document.body.dataset.activeUploadInputId;

  if (activeInputId) {
    const activeInput = document.getElementById(activeInputId);
    if (activeInput && activeInput.files && activeInput.files.length) {
      return activeInput;
    }
  }

  return getUploadInputs().find(function(input) {
    return input.files && input.files.length;
  }) || null;
}

function clearInactiveUploadInputs(activeInput) {
  getUploadInputs().forEach(function(input) {
    if (input !== activeInput) {
      input.value = "";
    }
  });
}

function getUploadSourceLabel(input) {
  if (!input) {
    return "Auswahl";
  }

  return input.id === "galleryFolderInput" ? "Ordnerauswahl" : "Medienauswahl";
}

function bindUploadSelectionInput(input, monthSelect) {
  if (!input || input.dataset.bound === "true") {
    return;
  }

  input.dataset.bound = "true";
  input.addEventListener("change", function() {
    const totalFiles = countSupportedUploadFiles(input);

    if (!input.files || !input.files.length) {
      if (document.body.dataset.activeUploadInputId === input.id) {
        delete document.body.dataset.activeUploadInputId;
      }
      return;
    }

    document.body.dataset.activeUploadInputId = input.id;
    clearInactiveUploadInputs(input);

    if (!totalFiles) {
      updateUploadStatus("Keine unterstuetzten Fotos oder Videos ausgewaehlt.", true);
      return;
    }

    updateUploadStatus(`${totalFiles} Dateien aus der ${getUploadSourceLabel(input)} bereit fuer ${formatMonthLabel(monthSelect.value)}.`);
  });
}

function initializeUploadPage() {
  const monthSelect = document.getElementById("uploadMonthSelect");
  const uploadBtn = document.getElementById("galleryUploadBtn");
  const uploadInputs = getUploadInputs();

  if (!monthSelect || !uploadBtn || !uploadInputs.length) {
    return;
  }

  const monthOptions = buildUploadMonthOptions();

  if (!monthSelect.options.length) {
    monthOptions.forEach(function(month) {
      const option = document.createElement("option");
      option.value = month.id;
      option.textContent = month.label;
      monthSelect.appendChild(option);
    });
  }

  if (!monthSelect.value) {
    const latestKnownMonthId = getLatestKnownGalleryMonthId();
    const suggestedMonthId = latestKnownMonthId || createMonthIdFromDate(new Date());
    const hasSuggestedMonth = monthOptions.some(function(month) {
      return month.id === suggestedMonthId;
    });

    monthSelect.value = hasSuggestedMonth ? suggestedMonthId : monthOptions[monthOptions.length - 1].id;
  }

  uploadInputs.forEach(function(input) {
    bindUploadSelectionInput(input, monthSelect);
  });

  if (uploadBtn.dataset.bound !== "true") {
    uploadBtn.dataset.bound = "true";
    uploadBtn.addEventListener("click", handleGalleryUpload);
  }
}

function sanitizeStoragePath(path) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
}

function buildUploadRelativePath(file, monthId) {
  const rawPath = file.webkitRelativePath || file.name;
  const segments = rawPath.split("/").filter(Boolean);

  if (!segments.length) {
    return file.name;
  }

  if (segments[0] === monthId) {
    segments.shift();
  } else if (segments.length > 1 && segments[1] === monthId) {
    segments.splice(0, 2);
  } else if (segments.length > 1) {
    segments.shift();
  }

  return sanitizeStoragePath(segments.join("/") || file.name);
}

function updateUploadStatus(message, isError) {
  const uploadStatus = document.getElementById("uploadStatus");
  if (!uploadStatus) {
    return;
  }

  uploadStatus.textContent = message;
  uploadStatus.classList.toggle("error", Boolean(isError));
}

function setUploadProgress(progressPercent) {
  const progress = document.getElementById("uploadProgress");
  const progressBar = document.getElementById("uploadProgressBar");

  if (!progress || !progressBar) {
    return;
  }

  progress.classList.remove("hidden");
  progressBar.style.width = `${Math.max(0, Math.min(progressPercent, 100))}%`;
}

function resetUploadProgress() {
  const progress = document.getElementById("uploadProgress");
  const progressBar = document.getElementById("uploadProgressBar");

  if (!progress || !progressBar) {
    return;
  }

  progress.classList.add("hidden");
  progressBar.style.width = "0%";
}

function setUploadBusy(isBusy) {
  const uploadBtn = document.getElementById("galleryUploadBtn");
  const monthSelect = document.getElementById("uploadMonthSelect");

  if (uploadBtn) {
    uploadBtn.disabled = isBusy;
    uploadBtn.textContent = isBusy ? "Upload laeuft..." : "Zu Firebase hochladen";
  }

  getUploadInputs().forEach(function(input) {
    input.disabled = isBusy;
  });

  if (monthSelect) {
    monthSelect.disabled = isBusy;
  }
}

function getFriendlyStorageErrorMessage(error) {
  const errorCode = error && error.code ? error.code : "unknown";

  if (errorCode === "storage/unauthorized") {
    return "Keine Berechtigung fuer Firebase Storage. Bitte pruefe Auth und Storage Rules.";
  }

  if (errorCode === "storage/canceled") {
    return "Upload wurde abgebrochen.";
  }

  if (errorCode === "storage/retry-limit-exceeded") {
    return "Upload hat das Wiederholungslimit erreicht. Bitte versuche es erneut.";
  }

  return "Upload oder Download aus Firebase Storage ist fehlgeschlagen.";
}

function uploadFileToStorage(path, file) {
  return new Promise(function(resolve, reject) {
    const metadata = file.type ? { contentType: file.type } : undefined;
    const uploadTask = storageRefFactory(path).put(file, metadata);

    uploadTask.on(
      "state_changed",
      null,
      reject,
      resolve
    );
  });
}

async function handleGalleryUpload() {
  const monthSelect = document.getElementById("uploadMonthSelect");
  const uploadInput = getActiveUploadInput();

  if (!monthSelect || !storageRefFactory) {
    return;
  }

  const monthId = monthSelect.value;
  const selectedFiles = Array.from((uploadInput && uploadInput.files) || []);
  const mediaFiles = selectedFiles.filter(function(file) {
    return Boolean(detectMediaTypeFromName(file.name));
  });

  if (!monthId) {
    updateUploadStatus("Bitte waehle zuerst einen Monat aus.", true);
    return;
  }

  if (!mediaFiles.length) {
    updateUploadStatus("Bitte waehle zuerst Fotos/Videos oder am Desktop einen Monatsordner aus.", true);
    return;
  }

  setUploadBusy(true);
  setUploadProgress(0);
  updateUploadStatus(`Upload fuer ${formatMonthLabel(monthId)} wird vorbereitet...`);

  try {
    for (let index = 0; index < mediaFiles.length; index += 1) {
      const file = mediaFiles[index];
      const relativePath = buildUploadRelativePath(file, monthId);
      const targetPath = `${GALLERY_STORAGE_ROOT}/${monthId}/${relativePath}`;

      await uploadFileToStorage(targetPath, file);

      const progressPercent = ((index + 1) / mediaFiles.length) * 100;
      setUploadProgress(progressPercent);
      updateUploadStatus(`${index + 1} von ${mediaFiles.length} hochgeladen: ${file.name}`);
    }

    galleryMonths = [];
    galleryItemsCache = {};
    getUploadInputs().forEach(function(input) {
      input.value = "";
    });
    delete document.body.dataset.activeUploadInputId;
    updateUploadStatus(`Upload abgeschlossen: ${mediaFiles.length} Dateien fuer ${formatMonthLabel(monthId)}.`);
    resetUploadProgress();
  } catch (error) {
    console.error("Firebase Upload fehlgeschlagen:", error);
    updateUploadStatus(getFriendlyStorageErrorMessage(error), true);
  } finally {
    setUploadBusy(false);
  }
}

window.addTodo = addTodo;
window.toggleTodo = toggleTodo;
window.deleteTodo = deleteTodo;
window.changeMonth = changeMonth;
window.goBack = goBack;
window.loadEvents = loadEvents;
window.loadTodos = loadTodos;
window.openGallery = openGallery;
window.openTools = openTools;
window.openUpload = openUpload;
window.showLetter = showLetter;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.closePopup = closePopup;
window.closeMediaLightbox = closeMediaLightbox;