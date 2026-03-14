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


/* ---------------- Geschenk öffnen ---------------- */

function openGift(){

const box = document.getElementById("giftBox");

box.style.display = "block";

setTimeout(() => {

box.classList.add("open");

// Position der Box bestimmen
const rect = box.getBoundingClientRect();

const x = (rect.left + rect.width / 2) / window.innerWidth;
const y = (rect.top + rect.height / 3) / window.innerHeight;


// Konfetti Explosion
confetti({
particleCount:300,
spread:160,
startVelocity:40,
origin:{ x:x, y:y }
});

confetti({
particleCount:80,
spread:100,
colors:['#ec4899','#ff6aa2','#ffffff'],
origin:{ x:x, y:y }
});

// Handy Vibration
if (navigator.vibrate) {
navigator.vibrate(200);
}

},200);

}


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



detail.innerHTML = content;

detail.classList.add("show");

detail.scrollIntoView({
behavior:"smooth"
});





