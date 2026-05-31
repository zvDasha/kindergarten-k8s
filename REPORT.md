# Raport z realizacji projektu kursowego

## 1 HTTP - OPERACJE CRUD

### 1.1. CREATE - Dodawanie danych

Opis: Możliwość tworzenia 5 różnych typów danych

#### Children (Dzieci)

Plik: backend/index.js
Linie: 94-99
Endpoint: POST /api/children
Funkcja: app.post("/api/children", authenticateToken, async (req, res) => {...})
Kod:

```javascript
app.post("/api/children", authenticateToken, async (req, res) => {
  const child = new Child(req.body);
  await child.save();
  logEvent(`DATA: Added child: ${child.name}`);
  res.json(child);
});
```

#### Groups (Grupy)

Plik: backend/index.js
Linie: 120-125
Endpoint: POST /api/groups
Funkcja: app.post("/api/groups", authenticateToken, async (req, res) => {...})
Kod:

```javascript
app.post("/api/groups", authenticateToken, async (req, res) => {
  const group = new Group(req.body);
  await group.save();
  logEvent(`DATA: Added group: ${group.name}`);
  res.json(group);
});
```

#### Announcements (Ogłoszenia)

Plik: backend/index.js
Linie: 198-203
Endpoint: POST /api/announcement
Funkcja: app.post("/api/announcement", authenticateToken, async (req, res) => {...})
Kod:

```javascript
app.post("/api/announcement", authenticateToken, async (req, res) => {
  const announcement = new Announcement(req.body);
  await announcement.save();
  logEvent(`DATA: Added announcement: ${announcement.title}`);
  res.json(announcement);
});
```

#### Users (Użytkownicy poprzez rejestrację)

Plik: backend/index.js
Linie: 239-294
Endpoint: POST /api/register
Funkcja: app.post("/api/register", async (req, res) => {...})
Cechy:

- Haszowanie haseł za pomocą bcrypt
- Automatyczne powiązywanie rodziców z dziećmi za pomocą karty RFID
- Sprawdzanie unikalności username

Kod:

```javascript
const hashedPassword = await bcrypt.hash(password, 10);
const user = new User({
  username,
  password: hashedPassword,
  role: role || "parent",
});
const savedUser = await user.save();
if (linkedChild) {
  linkedChild.parentId = savedUser._id;
  await linkedChild.save();
  logEvent(
    `LINK: Linked Parent ${username} to Child ${linkedChild.name} (${linkedChild.rfid})`,
  );
}
```

#### Schedule (Harmonogram)

Plik: backend/index.js
Linie: 323-346
Endpoint: GET /api/schedule/:groupId (Lazy Creation)
Funkcja: Automatyczne tworzenie przy pierwszym dostępie.
Kod:

```javascript
if (!schedule) {
  schedule = new Schedule({ group: groupId });
  await schedule.save();
}
```

### 1.2. READ - Odczyt danych

Opis: Możliwość odczytu 5 różnych typów danych

#### Children (Dzieci)

Plik: backend/index.js
Linie: 82-93
Endpoint: GET /api/children
Funkcja: app.get("/api/children", authenticateToken, async (req, res) => {...})
Cechy:

- Filtrowanie według ID rodzica (rodzice widzą tylko swoje dzieci)
- Wyszukiwanie (parametr search)
- Informacji o grupie

Kod:

```javascript
app.get("/api/children", authenticateToken, async (req, res) => {
  const { search, parentId, role } = req.query;
  let query = {};
  if (role !== "admin" && parentId) {
    query.parentId = parentId;
  }
  if (search) {
    query.name = { $regex: search, $options: "i" };
  }
  const children = await Child.find(query).populate("group");
  res.json(children);
});
```

#### Groups (Grupy)

Plik: backend/index.js
Linie: 116-119
Endpoint: GET /api/groups
Funkcja: app.get("/api/groups", authenticateToken, async (req, res) => {...})

#### Announcements (Ogłoszenia)

Plik: backend/index.js
Linie: 194-197
Endpoint: GET /api/announcement
Funkcja: app.get("/api/announcement", authenticateToken, async (req, res) => {...})
Cechy: Sortowanie według daty (od najnowszych)
Kod:

