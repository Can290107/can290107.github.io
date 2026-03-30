// 🔐 Einfache Benutzer-Datenbank (2 Personen)
const users = {
  "cansu": "Prinzessin",
  "can": "Ichliebecansu"
};

// Globale Firebase-Referenzen (definiert in firebase-config.js)
// window.collection, window.addDoc, window.onSnapshot, etc. sind bereits verfügbar

let currentEventKey = null;

// 🔥 Check Login Status beim Laden
function checkLoginStatus() {
  const loggedInUser = localStorage.getItem("loggedInUser");
  const loginTimestamp = localStorage.getItem("loginTimestamp");
  const loginScreen = document.getElementById("loginScreen");
  const mainContent = document.getElementById("mainContent");

  if (!loginScreen || !mainContent) return; // DOM nicht bereit

  // Prüfe ob Session abgelaufen (1 Tag = 86400000 ms)
  const SESSION_DURATION = 1 * 24 * 60 * 60 * 1000; // 1 Tag in Millisekunden
  const now = Date.now();

  if (loginTimestamp && (now - parseInt(loginTimestamp)) > SESSION_DURATION) {
    // Session abgelaufen - automatisch ausloggen
    handleLogout();
    return;
  }

  if (loggedInUser && users[loggedInUser.toLowerCase()]) {
    // User ist im localStorage eingeloggt und Session gültig
    loginScreen.style.display = "none";
    mainContent.style.display = "block";
    updateRelationshipCounter();
  } else {
    // Nicht eingeloggt oder Session abgelaufen
    loginScreen.style.display = "flex";
    mainContent.style.display = "none";
  }
}

// Login-Status prüfen sobald DOM bereit ist
document.addEventListener('DOMContentLoaded', function() {
  checkLoginStatus();
  initializeUI();
});

