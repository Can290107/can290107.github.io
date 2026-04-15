// 🔥 Zentrale Firebase Konfiguration
// Diese Datei wird von allen Seiten importiert

const firebaseConfig = {
  apiKey: "AIzaSyDQTZGjNqoHsjcEJ1W1DHryoXS-xpeOuVI",
  authDomain: "geburtstag-seite.firebaseapp.com",
  projectId: "geburtstag-seite",
  storageBucket: "geburtstag-seite.firebasestorage.app",
  messagingSenderId: "825693028407",
  appId: "1:825693028407:web:55ebde2398f2f9cc907fb2"
};

// Firebase nur einmal initialisieren
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Globale Referenzen fuer alle Dienste
const firebaseAuth = firebase.auth();
const firebaseDb = firebase.firestore();
const firebaseStorage = firebase.storage();

// App-Konfiguration fuer Username-Login und Galerie-Ordner in Storage
window.authUserMap = {
  cansu: "c.karanlik29@gmx.de",
  can: "cankaranlik01@gmail.com"
};

window.galleryStorageRoot = "gallery";
window.firebaseAuth = firebaseAuth;
window.firebaseDb = firebaseDb;
window.firebaseStorage = firebaseStorage;

// Wrapper-Funktionen für Firestore (für alle Seiten verfügbar)
window.collection = (collectionName) => firebaseDb.collection(collectionName);
window.addDoc = (collectionRef, data) => collectionRef.add(data);
window.onSnapshot = (query, callback) => query.onSnapshot(callback);
window.deleteDoc = (docRef) => docRef.delete();
window.doc = (collectionName, docId) => firebaseDb.collection(collectionName).doc(docId);
window.updateDoc = (docRef, data) => docRef.update(data);
window.setDoc = (docRef, data) => docRef.set(data);

// Wrapper-Funktionen fuer Firebase Storage
window.storageRef = (path = "") => path ? firebaseStorage.ref(path) : firebaseStorage.ref();