```javascript
const announcements = await Announcement.find().sort({ date: -1 });
```

#### Users (Użytkownicy)

Plik: backend/index.js
Linie: 217-220
Endpoint: GET /api/users
Funkcja: app.get("/api/users", authenticateToken, async (req, res) => {...})
Cechy: Wykluczenie haseł z odpowiedzi
Kod:

```javascript
const users = await User.find({}, "-password");
```

#### Schedule (Harmonogram)

Plik: backend/index.js
Linie: 323-346
Endpoint: GET /api/schedule/:groupId
Funkcja: app.get("/api/schedule/:groupId", authenticateToken, async (req, res) => {...})
Kod:

```javascript
app.get("/api/schedule/:groupId", authenticateToken, async (req, res) => {
  // ...
  let schedule = await Schedule.findOne({ group: groupId });
  res.json(schedule);
});
```

### 1.3. UPDATE - Aktualizacja danych

Opis: Możliwość aktualizacji 5 różnych typów danych

#### Children (Dzieci)

Plik: backend/index.js
Linie: 100-106
Endpoint: PUT /api/children/:id
Funkcja: app.put("/api/children/:id", authenticateToken, async (req, res) => {...})
Kod:

```javascript
app.put("/api/children/:id", authenticateToken, async (req, res) => {
  const child = await Child.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  logEvent(`DATA: Updated child: ${child.name}`);
  res.json(child);
});
```

#### Groups (Grupy)

Plik: backend/index.js
Linie: 126-132
Endpoint: PUT /api/groups/:id
Funkcja: app.put("/api/groups/:id", authenticateToken, async (req, res) => {...})

#### Announcements (Ogłoszenia)

Plik: backend/index.js
Linie: 204-211
Endpoint: PUT /api/announcement/:id
Funkcja: app.put("/api/announcement/:id", authenticateToken, async (req, res) => {...})

#### User Password (Hasło użytkownika)

Plik: backend/index.js
Linie: 228-237
Endpoint: PUT /api/users/:id/password
Funkcja: app.put("/api/users/:id/password", authenticateToken, async (req, res) => {...})
Cechy:

- Walidacja minimalnej długości hasła (6 znaków)
- Sprawdzenie na spacji
- Minimum jedna i litera i sprcjalny znak
- Haszowanie nowego hasła

Kod:

```javascript
if (!newPassword || newPassword.length < 6) {
  return res.status(400).json({ message: "Password too short" });
}
const hashedPassword = await bcrypt.hash(newPassword, 10);
await User.findByIdAndUpdate(req.params.id, { password: hashedPassword });
```

#### Schedule (Harmonogram)

Plik: backend/index.js
Linie: 348-367
Endpoint: PUT /api/schedule/:groupId  
Funkcja: app.put("/api/schedule/:groupId", authenticateToken, async (req, res) => {...})
Kod:

`````javascript
app.put("/api/schedule/:groupId", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json(...);
  // ...
  schedule.days = days;
  await schedule.save();
});

### 1.4. DELETE - Usuwanie danych

Opis: Możliwość usuwania 5 różnych typów danych

#### Schedule Activities (Aktywności w harmonogramie)

Opis: Usuwanie poszczególnych pozycji z listy zajęć.
Kod (Frontend):

````javascript
const deleteActivity = (dayIndex, activityIndex) => {
  const newDays = [...schedule.days];
  newDays[dayIndex].activities.splice(activityIndex, 1);
  updateSchedule(newDays);
};
`````

#### Children (Dzieci)

Plik: backend/index.js
Linie: 107-114
Endpoint: DELETE /api/children/:id
Funkcja: app.delete("/api/children/:id", authenticateToken, async (req, res) => {...})
Kod:

```javascript
app.delete("/api/children/:id", authenticateToken, async (req, res) => {
  const child = await Child.findById(req.params.id);
  if (child) {
    await Child.findByIdAndDelete(req.params.id);
    logEvent(`DATA: Deleted child: ${child.name}`);
  }
  res.json({ message: "Deleted" });
});
```

#### Groups (Grupy)

Plik: backend/index.js
Linie: 133-137
Endpoint: DELETE /api/groups/:id

