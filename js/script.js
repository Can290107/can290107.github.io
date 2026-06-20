const PRIVATE_PAGES = ["tools.html", "gallery.html", "secret.html"];
const AUTH_SESSION_DAY_KEY = "authSessionDay";
const AUTH_USERNAME_KEY = "authUsername";
const LEGACY_LOGIN_USER_KEY = "loggedInUser";
const LEGACY_LOGIN_TIME_KEY = "loginTimestamp";
const ACTIVITY_COLLECTION = "activity";
const ACTIVITY_RECEIPTS_COLLECTION = "activityReceipts";
const ACTIVITY_FEED_LIMIT = 100;
const GALLERY_STORAGE_ROOT = window.galleryStorageRoot || "gallery";
const GALLERY_START_YEAR = 2025;
const GALLERY_START_MONTH = 4;
const GALLERY_UPLOAD_MONTH_BUFFER = 12;
const ANNIVERSARY_SPECIAL_AUTO_DAY = "2026-06-21";
const ANNIVERSARY_SPECIAL_UNLOCK_DAY = "2026-06-21";
const ANNIVERSARY_SPECIAL_STORAGE_KEY = "yearSpecial365AutoShown";
const ANNIVERSARY_SPECIAL_TYPING_DELAY_MS = 28;
const ANNIVERSARY_SPECIAL_SLIDE_INTERVAL_MS = 4200;
const ANNIVERSARY_SPECIAL_STORY_TEXT = "365 Tage. Ein ganzes Jahr voller erster Male, leiser Sekunden und Erinnerungen, die nur uns gehoeren. Das hier ist unser kleines Kino fuer unser erstes gemeinsames Jahr.";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v"];

const authService = window.firebaseAuth;
const authUserMap = window.authUserMap || {};
const storageRefFactory = window.storageRef;

let currentEventKey = null;
let activeGalleryMonth = null;
let activeLightboxItem = null;
let todoUnsubscribe = null;
let eventsUnsubscribe = null;
let activityUnsubscribe = null;
let activityReceiptsUnsubscribe = null;
let calendarEvents = {};
let pageFeaturesInitialized = false;
let galleryMonths = [];
let galleryItemsCache = {};
let gallerySource = "storage";
let gallerySortMode = "newest";
let galleryEmptyStateTitle = "Noch keine Erinnerungen fuer diesen Monat";
let galleryEmptyStateMessage = "Lade den Monatsordner in Firebase Storage hoch oder nutze fuer lokal gespeicherte Dateien das bestehende Galerie-Manifest als Fallback.";
let activityFeedLoaded = false;
let activityReceiptsLoaded = false;
let activityFeedItems = [];
let pendingTodoTargetId = "";
let pendingEventTargetKey = "";
let pendingToolsSection = "";
let pendingToolsMonthId = "";
let pendingGalleryTargetPath = "";
let pendingGalleryTargetMonthId = "";
const seenActivityIds = new Set();
let activeActivityPopup = null;
let activityPopupExpanded = false;
let anniversarySpecialSlides = [];
let anniversarySpecialCurrentSlideIndex = 0;
let anniversarySpecialAutoPlayTimer = null;
let anniversarySpecialAutoOpenTimer = null;
let anniversarySpecialTextTimer = null;
let anniversarySpecialLoadingPromise = null;

