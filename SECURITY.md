# Dokumentacja bezpieczeństwa — Kindergarten App

---

## Backend zabezpieczony OAuth 2.0

**Gdzie:** `backend/index.js`, linie 25–28

Zamiast własnego JWT (`jsonwebtoken`) używamy biblioteki `express-oauth2-jwt-bearer`, która automatycznie pobiera klucze publiczne z Auth0 i weryfikuje każdy token.

```js
const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
});
```

Middleware `checkJwt` jest dodany do każdego chronionego endpointu, np.:

```js
app.get("/api/children", checkJwt, async (req, res) => { ... });
```

---

## Endpoint uwzględniający rolę użytkownika

**Gdzie:** `backend/index.js`, linie 31–36 (middleware) + linia 87 (użycie)

Zdefiniowany middleware `requireRole` odczytuje role z tokenu JWT (claim `https://kindergarten/roles`, ustawiony w Auth0 Action):

```js
const requireRole = (role) => (req, res, next) => {
  const roles = req.auth?.payload["https://kindergarten/roles"] ?? [];
  if (!roles.includes(role))
    return res.status(403).json({ error: "Forbidden" });
  next();
};
```

Dodatkowo `GET /api/children` (linia 87) filtruje dane wg roli — admin widzi wszystkie dzieci, parent tylko swoje. To samo dotyczy `GET /api/schedule`.

---

## Zabezpieczone endpointy (ponad 4 wymagane)

Wszystkie endpointy poniżej wymagają ważnego tokenu JWT (`checkJwt`). Te oznaczone `[admin]` wymagają dodatkowo roli admin (`requireRole("admin")`).

| Endpoint                | Metoda | Ochrona       |
| ----------------------- | ------ | ------------- |
| `/api/children`         | GET    | JWT           |
| `/api/children`         | POST   | JWT + [admin] |
| `/api/children/:id`     | PUT    | JWT + [admin] |
| `/api/children/:id`     | DELETE | JWT + [admin] |
| `/api/groups`           | GET    | JWT           |
| `/api/groups`           | POST   | JWT + [admin] |
| `/api/groups/:id`       | PUT    | JWT + [admin] |
| `/api/groups/:id`       | DELETE | JWT + [admin] |
| `/api/announcement`     | GET    | JWT           |
| `/api/announcement`     | POST   | JWT + [admin] |
| `/api/announcement/:id` | PUT    | JWT + [admin] |
| `/api/announcement/:id` | DELETE | JWT + [admin] |
| `/api/schedule`         | GET    | JWT           |
| `/api/schedule`         | POST   | JWT + [admin] |
| `/api/users`            | GET    | JWT + [admin] |
| `/api/users/:id`        | DELETE | JWT + [admin] |

---

## Niezabezpieczony endpoint

**Gdzie:** `backend/index.js`, linia 22

```js
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));
```

Dostępny bez tokenu — służy do sprawdzenia czy serwer działa (health check dla Docker/k8s).

---

## Frontend korzystający z backendu

**Gdzie:** `frontend/src/main.jsx`, `frontend/src/App.jsx`

Frontend to aplikacja React. Używa biblioteki `@auth0/auth0-react`. Przy każdym żądaniu do API pobiera token i dołącza go do nagłówka:

```js
// App.jsx, linia 53
const token = await getAccessTokenSilently({ ... });
// token jest wysyłany jako: Authorization: Bearer <token>
```

Logowanie odbywa się przez przekierowanie do Auth0 (`loginWithRedirect()`), wylogowanie przez `logout()`.

---

## Baza danych

**Gdzie:** `backend/models/`, `docker-compose.yml`, `k8s/mongo.yaml`

MongoDB z biblioteką Mongoose. Modele: `Child`, `Group`, `Announcement`, `Schedule`, `User`.

W Docker Compose dane są trwałe dzięki named volume:

```yaml
volumes:
  mongo_data: # docker-compose.yml, linia 37
```