#### Announcements (Ogłoszenia)

Plik: backend/index.js
Linie: 212-215
Endpoint: DELETE /api/announcement/:id

#### Users (Użytkownicy)

Plik: backend/index.js
Linie: 222-226
Endpoint: DELETE /api/users/:id
Kod:

```javascript
app.delete("/api/users/:id", authenticateToken, async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (user) logEvent(`ADMIN: Deleted user: ${user.username}`);
  res.json({ message: "User deleted" });
});
```

### 1.5. Wyszukiwanie według wzorca

Opis: Wyszukiwanie dzieci według imienia

Plik: backend/index.js
Linie: 88-90
Endpoint: GET /api/children?search=PATTERN
Kod:

```javascript
if (search) {
  query.name = { $regex: search, $options: "i" };
}
```

### 1.6. Logowanie i Wylogowanie

Opis: System uwierzytelniania za pomocą tokenów JWT z podziałem na role.

#### Roles (Role użytkowników)

System obsługuje dwa główne typy użytkowników z różnymi poziomami uprawnień:

1. Administrator (Admin):

- Może tworzyć, edytować i usuwać dzieci, grupy, ogłoszenia oraz użytkowników.
- Może dodawać, edytować i usuwać wydarzenia z harmonogramu grup.
- Widzi wszystkich użytkowników i wszystkie dzieci w systemie.

2. Rodzic (Parent):

- Może tylko przeglądać informacje (dzieci, grupy, ogłoszenia, harmonogram).
- Widzi tylko dzieci, które są przypisane do jego konta (połączone przez parentId i RFID).
- Nie może modyfikować żadnych danych w systemie (poza zmianą własnego hasła).

#### Login (Logowanie)

Plik: backend/index.js
Linie: 296-321
Endpoint: POST /api/login
Funkcja: app.post("/api/login", async (req, res) => {...})
Cechy:

- Sprawdzanie hasła przez bcrypt.compare()
- Generowanie tokena JWT
- Logowanie zdarzeń

Kod:

```javascript
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user)
    return res.status(400).json({ success: false, message: "User not found" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (isMatch) {
    logEvent(`AUTH: Successful login for: ${user.username}`);
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({
      success: true,
      role: user.role,
      name: user.username,
      id: user._id,
      token: token,
    });
  } else {
    logEvent(`AUTH: Failed login: ${username}`);
    res.status(400).json({ success: false, message: "Incorrect password" });
  }
});
```

#### Logout (Wylogowanie)

Plik: frontend/src/App.jsx
Linie: 161-173
Funkcja: onClick={() => setUser(null)}

### 1.7. Klient API

Opis: W pełni funkcjonalny klient React.

Główne pliki klienta:

- frontend/src/App.jsx - Główny komponent
- frontend/src/Login.jsx - Logowanie/rejestracja
- frontend/src/components/cardList.jsx - Wyświetlanie list
- frontend/src/components/GroupSchedule.jsx - Komponent harmonogramu

---

## MQTT, WebSocket, SSE

### 2.1. Backend MQTT

Opis: Integracja MQTT dla symulacji bramki.

#### Subskrybent MQTT z automatyczną aktualizacją bazy danych

Plik: backend/index.js
Linie: 62-79
Opis: Subskrypcja tematu, aktualizacja statusu i wysłanie zdarzenia WebSocket.
Kod:

```javascript
mqttClient.on("message", async (topic, message) => {
  if (topic === "kindergarten/gate") {
    const data = JSON.parse(message.toString());
    const child = await Child.findOne({ rfid: data.rfid }).populate("group");
    if (child) {
      child.isPresent = !child.isPresent;
      await child.save();
      io.emit("update", { msg: `Status change: ${child.name}`, child });
    }
  }
});
```

### 2.2. Frontend WebSocket

Opis: Aktualizacja UI w czasie rzeczywistym poprzez Socket.IO.
Plik: frontend/src/App.jsx
Linie: 72-78
Kod:

```javascript
useEffect(() => {
  socket.on("update", (data) => {
    toast.info(`${data.msg}`);
    if (activeTab !== "profile") fetchData();
  });
  return () => socket.off("update");
}, [activeTab, user]);
```

