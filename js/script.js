let db;
let collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, setDoc;

// 🔥 Warten bis Firebase da ist
function initFirebase() {
  if (!window.firebaseFns || !window.db) {
    setTimeout(initFirebase, 100);
    return;
  }

  db = window.db;

  collection = window.firebaseFns.collection;
  addDoc = window.firebaseFns.addDoc;
  onSnapshot = window.firebaseFns.onSnapshot;
  deleteDoc = window.firebaseFns.deleteDoc;
  doc = window.firebaseFns.doc;
  updateDoc = window.firebaseFns.updateDoc;
  setDoc = window.firebaseFns.setDoc;

  console.log("Firebase ready ✅");

  // Jetzt erst starten
  if(document.getElementById("todoList")){
    loadTodos();
  }

  if(document.getElementById("calendarGrid")){
    loadEvents();
  }
}

initFirebase();

/* ---------------- Elemente ---------------- */

const button = document.getElementById("startBtn");
const music = document.getElementById("bgMusic");

/* ---------------- Musik starten ---------------- */
if(button && music){
button.addEventListener("click", () => {

music.volume = 0;
music.play();

let volume = 0;

const fade = setInterval(() => {

if(volume < 1){
volume += 0.02;
music.volume = volume;
}else{
clearInterval(fade);
}

}, 100);

button.style.display = "none";

});
}
const cursor = document.querySelector(".cursor");



/* ---------------- Scroll Animation ---------------- */

if(typeof AOS !== "undefined"){
AOS.init({
duration:1000,
once:true
});
}


/* ---------------- Custom Cursor ---------------- */

if(cursor){

document.addEventListener("mousemove",(e)=>{

cursor.style.left = e.clientX + "px";
cursor.style.top = e.clientY + "px";

});

}

/* ---------------- Partikel Hintergrund ---------------- */

if(typeof tsParticles !== "undefined"){
tsParticles.load("particles", {
particles:{
number:{ value:60 },
color:{ value:"#ec4899" },
shape:{ type:"circle" },
opacity:{ value:0.5 },
size:{ value:3 },
move:{
enable:true,
speed:2
}
}
});
}



/* ---------------- Timeline Zoom ---------------- */

const timelineEvents = document.querySelectorAll(".timeline-event");

timelineEvents.forEach(event => {

event.addEventListener("click", () => {

timelineEvents.forEach(e => e.classList.remove("active"));

event.classList.add("active");

event.scrollIntoView({
behavior:"smooth",
block:"center"
});

});

});


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

Ich wollte dir dieses Jahr nicht einfach nur ein Geschenk geben.
Ich wollte dir etwas geben, das zeigt wie viel mir unsere Zeit bedeutet.

Vom ersten Moment unserer Nachrichten,
über unser erstes Treffen im Park,
bis zu all den Momenten danach.

Jeder einzelne Moment mit dir ist für mich etwas Besonderes.

Danke, dass du mein Leben so viel schöner machst.

Alles Gute zum Geburtstag ❤️
Ich liebe dich.
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

const loginBtn = document.getElementById("loginBtn");

if(loginBtn){
loginBtn.addEventListener("click", checkPassword);
}

/*---------Login---------*/
function checkPassword(){

const password = document.getElementById("passwordInput").value;

const correctPassword = "15.04.2025";

if(password === correctPassword){

  // 🔥 LOGIN SPEICHERN
  localStorage.setItem("loggedIn", "true");

  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("mainContent").style.display = "block";

  updateRelationshipCounter();

  setTimeout(()=>{
    confetti({
      particleCount:300,
      spread:180,
      origin:{y:0.6}
    });
  },600);

}else{

  alert("Das stimmt leider nicht ❤️");

}

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

  onSnapshot(collection(db, "todos"), (snapshot) => {

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

  addDoc(collection(db, "todos"), {
    text: input.value,
    done: false
  });

  input.value = "";
}

function toggleTodo(id, currentState) {

  updateDoc(doc(db, "todos", id), {
    done: !currentState
  });

}

function deleteTodo(id) {

  deleteDoc(doc(db, "todos", id));

}

/* ---------------- Kalender ---------------- */

let currentDate = new Date();

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

    div.textContent = day;

    div.onclick = () => {

      if(!db) return;

      const text = prompt("Was wollen wir an diesem Tag machen? ❤️", hasEvent || "");

      if(text){
        setDoc(doc(db, "events", key), {
          text: text
        });
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

  if(!db){
    setTimeout(loadEvents, 100);
    return;
  }

  onSnapshot(collection(db, "events"), (snapshot) => {

    const events = {};

    snapshot.forEach(docItem => {
      events[docItem.id] = docItem.data().text;
    });

    renderCalendar(events);
  });

}
// 🔥 AUTO LOGIN CHECK
window.addEventListener("load", () => {

  if(localStorage.getItem("loggedIn") === "true"){

    const loginScreen = document.getElementById("loginScreen");
    const mainContent = document.getElementById("mainContent");

    if(loginScreen && mainContent){
      loginScreen.style.display = "none";
      mainContent.style.display = "block";

      updateRelationshipCounter();
    }

  }

});

window.addTodo = addTodo;
window.toggleTodo = toggleTodo;
window.deleteTodo = deleteTodo;
window.changeMonth = changeMonth;
window.goBack = goBack;
window.loadEvents = loadEvents;
