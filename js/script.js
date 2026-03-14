/* ---------------- Elemente ---------------- */

const button = document.getElementById("startBtn");
const music = document.getElementById("bgMusic");
const cursor = document.querySelector(".cursor");


/* ---------------- Musik starten ---------------- */

button.addEventListener("click", () => {

music.volume = 1;
music.play();

// Button ausblenden
button.style.display = "none";

});


/* ---------------- Scroll Animation ---------------- */

AOS.init({
duration:1000,
once:true
});


/* ---------------- Custom Cursor ---------------- */

document.addEventListener("mousemove", (e) => {

cursor.style.left = e.clientX + "px";
cursor.style.top = e.clientY + "px";

});


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

document.addEventListener("DOMContentLoaded", () => {

const startDate = new Date("2025-04-14");
const relationshipDate = new Date("2025-06-21");

const today = new Date();

const diffStart = Math.floor((today - startDate) / (1000*60*60*24));
const diffRelationship = Math.floor((today - relationshipDate) / (1000*60*60*24));

document.getElementById("daysTogether").textContent =
diffStart + " Tage kennen wir uns";

document.getElementById("daysRelationship").textContent =
diffRelationship + " Tage zusammen ❤️";

});
/* ---------------- Liebesbrief Animation ---------------- */

/* ---------------- Liebesbrief Animation ---------------- */

function showLetter(){

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

function checkPassword(){

const password = document.getElementById("passwordInput").value;

const correctPassword = "15.04.2025";

if(password === correctPassword){

document.getElementById("loginScreen").style.display = "none";
document.getElementById("mainContent").style.display = "block";

}else{

alert("Das stimmt leider nicht ❤️");

}

}