## INNE FUNKCJONALNOŚCI

### Funkcjonalności związane z protokołami

#### 1. Uwierzytelnianie JWT

Plik: backend/index.js
Linie: 49-60
Funkcja: authenticateToken

#### 2. Konfiguracja CORS

Plik: backend/index.js
Linie: 22, 28-31
Opis: Konfiguracja dostępu dla klienta React i WebSocket.

### Ogólne funkcjonalności

#### 1. Logowanie do pliku

Plik: backend/index.js
Linie: 41-47
Funkcja: logEvent(message)

#### 2. Baza danych MongoDB

Plik: backend/index.js
Linie: 34-39

#### 3. Szyfrowanie haseł

Plik: backend/index.js
Linie: 275 (rejestracja), 233 (zmiana hasła), 302 (logowanie)
**endpoint:** `PUT /api/users/:id/password`
**Funkcja:** `app.put("/api/users/:id/password", authenticateToken, async (req, res) => {...})`
**Cechy:**

- Walidacja minimalnej długości hasła (6 znaków)
- Sprawdzenie na spacji
- Minimum jedna i litera i sprcjalny znak
- Haszowanie nowego hasła

**Kod:**

```javascript
if (!newPassword || newPassword.length < 6) {
  return res.status(400).json({ message: "Password too short" });
}
const hashedPassword = await bcrypt.hash(newPassword, 10);
await User.findByIdAndUpdate(req.params.id, { password: hashedPassword });
```

#### 4. Walidacja haseł (Frontend & Backend)

---

## DODATKOWE FUNKCJE (Zrealizowane dodatkowo)

### 1. System Zarządzania Harmonogramem (Schedule Management System)

Opis: Pełny system zarządzania harmonogramem zajęć dla każdej grupy

#### Model danych

Plik: backend/models/Schedule.js
Opis: Schedule powiązany z Group (jeden-do-jednego). Zawiera tablicę z 5 dniami (Poniedziałek-Piątek), z których każdy ma listę aktywności (time, description).
Kod:

```javascript
const ScheduleSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true, unique: true },
  days: { type: [DaySchema], default: [...] },
});
```

#### Backend Logic (CRUD dla harmonogramu)

Plik: backend/index.js
Linie: 323-346 (GET), 348-367 (PUT)

Zasady dostępu:

1. GET (Odczyt):
   - Administrator otrzymuje harmonogram dowolnej grupy po groupId.
   - Jeśli harmonogram nie istnieje, jest tworzony automatycznie ("lazy initialization").
   - Rodzice (logika planowana) mogą widzieć harmonogram grupy swojego dziecka.
2. PUT (Aktualizacja):
   - Tylko administrator (req.user.role === "admin") może zmieniać harmonogram.

Kod (Endpoint do pobierania):

```javascript
app.get("/api/schedule/:groupId", authenticateToken, async (req, res) => {
  res.json(schedule);
});
```

Kod (Endpoint do edycji):

```javascript
app.put("/api/schedule/:groupId", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Only admins can edit schedules" });
  }
  await schedule.save();
  res.json(schedule);
});
```

#### Komponent Frontend (UI Harmonogramu)

Plik: frontend/src/components/GroupSchedule.jsx
Integracja: Wywoływany w frontend/src/components/cardList.jsx (linie 25-27) dla każdej karty grupy.

Funkcjonalność:

- Accordion UI: Przycisk "Show/Hide Schedule" otwiera listę dni. Kliknięcie na dzień rozwija go i zwija inne.
- Role-based UI:
  - Administratorzy widzą formularze dodawania aktywności (AddActivityForm) i przyciski usuwania (x).
  - Rodzice widzą tylko listę zajęć.
- Optimistic UI / Real-time kind: Listy sortowane są według czasu automatycznie przy dodawaniu.

Kod (dodawanie aktywności):

```javascript
const addActivity = (dayIndex, time, description) => {
  const newDays = [...schedule.days];
  newDays[dayIndex].activities.push({ time, description });
  newDays[dayIndex].activities.sort((a, b) => a.time.localeCompare(b.time));
  updateSchedule(newDays);
};
```