function initializeUI() {
  /* ========== Musik ========== */
  const button = document.getElementById("startBtn");
  const music = document.getElementById("bgMusic");
  
  if(button && music) {
    button.addEventListener("click", () => {
      music.volume = 0;
      music.play();
      
      let volume = 0;
      const fade = setInterval(() => {
        if(volume < 1) {
          volume += 0.02;
          music.volume = volume;
        } else {
          clearInterval(fade);
        }
      }, 100);
      
      button.style.display = "none";
    });
  }
  
  /* ========== AOS Animationen ========== */
  if(typeof AOS !== "undefined") {
    AOS.init({
      duration: 1000,
      once: true
    });
  }
  
  /* ========== Custom Cursor ========== */
  const cursor = document.querySelector(".cursor");
  if(cursor) {
    document.addEventListener("mousemove", (e) => {
      cursor.style.left = e.clientX + "px";
      cursor.style.top = e.clientY + "px";
    });
  }
  
  /* ========== Partikel Hintergrund ========== */
  if(typeof tsParticles !== "undefined") {
    const particles = document.getElementById("particles");
    if(particles) {
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
  
  /* ========== Timeline Interaktion ========== */
  const timelineEvents = document.querySelectorAll(".timeline-event");
  timelineEvents.forEach(event => {
    event.addEventListener("click", () => {
      timelineEvents.forEach(e => e.classList.remove("active"));
      event.classList.add("active");
      event.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    });
  });
}


/* ---------------- Beziehungs Counter ---------------- */

function updateRelationshipCounter(){

const startDate = new Date("2025-04-14");
const relationshipDate = new Date("2025-06-21");

const today = new Date();

const diffStart = Math.floor((today - startDate) / (1000*60*60*24));
const diffRelationship = Math.floor((today - relationshipDate) / (1000*60*60*24));

const togetherEl = document.getElementById("daysTogether");
const relationshipEl = document.getElementById("daysRelationship");

if(togetherEl && relationshipEl){

togetherEl.textContent = diffStart + " Tage kennen";
relationshipEl.textContent = diffRelationship + " Tage zusammen ❤️";

}

}


/* ---------------- Liebesbrief Animation ---------------- */

let letterStarted = false;

function showLetter(){

if(letterStarted) return;
letterStarted = true;

// Konfetti
confetti({
particleCount:200,
spread:120,
origin:{y:0.6}
});

const letter = document.getElementById("loveLetter");
const textElement = document.getElementById("letterText");

const text = `Hey ❤️

ich habe lange darüber nachgedacht, was ich dir schreiben soll.
Und je mehr ich darüber nachgedacht habe,
desto mehr habe ich gemerkt,
dass es eigentlich keine richtigen Worte dafür gibt.

Weil das, was ich für dich empfinde,
lässt sich nicht einfach erklären.
Es ist nicht nur ein Gefühl.
Es ist etwas, das einfach da ist 
die ganze Zeit.

Du bist für mich nicht nur meine Freundin.
Du bist die Person,
bei der alles irgendwie still wird.

Egal wie mein Tag war,
egal was in meinem Kopf los ist 
wenn ich an dich denke,
wird alles ruhiger.

Und ich glaube, genau das ist das,
was dich für mich so besonders macht.

Du bist nicht laut,
nicht aufdringlich,
nicht kompliziert.

Und trotzdem schaffst du es,
mehr in mir auszulösen als alles andere.

Ich fühle mich bei dir einfach richtig.

So, als müsste ich nichts erklären.
So, als würde alles genau so passen, wie es ist.

Und ich habe das Gefühl,
dass ich durch dich Dinge gelernt habe,
die ich vorher nie wirklich verstanden habe.

Wie es ist, jemandem wirklich zu vertrauen.
Wie es ist, sich wirklich wohlzufühlen.
Und wie es ist,
einen Menschen nicht mehr aus seinem Leben wegdenken zu können.

Du bist für mich zu einem festen Teil geworden.
Nicht irgendwann,
sondern einfach so.

Und genau das macht mir manchmal bewusst,
wie besonders das alles ist.

Weil nichts davon selbstverständlich ist.

Ich bin einfach dankbar.
Für dich.
Für alles, was du bist.
Für die Art, wie du denkst,
wie du fühlst
und wie du mit mir umgehst.

Und ich merke,
dass ich mir genau das immer gewünscht habe,
ohne es richtig benennen zu können.

Ich kann dir nicht versprechen,
dass immer alles perfekt sein wird.

Aber ich kann dir sagen,
dass ich dich immer genauso ehrlich meinen werde,
wie ich es jetzt tue.

Und dass ich dich niemals als selbstverständlich sehen werde.

Alles Gute zum Geburtstag ❤️

Ich liebe dich.
Nicht nur heute,
sondern jeden einzelnen Tag.
`;

letter.classList.add("show");

textElement.innerHTML = "";

let i = 0;

function type(){

if(i < text.length){

textElement.innerHTML += text.charAt(i);

i++;

setTimeout(type,40);

}

}

type();

}



/*---------Login Button Event---------*/

document.addEventListener('DOMContentLoaded', function() {
  const loginBtn = document.getElementById("loginBtn");
  if(loginBtn) {
    loginBtn.addEventListener("click", handleLogin);
  }
});

/*---------Login mit Benutzernamen---------*/
function handleLogin() {
  const username = document.getElementById("usernameInput").value.toLowerCase().trim();
  const password = document.getElementById("passwordInput").value;
  const errorMsg = document.getElementById("errorMsg");

  if (!username || !password) {
    errorMsg.textContent = "Bitte Benutzername und Passwort eingeben ❤️";
    errorMsg.style.display = "block";
    return;
  }

  // Prüfe ob Benutzer existiert
  if (!users[username]) {
    errorMsg.textContent = "Benutzer nicht gefunden ❌";
    errorMsg.style.display = "block";
    return;
  }

  // Prüfe ob Passwort richtig ist
  if (users[username] !== password) {
    errorMsg.textContent = "Passwort falsch ❌";
    errorMsg.style.display = "block";
    return;
  }

  // ✅ Login erfolgreich!
  localStorage.setItem("loggedInUser", username);
  localStorage.setItem("loginTimestamp", Date.now().toString()); // Timestamp speichern
  
  // Confetti
  confetti({
    particleCount: 300,
    spread: 180,
    origin: { y: 0.6 }
  });

  // Clear inputs
  document.getElementById("usernameInput").value = "";
  document.getElementById("passwordInput").value = "";
  errorMsg.style.display = "none";

  // Show main content
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("mainContent").style.display = "block";
  
  updateRelationshipCounter();
}

/*----------Hereffekt beim Klicken-------------*/


document.addEventListener("click",(e)=>{

const heart = document.createElement("div");

heart.classList.add("heart");
heart.innerHTML = "❤️";

heart.style.left = e.clientX + "px";
heart.style.top = e.clientY + "px";

document.body.appendChild(heart);

setTimeout(()=>{
heart.remove();
},4000);

});

/*------Kalender----*/
function openTools(){
  window.location.href = "tools.html";
}

function goBack(){
  window.location.href = "index.html";
}

function loadTodos() {

  onSnapshot(collection("todos"), (snapshot) => {

    const list = document.getElementById("todoList");
    list.innerHTML = "";

    snapshot.forEach((docItem) => {

      const todo = docItem.data();

      const li = document.createElement("li");
li.classList.add("todo-item");

if (todo.done) li.classList.add("done");

      // Text (linke Seite)
      const left = document.createElement("div");
      left.classList.add("todo-left");
      left.textContent = todo.text;

      left.onclick = () => toggleTodo(docItem.id, todo.done);

        // Delete Button
      const btn = document.createElement("button");
      btn.textContent = "✕";
      btn.onclick = () => deleteTodo(docItem.id);

      // Elemente zusammensetzen
      li.appendChild(left);
      li.appendChild(btn);
      list.appendChild(li);
    });

  });

}

function addTodo() {

  const input = document.getElementById("todoInput");

  if (!input.value.trim()) return;

  addDoc(collection("todos"), {
    text: input.value,
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

/* ---------------- Kalender ---------------- */

let currentDate = new Date();
function openPopup(text, key){
  document.getElementById("eventPopup").classList.remove("hidden");
  document.getElementById("eventText").textContent = text;

  currentEventKey = key;
}

function closePopup(){
  document.getElementById("eventPopup").classList.add("hidden");
}

// Event Popup Button Handler registrieren
document.addEventListener('DOMContentLoaded', function() {
  const deleteBtn = document.getElementById("deleteEventBtn");
  const editBtn = document.getElementById("editEventBtn");
  
  if(deleteBtn) {
    deleteBtn.onclick = () => {
      if(!currentEventKey) return;
      deleteDoc(doc("events", currentEventKey));
      closePopup();
    };
  }
  
  if(editBtn) {
    editBtn.onclick = () => {
      const newText = prompt("Neuer Text:");
      if(newText && newText.trim() !== ""){
        setDoc(doc("events", currentEventKey), {
          text: newText
        });
      }
      closePopup();
    };
  }
});
function renderCalendar(events = {}) {

  const grid = document.getElementById("calendarGrid");
  const title = document.getElementById("calendarTitle");

  if(!grid || !title) return;

  // 🔥 Smooth Animation Start
  grid.style.opacity = 0.3;

  grid.innerHTML = "";

  // Wochentage
  const days = ["Mo","Di","Mi","Do","Fr","Sa","So"];

  days.forEach(day => {
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

  // Leere Felder
  for(let i = 0; i < firstDay; i++){
    grid.innerHTML += "<div></div>";
  }

  for(let day = 1; day <= daysInMonth; day++){

    const key = `${year}-${month}-${day}`;
    const hasEvent = events[key];

    const div = document.createElement("div");
    div.classList.add("calendar-day");

    if(hasEvent) div.classList.add("has-event");

    // 🔥 Heutigen Tag hervorheben
    const today = new Date();
    if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
      div.classList.add("today");
    }

    div.textContent = day;

   div.onclick = () => {

  // 👉 Wenn Event existiert → Popup öffnen
  if(hasEvent){
    openPopup(hasEvent, key);
  } 
  else {
    const text = prompt("Was wollen wir an diesem Tag machen? ❤️");

    if(text){
      setDoc(doc("events", key), {
        text: text
      });
    }
  }

};

    grid.appendChild(div);
  }

  // 🔥 Smooth Animation Ende
  requestAnimationFrame(() => {
  grid.style.opacity = 1;
  });
}

function changeMonth(direction){
  currentDate.setMonth(currentDate.getMonth() + direction);
  loadEvents();
}

function loadEvents(){

  onSnapshot(collection("events"), (snapshot) => {

    const events = {};

    snapshot.forEach(docItem => {
      events[docItem.id] = docItem.data().text;
    });

    renderCalendar(events);
  });

}
// 🔥 AUTO LOGIN - Einfach localStorage Check
// checkLoginStatus() wurde schon oben aufgerufen

window.addTodo = addTodo;
window.toggleTodo = toggleTodo;
window.deleteTodo = deleteTodo;
window.changeMonth = changeMonth;
window.goBack = goBack;
window.loadEvents = loadEvents;
window.loadTodos = loadTodos;
window.openTools = openTools;
window.handleLogin = handleLogin;
window.handleLogout = function() {
  localStorage.removeItem("loggedInUser");
  localStorage.removeItem("loginTimestamp"); // Timestamp auch löschen
  window.location.href = "index.html";
};

// 🔥 Login-Überprüfung für tools.html
document.addEventListener('DOMContentLoaded', function() {
  const currentPage = window.location.pathname.split('/').pop();
  console.log('Current page:', currentPage);
  console.log('Logged in user:', localStorage.getItem('loggedInUser'));
  if (currentPage === 'tools.html') {
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (!loggedInUser || !users[loggedInUser.toLowerCase()]) {
      console.log('Redirecting to index.html');
      window.location.href = 'index.html';
    } else {
      console.log('User is logged in, staying on tools.html');
    }
  }
});
