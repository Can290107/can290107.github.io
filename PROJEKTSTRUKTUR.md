# 📋 Projektstruktur & Wartbarkeit

## Dateiorganisation

```
ja/
├── index.html              # Hauptseite (Login + Timeline)
├── tools.html              # Tools Seite (Kalender + To-Do)
├── secret.html             # (leer/reserviert)
├── css/
│   └── style.css           # Alle Styles (global)
├── js/
│   ├── firebase-config.js  # 🔥 Zentrale Firebase-Konfiguration
│   └── script.js           # Alle JS-Funktionen
└── assets/
    ├── images/
    └── music/
```

## 🔥 Wichtige Verbesserungen zur Wartbarkeit

### 1. **Zentrale Firebase-Konfiguration** (`firebase-config.js`)
- ✅ Keine Duplikation mehr
- ✅ Einmalige Initialisierung
- ✅ Globale Wrapper-Funktionen für alle Seiten

### 2. **DOM-Ready Pattern**
**VORHER (unprofessionell):**
```javascript
setTimeout(() => {
  if (window.loadTodos) loadTodos();
}, 200);

const button = document.getElementById("startBtn"); // Kann null sein!
```

**NACHHER (professionell):**
```javascript
document.addEventListener('DOMContentLoaded', function() {
  initializeUI();
});
```

### 3. **Bessere Code-Struktur**
- Alle UI-Initialisierungen sind in `initializeUI()` Funktion
- Klare Trennung: Login → UI-Init → Funktionalität
- Bessere Lesbarkeit durch Kommentare und Gruppierung

### 4. **Vermiedene Code-Duplikation**
| Vorher | Nachher |
|--------|---------|
| Firebase-Config 3x definiert | 1x zentral in `firebase-config.js` |
| Wrapper-Funktionen mit Checks | Direkte globale Funktionen |
| Magic Timeouts überall | Nur `DOMContentLoaded` |

## 📂 Modulstruktur

### `firebase-config.js`
```
Verantwortung: Firebase initialisieren + globale Funktionen bereitstellen
Abhängigkeiten: Firebase SDK (aus HTML)
Nutzer: index.html, tools.html, script.js
```

### `script.js`
```
Abschnitte:
1. Benutzer-Datenbank
2. checkLoginStatus() - Login-Überprüfung
3. initializeUI() - UI-Initialisierung (Musik, Cursor, etc.)
4. handleLogin() / handleLogout() - Login-Logik
5. showLetter() - Liebesbrief-Animation
6. updateRelationshipCounter() - Tage zählen
7. loadTodos() / addTodo() / toggleTodo() / deleteTodo() - To-Do Verwaltung
8. loadEvents() / renderCalendar() / changeMonth() - Kalender
9. Global exports (window.addTodo, etc.)
```

## ✅ Wartbarkeitspunkte

- **Keine Magic Timeouts mehr** - alles lädt über `DOMContentLoaded`
- **Zentrale Konfiguration** - einfach zu aktualisieren
- **Bessere Fehlerbehandlung** - DOM-Checks vor Element-Access
- **Klare Verantwortlichkeiten** - jede Funktion hat einen Job
- **Zukunftssicher** - leicht erweiterbar mit neuen Features

## 🔧 Wenn du etwas hinzufügen willst:

1. **Neue Seite?** → Importiere `firebase-config.js`, dann `script.js`
2. **Neuer Button?** → Füge Event-Listener in `initializeUI()` hinzu
3. **Neue Funktion?** → Belasse sie in `script.js`, aber gruppiere sie logisch
4. **Firebase ändern?** → Nur in `firebase-config.js` editieren