document.addEventListener("DOMContentLoaded", function() {
  initializePendingNavigationTargets();
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

function getStoredUsername() {
  return (localStorage.getItem(AUTH_USERNAME_KEY) || "").trim().toLowerCase();
}

function getCurrentActorKey() {
  const storedUsername = getStoredUsername();
  if (storedUsername) {
    return storedUsername;
  }

  const currentUser = authService && authService.currentUser;
  if (!currentUser || !currentUser.email) {
    return "";
  }

  const email = currentUser.email.toLowerCase();
  const mappedUsername = Object.keys(authUserMap).find(function(username) {
    return String(authUserMap[username] || "").toLowerCase() === email;
  });

  return mappedUsername || email.split("@")[0];
}

function formatActorLabel(actorKey) {
  if (!actorKey) {
    return "Jemand";
  }

  return actorKey
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(function(part) {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ") || "Jemand";
}

function getCurrentActorLabel() {
  return formatActorLabel(getCurrentActorKey());
}

function parseEventKey(eventKey) {
  const parts = String(eventKey || "").split("-");
  if (parts.length !== 3) {
    return null;
  }

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if ([year, month, day].some(function(value) {
    return Number.isNaN(value);
  })) {
    return null;
  }

  return { year: year, month: month, day: day };
}

function getMonthIdFromEventKey(eventKey) {
  const parsedEvent = parseEventKey(eventKey);
  if (!parsedEvent) {
    return "";
  }

  return createMonthIdFromDate(new Date(parsedEvent.year, parsedEvent.month, 1));
}

function formatCalendarDate(year, month, day) {
  return new Date(year, month, day).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function formatCalendarDateFromEventKey(eventKey) {
  const parsedEvent = parseEventKey(eventKey);
  if (!parsedEvent) {
    return "";
  }

  return formatCalendarDate(parsedEvent.year, parsedEvent.month, parsedEvent.day);
}

function clearNavigationParams(paramNames) {
  if (!Array.isArray(paramNames) || !paramNames.length || !window.history || typeof window.history.replaceState !== "function") {
    return;
  }

  const url = new URL(window.location.href);
  let changed = false;

  paramNames.forEach(function(paramName) {
    if (url.searchParams.has(paramName)) {
      url.searchParams.delete(paramName);
      changed = true;
    }
  });

  if (changed) {
    const search = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${search ? `?${search}` : ""}${url.hash}`);
  }
}

function initializePendingNavigationTargets() {
  const params = new URLSearchParams(window.location.search);
  const currentPage = getCurrentPageName();

  if (currentPage === "tools.html") {
    pendingTodoTargetId = params.get("todo") || "";
    pendingEventTargetKey = params.get("event") || "";
    pendingToolsSection = params.get("section") || "";
    pendingToolsMonthId = params.get("month") || "";

    const eventMonthId = getMonthIdFromEventKey(pendingEventTargetKey);
    const preferredMonthId = eventMonthId || pendingToolsMonthId;
    const preferredMonthDate = preferredMonthId ? parseMonthIdToDate(preferredMonthId) : null;

    if (preferredMonthDate) {
      currentDate = preferredMonthDate;
    }
  }

  if (currentPage === "gallery.html") {
    pendingGalleryTargetMonthId = params.get("month") || "";
    pendingGalleryTargetPath = params.get("item") || "";
  }
}

function ensureActivityPopupStack() {
  let stack = document.getElementById("activityPopupStack");
  if (stack) {
    return stack;
  }

  stack = document.createElement("div");
  stack.id = "activityPopupStack";
  stack.className = "activity-popup-stack";
  document.body.appendChild(stack);
  return stack;
}

function removeActivityPopup(popup) {
  if (!popup || popup.dataset.removing === "true") {
    return;
  }

  popup.dataset.removing = "true";
  popup.classList.remove("visible");

  if (popup === activeActivityPopup) {
    activeActivityPopup = null;
    activityPopupExpanded = false;
  }

  setTimeout(function() {
    popup.remove();
  }, 220);
}

function canShowActivityPopup() {
  if (getCurrentPageName() !== "index.html") {
    return false;
  }

  const mainContent = document.getElementById("mainContent");
  return Boolean(mainContent && mainContent.style.display !== "none");
}

function buildActivityTargetUrl(activity) {
  if (!activity || !activity.section) {
    return "";
  }

  if (activity.section === "gallery") {
    const galleryUrl = new URL("gallery.html", window.location.href);
    if (activity.monthId) {
      galleryUrl.searchParams.set("month", activity.monthId);
    }
    if (activity.storagePath && activity.action !== "delete") {
      galleryUrl.searchParams.set("item", activity.storagePath);
    }
    return galleryUrl.toString();
  }

  if (activity.section === "calendar") {
    const toolsUrl = new URL("tools.html", window.location.href);
    toolsUrl.searchParams.set("section", "calendar");
    if (activity.monthId) {
      toolsUrl.searchParams.set("month", activity.monthId);
    }
    if (activity.eventKey && activity.action !== "delete") {
      toolsUrl.searchParams.set("event", activity.eventKey);
    }
    return toolsUrl.toString();
  }

  if (activity.section === "todo") {
    const toolsUrl = new URL("tools.html", window.location.href);
    toolsUrl.searchParams.set("section", "todo");
    if (activity.todoId && activity.action !== "delete") {
      toolsUrl.searchParams.set("todo", activity.todoId);
    }
    return toolsUrl.toString();
  }

  return "";
}

function buildActivityReceiptDocId(userUid, activityId) {
  return `${userUid}__${activityId}`;
}

function normalizeActivityRecord(docItem) {
  const data = docItem.data() || {};
  return Object.assign({ id: docItem.id }, data);
}

function getUnseenActivities() {
  const currentUser = authService && authService.currentUser;
  const currentActorKey = getCurrentActorKey();

  return activityFeedItems
    .filter(function(activity) {
      if (!activity || !activity.id) {
        return false;
      }

      if (currentUser && activity.actorUid && activity.actorUid === currentUser.uid) {
        return false;
      }

      if (!activity.actorUid && currentActorKey && activity.actorKey === currentActorKey) {
        return false;
      }

      if (seenActivityIds.has(activity.id)) {
        return false;
      }

      return Boolean(buildActivityTargetUrl(activity));
    })
    .sort(function(firstActivity, secondActivity) {
      return (secondActivity.createdAtMs || 0) - (firstActivity.createdAtMs || 0);
    });
}

function syncActivityPopups() {
  if (!canShowActivityPopup() || !activityFeedLoaded || !activityReceiptsLoaded) {
    return;
  }

  const unseenActivities = getUnseenActivities();

  if (!unseenActivities.length) {
    if (activeActivityPopup) {
      removeActivityPopup(activeActivityPopup);
    }
    return;
  }

  showActivityPopup(unseenActivities);
}

async function markActivitiesAsSeen(activityIds) {
  const currentUser = authService && authService.currentUser;
  const normalizedIds = Array.from(new Set((activityIds || []).filter(Boolean)));

  if (!currentUser || !normalizedIds.length) {
    return false;
  }

  const seenAtMs = Date.now();

  normalizedIds.forEach(function(activityId) {
    seenActivityIds.add(activityId);
  });
  syncActivityPopups();

  const failedIds = [];

  await Promise.all(normalizedIds.map(async function(activityId) {
    try {
      await setDoc(doc(ACTIVITY_RECEIPTS_COLLECTION, buildActivityReceiptDocId(currentUser.uid, activityId)), {
        userUid: currentUser.uid,
        activityId: activityId,
        seenAtMs: seenAtMs
      });
    } catch (error) {
      failedIds.push(activityId);
      console.error("Aktivitaetsstatus konnte nicht gespeichert werden:", error);
    }
  }));

  if (failedIds.length) {
    failedIds.forEach(function(activityId) {
      seenActivityIds.delete(activityId);
    });
    syncActivityPopups();
    return false;
  }

  return true;
}

async function markActivityAsSeen(activityId) {
  return markActivitiesAsSeen([activityId]);
}

function createActivityContentButton(activity, buttonClassName) {
  const targetUrl = buildActivityTargetUrl(activity);
  if (!activity || !activity.id || !targetUrl) {
    return null;
  }

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = buttonClassName;

  const title = document.createElement("strong");
  title.className = "activity-popup-title";
  title.textContent = activity.title || "Neue Änderung";

  const body = document.createElement("p");
  body.className = "activity-popup-body";
  body.textContent = activity.description || "Tippe hier, um direkt zur Änderung zu springen.";

  const linkHint = document.createElement("span");
  linkHint.className = "activity-popup-link";
  linkHint.textContent = "Öffnen";

  openButton.addEventListener("click", async function() {
    await markActivityAsSeen(activity.id);
    window.location.href = targetUrl;
  });

  openButton.appendChild(title);
  openButton.appendChild(body);
  openButton.appendChild(linkHint);
  return openButton;
}

function createActivityItem(activity) {
  const itemButton = createActivityContentButton(activity, "activity-popup-item-open");
  if (!itemButton) {
    return null;
  }

  const item = document.createElement("article");
  item.className = "activity-popup-item";

  const dismissButton = document.createElement("button");
  dismissButton.type = "button";
  dismissButton.className = "activity-popup-item-dismiss";
  dismissButton.setAttribute("aria-label", "Einzelne Benachrichtigung schliessen");
  dismissButton.textContent = "×";
  dismissButton.addEventListener("click", function(event) {
    event.preventDefault();
    event.stopPropagation();
    void markActivityAsSeen(activity.id);
  });

  item.appendChild(itemButton);
  item.appendChild(dismissButton);
  return item;
}

function createActivitySummaryToggle(unseenActivities) {
  const toggleButton = document.createElement("button");
  const activityCount = unseenActivities.length;
  const titleText = `${activityCount} ungesehene ${activityCount === 1 ? "Änderung" : "Änderungen"}`;
  const bodyText = activityPopupExpanded
    ? "Tippe hier, um die Liste wieder kompakt anzuzeigen."
    : `Tippe hier, um alle ${activityCount} Meldungen aufzuklappen.`;

  toggleButton.type = "button";
  toggleButton.className = "activity-popup-summary-toggle";
  toggleButton.addEventListener("click", function() {
    activityPopupExpanded = !activityPopupExpanded;
    syncActivityPopups();
  });

  const title = document.createElement("strong");
  title.className = "activity-popup-title";
  title.textContent = titleText;

  const body = document.createElement("p");
  body.className = "activity-popup-body";
  body.textContent = bodyText;

  const linkHint = document.createElement("span");
  linkHint.className = "activity-popup-link";
  linkHint.textContent = activityPopupExpanded ? "Weniger anzeigen" : "Alle anzeigen";

  toggleButton.appendChild(title);
  toggleButton.appendChild(body);
  toggleButton.appendChild(linkHint);
  return toggleButton;
}

function showActivityPopup(unseenActivities) {
  if (!canShowActivityPopup() || !unseenActivities || !unseenActivities.length) {
    return;
  }

  const stack = ensureActivityPopupStack();
  const isSingleActivity = unseenActivities.length === 1;
  const popup = activeActivityPopup || document.createElement("article");
  const shouldKeepVisible = popup.classList.contains("visible");

  if (isSingleActivity) {
    activityPopupExpanded = false;
  }

  popup.className = "activity-popup";
  if (shouldKeepVisible) {
    popup.classList.add("visible");
  }
  popup.dataset.grouped = isSingleActivity ? "false" : "true";
  popup.classList.toggle("activity-popup-expanded", !isSingleActivity && activityPopupExpanded);
  popup.replaceChildren();

  const dismissButton = document.createElement("button");
  dismissButton.type = "button";
  dismissButton.className = "activity-popup-dismiss";
  dismissButton.setAttribute("aria-label", isSingleActivity ? "Benachrichtigung schliessen" : "Alle Benachrichtigungen schliessen");
  dismissButton.textContent = "×";

  dismissButton.addEventListener("click", function(event) {
    event.preventDefault();
    event.stopPropagation();
    if (isSingleActivity) {
      void markActivityAsSeen(unseenActivities[0].id);
      return;
    }

    void markActivitiesAsSeen(unseenActivities.map(function(activity) {
      return activity.id;
    }));
  });

  popup.appendChild(dismissButton);

  if (isSingleActivity) {
    const openButton = createActivityContentButton(unseenActivities[0], "activity-popup-open");
    if (!openButton) {
      return;
    }
    popup.appendChild(openButton);
  } else {
    popup.appendChild(createActivitySummaryToggle(unseenActivities));

    if (activityPopupExpanded) {
      const list = document.createElement("div");
      list.className = "activity-popup-list";

      unseenActivities.forEach(function(activity) {
        const item = createActivityItem(activity);
        if (item) {
          list.appendChild(item);
        }
      });

      popup.appendChild(list);
    }
  }

  if (!activeActivityPopup) {
    activeActivityPopup = popup;
    stack.appendChild(popup);

    requestAnimationFrame(function() {
      popup.classList.add("visible");
    });
    return;
  }

  if (!stack.contains(popup)) {
    stack.appendChild(popup);
  }
}

async function publishActivity(payload) {
  const currentUser = authService && authService.currentUser;
  if (!currentUser || !payload || !payload.section || !payload.title) {
    return;
  }

  try {
    await addDoc(collection(ACTIVITY_COLLECTION), {
      section: payload.section,
      action: payload.action || "update",
      title: payload.title,
      description: payload.description || "",
      actorUid: currentUser.uid,
      actorKey: getCurrentActorKey(),
      actorLabel: getCurrentActorLabel(),
      todoId: payload.todoId || "",
      eventKey: payload.eventKey || "",
      monthId: payload.monthId || "",
      storagePath: payload.storagePath || "",
      createdAtMs: Date.now()
    });
  } catch (error) {
    console.error("Aktivität konnte nicht gespeichert werden:", error);
  }
}

function resetActivityNotifications() {
  if (activityUnsubscribe) {
    activityUnsubscribe();
    activityUnsubscribe = null;
  }

  if (activityReceiptsUnsubscribe) {
    activityReceiptsUnsubscribe();
    activityReceiptsUnsubscribe = null;
  }

  activityFeedLoaded = false;
  activityReceiptsLoaded = false;
  activityFeedItems = [];
  seenActivityIds.clear();
  activeActivityPopup = null;
  activityPopupExpanded = false;

  const stack = document.getElementById("activityPopupStack");
  if (stack) {
    stack.innerHTML = "";
  }
}

function initializeActivityNotifications() {
  if (activityUnsubscribe || activityReceiptsUnsubscribe || getCurrentPageName() !== "index.html") {
    return;
  }

  const currentUser = authService && authService.currentUser;
  if (!currentUser) {
    return;
  }

  activityReceiptsUnsubscribe = collection(ACTIVITY_RECEIPTS_COLLECTION)
    .where("userUid", "==", currentUser.uid)
    .onSnapshot(function(snapshot) {
      seenActivityIds.clear();

      snapshot.forEach(function(docItem) {
        const receipt = docItem.data();
        if (receipt && receipt.activityId) {
          seenActivityIds.add(receipt.activityId);
        }
      });

      activityReceiptsLoaded = true;
      syncActivityPopups();
    }, function(error) {
      console.error("Aktivitaetsstatus konnte nicht geladen werden:", error);
    });

  activityUnsubscribe = collection(ACTIVITY_COLLECTION)
    .orderBy("createdAtMs", "desc")
    .limit(ACTIVITY_FEED_LIMIT)
    .onSnapshot(function(snapshot) {
      activityFeedItems = snapshot.docs.map(function(docItem) {
        return normalizeActivityRecord(docItem);
      });
      activityFeedLoaded = true;
      syncActivityPopups();
    }, function(error) {
      console.error("Aktivitäts-Feed konnte nicht geladen werden:", error);
    });
}

function highlightActivityTarget(element) {
  if (!element) {
    return;
  }

  element.classList.remove("activity-target-highlight");
  void element.offsetWidth;
  element.classList.add("activity-target-highlight");

  setTimeout(function() {
    element.classList.remove("activity-target-highlight");
  }, 2400);
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

  if (getCurrentPageName() === "index.html") {
    syncAnniversarySpecialAvailability();
    maybeAutoOpenAnniversarySpecial();
  }
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
    initializeActivityNotifications();
  }

  if (!pageFeaturesInitialized) {
    pageFeaturesInitialized = true;
    initializePageFeatures();
  }
}

function handleSignedOutState() {
  resetActivityNotifications();
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

  initializeAnniversarySpecial();
}

function initializePageFeatures() {
  const currentPage = getCurrentPageName();

  if (currentPage === "tools.html") {
    loadTodos();
    loadEvents();
  }

  if (currentPage === "gallery.html") {
    initializeGalleryPage(pendingGalleryTargetMonthId || undefined);
  }

  if (currentPage === "secret.html") {
    initializeUploadPage();
  }
}

function createLocalCalendarDate(year, month, day) {
  return new Date(year, month - 1, day);
}

function parseLocalDayKey(dayKey) {
  const parts = String(dayKey || "").split("-");
  if (parts.length !== 3) {
    return null;
  }

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if ([year, month, day].some(function(value) {
    return Number.isNaN(value);
  })) {
    return null;
  }

  return createLocalCalendarDate(year, month, day);
}

function getLocalCalendarDayTimestamp(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function getFullLocalDayDifference(startDate, endDate) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const normalizedStart = getLocalCalendarDayTimestamp(startDate);
  const normalizedEnd = getLocalCalendarDayTimestamp(endDate);

  return Math.floor((normalizedEnd - normalizedStart) / millisecondsPerDay);
}

function isOnOrAfterLocalDayKey(currentDayKey, comparisonDayKey) {
  const currentDate = parseLocalDayKey(currentDayKey);
  const comparisonDate = parseLocalDayKey(comparisonDayKey);

  if (!currentDate || !comparisonDate) {
    return false;
  }

  return getLocalCalendarDayTimestamp(currentDate) >= getLocalCalendarDayTimestamp(comparisonDate);
}

function getRelationshipCounterValues(referenceDate) {
  const startDate = createLocalCalendarDate(2025, 4, 14);
  const relationshipDate = createLocalCalendarDate(2025, 6, 21);
  const today = referenceDate || new Date();

  return {
    daysKnown: getFullLocalDayDifference(startDate, today),
    daysTogether: getFullLocalDayDifference(relationshipDate, today)
  };
}

function updateRelationshipCounter() {
  const counterValues = getRelationshipCounterValues(new Date());

  const togetherEl = document.getElementById("daysTogether");
  const relationshipEl = document.getElementById("daysRelationship");

  if (togetherEl && relationshipEl) {
    togetherEl.textContent = counterValues.daysKnown + " Tage kennen";
    relationshipEl.textContent = counterValues.daysTogether + " Tage zusammen ❤️";
  }
}

function getAnniversarySpecialConfiguredHighlights() {
  if (!window.anniversaryRecap || !Array.isArray(window.anniversaryRecap.highlights)) {
    return [];
  }

  return window.anniversaryRecap.highlights;
}

function isAnniversarySpecialUnlocked() {
  return isOnOrAfterLocalDayKey(getCurrentDayKey(), ANNIVERSARY_SPECIAL_UNLOCK_DAY);
}

function shouldAutoOpenAnniversarySpecial() {
  const currentDayKey = getCurrentDayKey();
  return currentDayKey === ANNIVERSARY_SPECIAL_AUTO_DAY
    && localStorage.getItem(ANNIVERSARY_SPECIAL_STORAGE_KEY) !== currentDayKey;
}

function markAnniversarySpecialAutoShown() {
  localStorage.setItem(ANNIVERSARY_SPECIAL_STORAGE_KEY, getCurrentDayKey());
}

function syncAnniversarySpecialAvailability() {
  const entry = document.getElementById("anniversarySpecialEntry");
  if (!entry) {
    return;
  }

  entry.classList.toggle("hidden", !isAnniversarySpecialUnlocked());
  updateAnniversarySpecialStats();
}

function updateAnniversarySpecialStats() {
  const counterValues = getRelationshipCounterValues(new Date());
  const milestoneValue = document.getElementById("anniversarySpecialMilestoneValue");
  const currentValue = document.getElementById("anniversarySpecialCurrentValue");
  const knownValue = document.getElementById("anniversarySpecialKnownValue");
  const highlightsValue = document.getElementById("anniversarySpecialHighlightsValue");
  const highlightCount = anniversarySpecialSlides.length || getAnniversarySpecialConfiguredHighlights().length;

  if (milestoneValue) {
    milestoneValue.textContent = "365";
  }

  if (currentValue) {
    currentValue.textContent = String(counterValues.daysTogether);
  }

  if (knownValue) {
    knownValue.textContent = String(counterValues.daysKnown);
  }

  if (highlightsValue) {
    highlightsValue.textContent = String(highlightCount);
  }
}

function initializeAnniversarySpecial() {
  if (getCurrentPageName() !== "index.html") {
    return;
  }

  const overlay = document.getElementById("anniversarySpecialOverlay");
  const triggerButton = document.getElementById("anniversarySpecialBtn");
  const closeButton = document.getElementById("anniversarySpecialCloseBtn");
  const previousButton = document.getElementById("anniversarySpecialPrevBtn");
  const nextButton = document.getElementById("anniversarySpecialNextBtn");
  const autoplayButton = document.getElementById("anniversarySpecialAutoplayBtn");

  if (triggerButton && triggerButton.dataset.bound !== "true") {
    triggerButton.dataset.bound = "true";
    triggerButton.addEventListener("click", function() {
      void openAnniversarySpecial();
    });
  }

  if (closeButton && closeButton.dataset.bound !== "true") {
    closeButton.dataset.bound = "true";
    closeButton.addEventListener("click", closeAnniversarySpecial);
  }

  if (previousButton && previousButton.dataset.bound !== "true") {
    previousButton.dataset.bound = "true";
    previousButton.addEventListener("click", function() {
      stopAnniversarySpecialAutoplay();
      showAnniversarySpecialSlide(anniversarySpecialCurrentSlideIndex - 1);
    });
  }

  if (nextButton && nextButton.dataset.bound !== "true") {
    nextButton.dataset.bound = "true";
    nextButton.addEventListener("click", function() {
      stopAnniversarySpecialAutoplay();
      showAnniversarySpecialSlide(anniversarySpecialCurrentSlideIndex + 1);
    });
  }

  if (autoplayButton && autoplayButton.dataset.bound !== "true") {
    autoplayButton.dataset.bound = "true";
    autoplayButton.addEventListener("click", toggleAnniversarySpecialAutoplay);
  }

  if (overlay && overlay.dataset.bound !== "true") {
    overlay.dataset.bound = "true";
    overlay.addEventListener("click", function(event) {
      if (event.target === overlay) {
        closeAnniversarySpecial();
      }
    });
  }

  if (document.body.dataset.anniversarySpecialKeydownBound !== "true") {
    document.body.dataset.anniversarySpecialKeydownBound = "true";
    document.addEventListener("keydown", function(event) {
      const anniversaryOverlay = document.getElementById("anniversarySpecialOverlay");
      if (!anniversaryOverlay || anniversaryOverlay.classList.contains("hidden")) {
        return;
      }

      if (event.key === "Escape") {
        closeAnniversarySpecial();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        showAnniversarySpecialSlide(anniversarySpecialCurrentSlideIndex + 1);
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showAnniversarySpecialSlide(anniversarySpecialCurrentSlideIndex - 1);
      }
    });
  }

  syncAnniversarySpecialAvailability();
}

function maybeAutoOpenAnniversarySpecial() {
  if (!shouldAutoOpenAnniversarySpecial() || anniversarySpecialAutoOpenTimer) {
    return;
  }

  anniversarySpecialAutoOpenTimer = setTimeout(function() {
    anniversarySpecialAutoOpenTimer = null;
    if (shouldAutoOpenAnniversarySpecial()) {
      void openAnniversarySpecial();
    }
  }, 1100);
}

async function resolveAnniversarySpecialSource(item) {
  if (!item) {
    return "";
  }

  if (canUseHostedGalleryManifest() && item.fallbackSrc) {
    return item.fallbackSrc;
  }

  if (item.storagePath && storageRefFactory) {
    return storageRefFactory(item.storagePath).getDownloadURL();
  }

  return item.fallbackSrc || item.src || "";
}

function renderAnniversarySpecialLoading() {
  const mediaContainer = document.getElementById("anniversarySpecialSlideMedia");
  const caption = document.getElementById("anniversarySpecialSlideCaption");
  const counter = document.getElementById("anniversarySpecialSlideCounter");

  if (mediaContainer) {
    mediaContainer.innerHTML = '<div class="anniversary-special-loader">Jahresrueckblick wird geladen...</div>';
  }

  if (caption) {
    caption.textContent = "";
  }

  if (counter) {
    counter.textContent = "...";
  }
}

function renderAnniversarySpecialEmptyState() {
  const mediaContainer = document.getElementById("anniversarySpecialSlideMedia");
  const caption = document.getElementById("anniversarySpecialSlideCaption");
  const counter = document.getElementById("anniversarySpecialSlideCounter");
  const dots = document.getElementById("anniversarySpecialDots");

  if (mediaContainer) {
    mediaContainer.innerHTML = '<div class="anniversary-special-loader">Der Rueckblick ist gerade nicht verfuegbar.</div>';
  }

  if (caption) {
    caption.textContent = "Versuche es in einem Moment noch einmal.";
  }

  if (counter) {
    counter.textContent = "0 / 0";
  }

  if (dots) {
    dots.innerHTML = "";
  }

  updateAnniversarySpecialAutoplayButton();
}

function startAnniversarySpecialStoryTyping() {
  const storyElement = document.getElementById("anniversarySpecialStory");
  if (!storyElement) {
    return;
  }

  if (anniversarySpecialTextTimer) {
    clearTimeout(anniversarySpecialTextTimer);
    anniversarySpecialTextTimer = null;
  }

  storyElement.textContent = "";

  let currentIndex = 0;
  function typeStory() {
    if (currentIndex >= ANNIVERSARY_SPECIAL_STORY_TEXT.length) {
      anniversarySpecialTextTimer = null;
      return;
    }

    storyElement.textContent += ANNIVERSARY_SPECIAL_STORY_TEXT.charAt(currentIndex);
    currentIndex += 1;
    anniversarySpecialTextTimer = setTimeout(typeStory, ANNIVERSARY_SPECIAL_TYPING_DELAY_MS);
  }

  typeStory();
}

function updateAnniversarySpecialAutoplayButton() {
  const autoplayButton = document.getElementById("anniversarySpecialAutoplayBtn");
  if (!autoplayButton) {
    return;
  }

  const canAutoplay = anniversarySpecialSlides.length > 1;
  autoplayButton.disabled = !canAutoplay;
  autoplayButton.textContent = anniversarySpecialAutoPlayTimer ? "Pause Diashow" : "Diashow starten";
}

function renderAnniversarySpecialDots() {
  const dots = document.getElementById("anniversarySpecialDots");
  if (!dots) {
    return;
  }

  dots.innerHTML = "";

  anniversarySpecialSlides.forEach(function(slide, index) {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "anniversary-special-dot";
    dot.setAttribute("aria-label", `Slide ${index + 1}: ${slide.caption || "Rueckblick"}`);
    dot.classList.toggle("active", index === anniversarySpecialCurrentSlideIndex);
    dot.addEventListener("click", function() {
      stopAnniversarySpecialAutoplay();
      showAnniversarySpecialSlide(index);
    });
    dots.appendChild(dot);
  });
}

function updateAnniversarySpecialDotState() {
  const dots = document.querySelectorAll(".anniversary-special-dot");
  dots.forEach(function(dot, index) {
    dot.classList.toggle("active", index === anniversarySpecialCurrentSlideIndex);
  });
}

function showAnniversarySpecialSlide(index) {
  if (!anniversarySpecialSlides.length) {
    renderAnniversarySpecialEmptyState();
    return;
  }

  anniversarySpecialCurrentSlideIndex = (index + anniversarySpecialSlides.length) % anniversarySpecialSlides.length;

  const slide = anniversarySpecialSlides[anniversarySpecialCurrentSlideIndex];
  const mediaContainer = document.getElementById("anniversarySpecialSlideMedia");
  const caption = document.getElementById("anniversarySpecialSlideCaption");
  const counter = document.getElementById("anniversarySpecialSlideCounter");

  if (!mediaContainer || !caption || !counter) {
    return;
  }

  mediaContainer.innerHTML = "";

  if (slide.type === "video") {
    const video = document.createElement("video");
    video.src = slide.src;
    video.controls = true;
    video.preload = "metadata";
    video.playsInline = true;
    mediaContainer.appendChild(video);
  } else {
    const image = document.createElement("img");
    image.src = slide.src;
    image.alt = slide.caption || "Jubilaeumsbild";
    image.loading = "eager";
    mediaContainer.appendChild(image);
  }

  caption.textContent = slide.caption || "";
  counter.textContent = `${anniversarySpecialCurrentSlideIndex + 1} / ${anniversarySpecialSlides.length}`;
  updateAnniversarySpecialDotState();
  updateAnniversarySpecialAutoplayButton();
}

function startAnniversarySpecialAutoplay() {
  if (anniversarySpecialAutoPlayTimer) {
    clearInterval(anniversarySpecialAutoPlayTimer);
  }

  if (anniversarySpecialSlides.length <= 1) {
    anniversarySpecialAutoPlayTimer = null;
    updateAnniversarySpecialAutoplayButton();
    return;
  }

  anniversarySpecialAutoPlayTimer = setInterval(function() {
    showAnniversarySpecialSlide(anniversarySpecialCurrentSlideIndex + 1);
  }, ANNIVERSARY_SPECIAL_SLIDE_INTERVAL_MS);

  updateAnniversarySpecialAutoplayButton();
}

function stopAnniversarySpecialAutoplay() {
  if (anniversarySpecialAutoPlayTimer) {
    clearInterval(anniversarySpecialAutoPlayTimer);
    anniversarySpecialAutoPlayTimer = null;
  }

  updateAnniversarySpecialAutoplayButton();
}

function toggleAnniversarySpecialAutoplay() {
  if (anniversarySpecialAutoPlayTimer) {
    stopAnniversarySpecialAutoplay();
    return;
  }

  startAnniversarySpecialAutoplay();
}

function loadAnniversarySpecialSlides() {
  if (anniversarySpecialSlides.length) {
    return Promise.resolve(anniversarySpecialSlides);
  }

  if (anniversarySpecialLoadingPromise) {
    return anniversarySpecialLoadingPromise;
  }

  const recapItems = getAnniversarySpecialConfiguredHighlights();

  anniversarySpecialLoadingPromise = Promise.all(recapItems.map(async function(item) {
    try {
      const resolvedSource = await resolveAnniversarySpecialSource(item);
      if (!resolvedSource) {
        return null;
      }

      return Object.assign({}, item, {
        src: resolvedSource
      });
    } catch (error) {
      console.error("Jubilaeumsbild konnte nicht geladen werden:", error);
      if (item.fallbackSrc && canUseHostedGalleryManifest()) {
        return Object.assign({}, item, {
          src: item.fallbackSrc
        });
      }

      return null;
    }
  })).then(function(items) {
    anniversarySpecialSlides = items.filter(Boolean);
    anniversarySpecialLoadingPromise = null;
    updateAnniversarySpecialStats();
    return anniversarySpecialSlides;
  }).catch(function(error) {
    anniversarySpecialLoadingPromise = null;
    console.error("Jubilaeumsrueckblick konnte nicht vorbereitet werden:", error);
    return [];
  });

  return anniversarySpecialLoadingPromise;
}

async function openAnniversarySpecial() {
  if (!isAnniversarySpecialUnlocked()) {
    return;
  }

  const overlay = document.getElementById("anniversarySpecialOverlay");
  if (!overlay) {
    return;
  }

  if (anniversarySpecialAutoOpenTimer) {
    clearTimeout(anniversarySpecialAutoOpenTimer);
    anniversarySpecialAutoOpenTimer = null;
  }

  if (getCurrentDayKey() === ANNIVERSARY_SPECIAL_AUTO_DAY) {
    markAnniversarySpecialAutoShown();
  }

  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  updateAnniversarySpecialStats();
  startAnniversarySpecialStoryTyping();
  anniversarySpecialCurrentSlideIndex = 0;

  if (typeof confetti === "function") {
    confetti({
      particleCount: 220,
      spread: 180,
      startVelocity: 32,
      origin: { y: 0.62 }
    });
  }

  if (anniversarySpecialSlides.length) {
    renderAnniversarySpecialDots();
    showAnniversarySpecialSlide(0);
    startAnniversarySpecialAutoplay();
    return;
  }

  renderAnniversarySpecialLoading();
  const loadedSlides = await loadAnniversarySpecialSlides();

  if (!loadedSlides.length) {
    renderAnniversarySpecialEmptyState();
    return;
  }

  anniversarySpecialCurrentSlideIndex = 0;
  renderAnniversarySpecialDots();
  showAnniversarySpecialSlide(0);
  startAnniversarySpecialAutoplay();
}

function closeAnniversarySpecial() {
  const overlay = document.getElementById("anniversarySpecialOverlay");
  if (!overlay) {
    return;
  }

  overlay.classList.add("hidden");
  document.body.style.overflow = "";
  stopAnniversarySpecialAutoplay();

  if (anniversarySpecialTextTimer) {
    clearTimeout(anniversarySpecialTextTimer);
    anniversarySpecialTextTimer = null;
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

function focusRequestedTodoTarget() {
  const list = document.getElementById("todoList");
  if (!list) {
    return;
  }

  const todoSection = list.closest("section");

  if (pendingTodoTargetId) {
    const targetItem = Array.from(list.querySelectorAll(".todo-item")).find(function(item) {
      return item.dataset.todoId === pendingTodoTargetId;
    });

    if (todoSection) {
      todoSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    if (targetItem) {
      highlightActivityTarget(targetItem);
    }

    pendingTodoTargetId = "";
    pendingToolsSection = "";
    clearNavigationParams(["todo", "section"]);
    return;
  }

  if (pendingToolsSection === "todo" && todoSection) {
    todoSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
    pendingToolsSection = "";
    clearNavigationParams(["section"]);
  }
}

function focusRequestedCalendarTarget(targetDay, targetText, targetKey) {
  const grid = document.getElementById("calendarGrid");
  if (!grid) {
    return;
  }

  const calendarSection = grid.closest("section");

  if (pendingEventTargetKey) {
    if (calendarSection) {
      calendarSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    if (targetDay) {
      highlightActivityTarget(targetDay);
      if (targetText) {
        openPopup(targetText, targetKey);
      }
    }

    pendingEventTargetKey = "";
    pendingToolsMonthId = "";
    pendingToolsSection = "";
    clearNavigationParams(["event", "month", "section"]);
    return;
  }

  if (pendingToolsSection === "calendar" && calendarSection) {
    calendarSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
    pendingToolsMonthId = "";
    pendingToolsSection = "";
    clearNavigationParams(["month", "section"]);
  }
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
      li.dataset.todoId = docItem.id;

      if (todo.done) {
        li.classList.add("done");
      }

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.classList.add("todo-toggle-btn");
      toggleBtn.setAttribute("aria-pressed", todo.done ? "true" : "false");
      toggleBtn.setAttribute("aria-label", todo.done ? "Als offen markieren" : "Als erledigt markieren");
      toggleBtn.onclick = function() {
        toggleTodo(docItem.id, todo.done, todo.text);
      };

      const checkmark = document.createElement("span");
      checkmark.classList.add("todo-checkmark");
      checkmark.setAttribute("aria-hidden", "true");
      checkmark.textContent = todo.done ? "✓" : "";

      const text = document.createElement("span");
      text.classList.add("todo-text");
      text.textContent = todo.text;

      toggleBtn.appendChild(checkmark);
      toggleBtn.appendChild(text);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.classList.add("todo-delete-btn");
      btn.setAttribute("aria-label", "Eintrag löschen");
      btn.textContent = "✕";
      btn.onclick = function() {
        deleteTodo(docItem.id, todo.text);
      };

      li.appendChild(toggleBtn);
      li.appendChild(btn);
      list.appendChild(li);
    });

    focusRequestedTodoTarget();
  });
}

async function addTodo() {
  const input = document.getElementById("todoInput");
  if (!input || !input.value.trim()) {
    return;
  }

  const todoText = input.value.trim();

  try {
    const todoRef = await addDoc(collection("todos"), {
      text: todoText,
      done: false
    });

    await publishActivity({
      section: "todo",
      action: "add",
      title: `${getCurrentActorLabel()} hat etwas zur Liste hinzugefügt`,
      description: todoText,
      todoId: todoRef.id
    });
  } catch (error) {
    console.error("Listenpunkt konnte nicht gespeichert werden:", error);
    return;
  }

  input.value = "";
}

async function toggleTodo(id, currentState, todoText) {
  const nextState = !currentState;

  try {
    await updateDoc(doc("todos", id), {
      done: nextState
    });

    await publishActivity({
      section: "todo",
      action: nextState ? "complete" : "reopen",
      title: nextState
        ? `${getCurrentActorLabel()} hat einen Listenpunkt abgehakt`
        : `${getCurrentActorLabel()} hat einen Listenpunkt wieder geöffnet`,
      description: todoText || "",
      todoId: id
    });
  } catch (error) {
    console.error("Listenpunkt konnte nicht aktualisiert werden:", error);
  }
}

async function deleteTodo(id, todoText) {
  try {
    await deleteDoc(doc("todos", id));

    await publishActivity({
      section: "todo",
      action: "delete",
      title: `${getCurrentActorLabel()} hat etwas aus der Liste gelöscht`,
      description: todoText || ""
    });
  } catch (error) {
    console.error("Listenpunkt konnte nicht gelöscht werden:", error);
  }
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
    deleteBtn.onclick = async function() {
      if (!currentEventKey) {
        return;
      }

      const deletedText = calendarEvents[currentEventKey] || "";

      try {
        await deleteDoc(doc("events", currentEventKey));

        await publishActivity({
          section: "calendar",
          action: "delete",
          title: `${getCurrentActorLabel()} hat ein Kalendereignis gelöscht`,
          description: deletedText
            ? `${formatCalendarDateFromEventKey(currentEventKey)} · ${deletedText}`
            : formatCalendarDateFromEventKey(currentEventKey),
          eventKey: currentEventKey,
          monthId: getMonthIdFromEventKey(currentEventKey)
        });
      } catch (error) {
        console.error("Kalendereignis konnte nicht gelöscht werden:", error);
      }

      closePopup();
    };
  }

  if (editBtn && editBtn.dataset.bound !== "true") {
    editBtn.dataset.bound = "true";
    editBtn.onclick = async function() {
      const newText = prompt("Neuer Text:");
      const trimmedText = newText ? newText.trim() : "";

      if (trimmedText !== "") {
        try {
          await setDoc(doc("events", currentEventKey), {
            text: trimmedText
          });

          await publishActivity({
            section: "calendar",
            action: "edit",
            title: `${getCurrentActorLabel()} hat ein Kalendereignis geändert`,
            description: `${formatCalendarDateFromEventKey(currentEventKey)} · ${trimmedText}`,
            eventKey: currentEventKey,
            monthId: getMonthIdFromEventKey(currentEventKey)
          });
        } catch (error) {
          console.error("Kalendereignis konnte nicht bearbeitet werden:", error);
        }
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
  let pendingEventDay = null;
  let pendingEventText = "";
  let pendingEventKey = "";

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

    div.dataset.eventKey = key;
    div.textContent = day;
    div.onclick = async function() {
      if (hasEvent) {
        openPopup(hasEvent, key);
      } else {
        const text = prompt("Was wollen wir an diesem Tag machen? ❤️");
        const trimmedText = text ? text.trim() : "";

        if (trimmedText) {
          try {
            await setDoc(doc("events", key), {
              text: trimmedText
            });

            await publishActivity({
              section: "calendar",
              action: "add",
              title: `${getCurrentActorLabel()} hat ein Ereignis im Kalender hinzugefügt`,
              description: `${formatCalendarDate(year, month, day)} · ${trimmedText}`,
              eventKey: key,
              monthId: createMonthIdFromDate(new Date(year, month, 1))
            });
          } catch (error) {
            console.error("Kalendereignis konnte nicht gespeichert werden:", error);
          }
        }
      }
    };

    if (pendingEventTargetKey && pendingEventTargetKey === key) {
      pendingEventDay = div;
      pendingEventText = hasEvent || "";
      pendingEventKey = key;
    }

    grid.appendChild(div);
  }

  requestAnimationFrame(function() {
    grid.style.opacity = 1;
    focusRequestedCalendarTarget(pendingEventDay, pendingEventText, pendingEventKey);
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

    if (pendingToolsMonthId) {
      const requestedDate = parseMonthIdToDate(pendingToolsMonthId);
      if (requestedDate) {
        currentDate = requestedDate;
      }
    }

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
    const [downloadUrl, metadata] = await Promise.all([
      itemRef.getDownloadURL(),
      itemRef.getMetadata()
    ]);
    const defaultCaption = formatCaptionFromName(itemRef.name);
    const customMetadata = metadata && metadata.customMetadata ? metadata.customMetadata : {};
    const customDisplayName = typeof customMetadata.displayName === "string"
      ? customMetadata.displayName.trim()
      : "";
    const caption = customDisplayName || defaultCaption;
    const createdAtMs = Date.parse((metadata && metadata.timeCreated) || "");

    return {
      type: mediaType,
      src: downloadUrl,
      alt: caption,
      caption: caption,
      defaultCaption: defaultCaption,
      originalName: itemRef.name,
      customMetadata: customMetadata,
      createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : null,
      sortKey: itemRef.fullPath,
      storagePath: itemRef.fullPath
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
      caption: item.caption,
      defaultCaption: item.defaultCaption || item.caption,
      originalName: item.originalName || "",
      customMetadata: item.customMetadata || {},
      createdAtMs: Number.isFinite(item.createdAtMs) ? item.createdAtMs : null,
      sortKey: item.sortKey || item.storagePath || item.src || item.caption,
      storagePath: item.storagePath || ""
    };
  });

  return galleryItemsCache[monthId];
}

function getGalleryItemFallbackSortValue(item) {
  return String(item.sortKey || item.storagePath || item.src || item.caption || item.alt || "");
}

function sortGalleryItems(items) {
  return items.slice().sort(function(a, b) {
    const aCreatedAt = Number.isFinite(a.createdAtMs) ? a.createdAtMs : null;
    const bCreatedAt = Number.isFinite(b.createdAtMs) ? b.createdAtMs : null;

    if (aCreatedAt !== null && bCreatedAt !== null && aCreatedAt !== bCreatedAt) {
      return gallerySortMode === "newest"
        ? bCreatedAt - aCreatedAt
        : aCreatedAt - bCreatedAt;
    }

    if (aCreatedAt !== null && bCreatedAt === null) {
      return gallerySortMode === "newest" ? -1 : 1;
    }

    if (aCreatedAt === null && bCreatedAt !== null) {
      return gallerySortMode === "newest" ? 1 : -1;
    }

    const aFallback = getGalleryItemFallbackSortValue(a);
    const bFallback = getGalleryItemFallbackSortValue(b);

    return gallerySortMode === "newest"
      ? bFallback.localeCompare(aFallback)
      : aFallback.localeCompare(bFallback);
  });
}

function initializeGallerySortControl() {
  const sortSelect = document.getElementById("gallerySortSelect");
  if (!sortSelect) {
    return;
  }

  sortSelect.value = gallerySortMode;

  if (sortSelect.dataset.bound === "true") {
    return;
  }

  sortSelect.dataset.bound = "true";
  sortSelect.addEventListener("change", function() {
    gallerySortMode = sortSelect.value === "oldest" ? "oldest" : "newest";

    if (activeGalleryMonth) {
      renderGalleryItems(activeGalleryMonth);
    }
  });
}

async function initializeGalleryPage(preferredMonthId) {
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

  initializeGallerySortControl();
  renderGalleryMonthTabs();

  if (!galleryMonths.length) {
    galleryGrid.innerHTML = "";
    updateGallerySummary(null, 0);
    showGalleryEmptyState(true);
    return;
  }

  const targetMonthId = preferredMonthId && galleryMonths.some(function(month) {
    return month.id === preferredMonthId;
  })
    ? preferredMonthId
    : galleryMonths[galleryMonths.length - 1].id;

  await setActiveGalleryMonth(targetMonthId);
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
  items = sortGalleryItems(items);

  items.forEach(function(item) {
    const card = document.createElement("article");
    card.className = "gallery-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.dataset.storagePath = item.storagePath || "";

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
  focusRequestedGalleryTarget(monthId, items, galleryGrid);
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

function focusRequestedGalleryTarget(monthId, items, galleryGrid) {
  if (!galleryGrid) {
    return;
  }

  if (pendingGalleryTargetPath) {
    const targetItem = items.find(function(item) {
      return item.storagePath === pendingGalleryTargetPath;
    });
    const targetCard = Array.from(galleryGrid.querySelectorAll(".gallery-card")).find(function(card) {
      return card.dataset.storagePath === pendingGalleryTargetPath;
    });

    requestAnimationFrame(function() {
      if (targetCard) {
        targetCard.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
        highlightActivityTarget(targetCard);
      }

      if (targetItem) {
        openMediaLightbox(targetItem);
      }
    });

    pendingGalleryTargetPath = "";
    pendingGalleryTargetMonthId = "";
    clearNavigationParams(["item", "month"]);
    return;
  }

  if (pendingGalleryTargetMonthId && pendingGalleryTargetMonthId === monthId) {
    const gallerySection = galleryGrid.closest(".memory-gallery-section");

    requestAnimationFrame(function() {
      if (gallerySection) {
        gallerySection.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    });

    pendingGalleryTargetMonthId = "";
    clearNavigationParams(["month"]);
  }
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

function updateLightboxActionButtons(item, busyAction) {
  const renameBtn = document.getElementById("renameGalleryItemBtn");
  const deleteBtn = document.getElementById("deleteGalleryItemBtn");
  const canModify = Boolean(item && item.storagePath && storageRefFactory);
  const isRenameBusy = busyAction === "rename";
  const isDeleteBusy = busyAction === "delete";

  if (renameBtn) {
    renameBtn.classList.toggle("hidden", !canModify);
    renameBtn.disabled = !canModify || Boolean(busyAction);
    renameBtn.textContent = isRenameBusy ? "Speichern..." : "Namen ändern";
  }

  if (!deleteBtn) {
    return;
  }

  deleteBtn.classList.toggle("hidden", !canModify);
  deleteBtn.disabled = !canModify || Boolean(busyAction);
  deleteBtn.textContent = isDeleteBusy ? "Löschen..." : "Datei löschen";
}

function openMediaLightbox(item) {
  const lightbox = document.getElementById("mediaLightbox");
  const lightboxContent = document.getElementById("mediaLightboxContent");
  const lightboxCaption = document.getElementById("mediaLightboxCaption");

  if (!lightbox || !lightboxContent || !lightboxCaption) {
    return;
  }

  const itemType = item.type === "video" ? "video" : "image";
  activeLightboxItem = item;
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
  updateLightboxActionButtons(item);
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
  activeLightboxItem = null;
  updateLightboxActionButtons(null);
  document.body.style.overflow = "";
}

async function renameActiveGalleryItem() {
  if (!activeLightboxItem || !activeLightboxItem.storagePath || !storageRefFactory) {
    return;
  }

  const currentLabel = activeLightboxItem.caption || activeLightboxItem.alt || activeLightboxItem.defaultCaption || "Erinnerung";
  const userInput = window.prompt(
    "Neuer Titel für dieses Bild oder Video. Leer lassen, um wieder den Originalnamen zu verwenden.",
    currentLabel
  );

  if (userInput === null) {
    return;
  }

  const trimmedValue = userInput.trim();
  const defaultCaption = activeLightboxItem.defaultCaption || formatCaptionFromName(activeLightboxItem.originalName || "");
  const nextCustomMetadata = Object.assign({}, activeLightboxItem.customMetadata || {});

  if (!trimmedValue || trimmedValue === defaultCaption) {
    delete nextCustomMetadata.displayName;
  } else {
    nextCustomMetadata.displayName = trimmedValue;
  }

  updateLightboxActionButtons(activeLightboxItem, "rename");

  try {
    const updatedMetadata = await storageRefFactory(activeLightboxItem.storagePath).updateMetadata({
      customMetadata: nextCustomMetadata
    });
    const customDisplayName = updatedMetadata && updatedMetadata.customMetadata && typeof updatedMetadata.customMetadata.displayName === "string"
      ? updatedMetadata.customMetadata.displayName.trim()
      : "";
    const nextLabel = customDisplayName || defaultCaption;
    const lightboxCaption = document.getElementById("mediaLightboxCaption");

    activeLightboxItem.caption = nextLabel;
    activeLightboxItem.alt = nextLabel;
    activeLightboxItem.defaultCaption = defaultCaption;
    activeLightboxItem.customMetadata = updatedMetadata && updatedMetadata.customMetadata ? updatedMetadata.customMetadata : {};

    if (lightboxCaption) {
      lightboxCaption.textContent = nextLabel;
    }

    if (activeGalleryMonth) {
      delete galleryItemsCache[activeGalleryMonth];
      await renderGalleryItems(activeGalleryMonth);
    }

    await publishActivity({
      section: "gallery",
      action: "rename",
      title: `${getCurrentActorLabel()} hat einen Galerietitel geändert`,
      description: nextLabel,
      monthId: activeGalleryMonth,
      storagePath: activeLightboxItem.storagePath
    });

    updateLightboxActionButtons(activeLightboxItem);
  } catch (error) {
    console.error("Der Galeriename konnte nicht aktualisiert werden:", error);
    updateLightboxActionButtons(activeLightboxItem);
    window.alert("Der Name konnte nicht geändert werden. Bitte versuche es noch einmal.");
  }
}

async function deleteActiveGalleryItem() {
  if (!activeLightboxItem || !activeLightboxItem.storagePath || !storageRefFactory) {
    return;
  }

  const itemLabel = activeLightboxItem.caption || activeLightboxItem.alt || "diese Datei";
  const confirmed = window.confirm(`Willst du ${itemLabel} wirklich aus der Galerie löschen?`);

  if (!confirmed) {
    return;
  }

  updateLightboxActionButtons(activeLightboxItem, "delete");

  try {
    const deletedStoragePath = activeLightboxItem.storagePath;
    await storageRefFactory(activeLightboxItem.storagePath).delete();

    if (activeGalleryMonth && galleryItemsCache[activeGalleryMonth]) {
      galleryItemsCache[activeGalleryMonth] = galleryItemsCache[activeGalleryMonth].filter(function(item) {
        return item.storagePath !== activeLightboxItem.storagePath;
      });
    }

    await publishActivity({
      section: "gallery",
      action: "delete",
      title: `${getCurrentActorLabel()} hat etwas aus der Galerie gelöscht`,
      description: itemLabel,
      monthId: activeGalleryMonth,
      storagePath: deletedStoragePath
    });

    closeMediaLightbox();
    await initializeGalleryPage(activeGalleryMonth);
  } catch (error) {
    console.error("Galerie-Datei konnte nicht gelöscht werden:", error);
    updateLightboxActionButtons(activeLightboxItem);
    window.alert("Die Datei konnte nicht gelöscht werden. Bitte versuche es noch einmal.");
  }
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
    let firstUploadedPath = "";

    for (let index = 0; index < mediaFiles.length; index += 1) {
      const file = mediaFiles[index];
      const relativePath = buildUploadRelativePath(file, monthId);
      const targetPath = `${GALLERY_STORAGE_ROOT}/${monthId}/${relativePath}`;

      if (!firstUploadedPath) {
        firstUploadedPath = targetPath;
      }

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

    await publishActivity({
      section: "gallery",
      action: "upload",
      title: `${getCurrentActorLabel()} hat die Galerie erweitert`,
      description: `${formatMonthLabel(monthId)} · ${mediaFiles.length} neue ${mediaFiles.length === 1 ? "Datei" : "Dateien"}`,
      monthId: monthId,
      storagePath: firstUploadedPath
    });

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
window.renameActiveGalleryItem = renameActiveGalleryItem;
window.deleteActiveGalleryItem = deleteActiveGalleryItem;