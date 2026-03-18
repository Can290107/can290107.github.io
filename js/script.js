const db = window.db;
const {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  setDoc
} = window.firebaseFns;

/* ---------------- Elemente ---------------- */

const button = document.getElementById("startBtn");
const music = document.getElementById("bgMusic");
const cursor = document.querySelector(".cursor");


/* ---------------- Musik starten ---------------- */

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


/* ---------------- Scroll Animation ---------------- */

AOS.init({
duration:1000,
once:true
});


/* ---------------- Custom Cursor ---------------- */

if(cursor){

document.addEventListener("mousemove",(e)=>{

cursor.style.left = e.clientX + "px";
cursor.style.top = e.clientY + "px";

});

}

/* ---------------- Partikel Hintergrund ---------------- */

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



/* ---------------- Timeline Zoom ---------------- */

const events = document.querySelectorAll(".timeline-event");

events.forEach(event => {

event.addEventListener("click", () => {

events.forEach(e => e.classList.remove("active"));

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

      li.innerHTML = `
        <span onclick="toggleTodo('${docItem.id}', ${todo.done})">${todo.text}</span>
        <button onclick="deleteTodo('${docItem.id}')">❌</button>
      `;

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


window.addTodo = addTodo;
window.toggleTodo = toggleTodo;
window.deleteTodo = deleteTodo;
window.changeMonth = changeMonth;