W Kubernetes MongoDB działa jako StatefulSet z PersistentVolumeClaim (`k8s/mongo.yaml`, linia 51) — dane przeżywają restart poda.

---

## Skonfigurowany Authorization Server (nie Keycloak)

**Authorization Server:** [Auth0](https://auth0.com) — tenant `dev-s75g8np76uar4fon.us.auth0.com`

W Auth0 skonfigurowano:

- **Application** (SPA) — dla frontendu
- **API** z identyfikatorem `https://kindergarten-api` — dla backendu
- **Action (Login flow)** — dodaje role użytkownika do tokenu jako claim `https://kindergarten/roles`
- **Role: admin** i **Role: parent** — przypisywane ręcznie w panelu Auth0

---

## PKCE — jak działa

PKCE (Proof Key for Code Exchange) jest włączone automatycznie przez `@auth0/auth0-react` dla każdego SPA. Chroni przed przechwyceniem kodu autoryzacji.

**Przebieg:**

```
1. Użytkownik klika "Log In"
   → przeglądarka generuje losowy code_verifier (np. 128 znaków)
   → liczy code_challenge = BASE64URL(SHA256(code_verifier))

2. Przeglądarka przekierowuje do Auth0:
   /authorize?response_type=code
              &code_challenge=<hash>
              &code_challenge_method=S256

3. Auth0 zwraca authorization_code (widoczny w URL)

4. Frontend wysyła do Auth0:
   POST /oauth/token
        code=<authorization_code>
        code_verifier=<oryginalny losowy ciąg>

5. Auth0 sprawdza: SHA256(code_verifier) == code_challenge?
   tak → zwraca access_token (JWT)
   nie → odrzuca żądanie
```

**Po co to?** Nawet jeśli atakujący przechwyci `authorization_code` (np. z URL), nie może go użyć — nie zna `code_verifier`, który nigdy nie opuszcza przeglądarki.

---

## Docker

**Gdzie:** `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`

Trzy serwisy: `mongodb`, `backend`, `frontend`. Frontend jest serwowany przez nginx jako statyczny build.

---

## Kubernetes

**Gdzie:** katalog `k8s/`

| Plik                 | Co robi                                                  |
| -------------------- | -------------------------------------------------------- |
| `namespace.yaml`     | Izolowany namespace `kindergarten`                       |
| `backend.yaml`       | Deployment backendu (2 repliki, rolling update)          |
| `frontend.yaml`      | Deployment frontendu                                     |
| `mongo.yaml`         | StatefulSet MongoDB z PVC (trwałe dane)                  |
| `ingress.yaml`       | Routing HTTP → backend/frontend                          |
| `configmap.yaml`     | Zmienne środowiskowe (URL-e, domena)                     |
| `secret.yaml`        | Wrażliwe dane (zaszyfrowane w k8s)                       |
| `networkpolicy.yaml` | Ograniczenie ruchu sieciowego między podami              |
| `pdb.yaml`           | PodDisruptionBudget — min. 1 pod dostępny podczas update |

---

## Testy automatyczne + CI/CD

**Testy:** `backend/tests/auth.test.js` — 16 testów (Jest + Supertest)

Testowane scenariusze:

- `/health` działa bez tokenu
- chronione endpointy zwracają 401 bez tokenu / z błędnym tokenem
- `requireRole("admin")` zwraca 403 dla roli `parent`
- admin ma pełny dostęp (201, 200)
- dane są filtrowane wg roli (admin vs parent)

**CI/CD:** `.github/workflows/main.yml` — uruchamia się przy każdym `git push`:

```
1. Uruchom testy (npm test)
2. Zbuduj obrazy Docker dla backend i frontend
3. Wypchnij obrazy do GitHub Container Registry (ghcr.io)
4. Uruchom minikube
5. Zadeploy na Kubernetes (kubectl apply -f k8s/)
6. Poczekaj na rollout i pokaż stan podów
```
