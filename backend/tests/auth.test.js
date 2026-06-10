const request = require("supertest");
const express = require("express");
const { auth } = require("express-oauth2-jwt-bearer");

// ─── Middleware (скопійований з index.js) ────────────────────────────────────

const checkJwt = auth({
  audience: "https://kindergarten-api",
  issuerBaseURL: "https://test.auth0.com",
});

const requireRole = (role) => (req, res, next) => {
  const roles = req.auth?.payload["https://kindergarten/roles"] ?? [];
  if (!roles.includes(role)) {
    return res.status(403).json({ error: "Forbidden: insufficient role" });
  }
  next();
};

// ─── Pomocnicze funkcje ──────────────────────────────────────────────────────

// Tworzy aplikację z fałszywym tokenem (do testowania logiki ról)
function makeApp(roles = []) {
  const app = express();
  app.use(express.json());

  // Symulujemy zweryfikowany token JWT z Auth0
  app.use((req, _res, next) => {
    req.auth = {
      payload: {
        sub: "auth0|testuser",
        "https://kindergarten/roles": roles,
      },
    };
    next();
  });

  return app;
}

// ─── Aplikacja do testów JWT (prawdziwy checkJwt) ───────────────────────────

const jwtApp = express();
jwtApp.use(express.json());
jwtApp.get("/health", (req, res) => res.json({ status: "ok" }));
jwtApp.get("/api/children", checkJwt, (req, res) => res.json([]));
jwtApp.post("/api/children", checkJwt, requireRole("admin"), (req, res) =>
  res.status(201).json({ name: req.body.name }),
);
jwtApp.get("/api/users", checkJwt, requireRole("admin"), (req, res) =>
  res.json([]),
);

// Publiczny endpoint /health
describe("/health — publiczny endpoint", () => {
  test("zwraca 200 bez tokena", async () => {
    const res = await request(jwtApp).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  test("zwraca 200 nawet z błędnym tokenem", async () => {
    const res = await request(jwtApp)
      .get("/health")
      .set("Authorization", "Bearer nieprawidlowy.token");
    expect(res.status).toBe(200);
  });
});

//Ochrona JWT — brak lub błędny token → 401

describe("Ochrona JWT — 401 bez tokena", () => {
  test("GET /api/children bez tokena → 401", async () => {
    const res = await request(jwtApp).get("/api/children");
    expect(res.status).toBe(401);
  });

  test("GET /api/children z błędnym tokenem → 401", async () => {
    const res = await request(jwtApp)
      .get("/api/children")
      .set("Authorization", "Bearer zly.token.tutaj");
    expect(res.status).toBe(401);
  });

  test("POST /api/children bez tokena → 401", async () => {
    const res = await request(jwtApp)
      .post("/api/children")
      .send({ name: "Jan" });
    expect(res.status).toBe(401);
  });

  test("GET /api/users bez tokena → 401", async () => {
    const res = await request(jwtApp).get("/api/users");
    expect(res.status).toBe(401);
  });
});

// Kontrola ról — brak roli admin → 403

describe("Kontrola ról — 403 bez roli admin", () => {
  // Symulujemy zalogowanego rodzica (brak roli admin)
  const app = makeApp(["parent"]);
  app.post("/api/children", requireRole("admin"), (req, res) =>
    res.status(201).json({}),
  );
  app.post("/api/groups", requireRole("admin"), (req, res) =>
    res.status(201).json({}),
  );
  app.post("/api/announcement", requireRole("admin"), (req, res) =>
    res.status(201).json({}),
  );
  app.get("/api/users", requireRole("admin"), (req, res) => res.json([]));
  app.delete("/api/children/:id", requireRole("admin"), (req, res) =>
    res.json({ message: "Deleted" }),
  );

  test("POST /api/children jako parent → 403", async () => {
    const res = await request(app).post("/api/children").send({ name: "Jan" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Forbidden/);
  });

  test("POST /api/groups jako parent → 403", async () => {
    const res = await request(app).post("/api/groups").send({ name: "Grupa" });
    expect(res.status).toBe(403);
  });

  test("POST /api/announcement jako parent → 403", async () => {
    const res = await request(app)
      .post("/api/announcement")
      .send({ title: "Ogłoszenie" });
    expect(res.status).toBe(403);
  });

  test("GET /api/users jako parent → 403", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(403);
  });

  test("DELETE /api/children/123 jako parent → 403", async () => {
    const res = await request(app).delete("/api/children/123");
    expect(res.status).toBe(403);
  });
});

//Admin ma pełny dostęp

describe("Admin — pełny dostęp", () => {
  const app = makeApp(["admin"]);
  app.post("/api/children", requireRole("admin"), (req, res) =>
    res.status(201).json({ name: req.body.name }),
  );
  app.get("/api/users", requireRole("admin"), (req, res) =>
    res.json([{ username: "admin" }]),
  );
  app.delete("/api/children/:id", requireRole("admin"), (req, res) =>
    res.json({ message: "Deleted" }),
  );

  test("POST /api/children jako admin → 201", async () => {
    const res = await request(app)
      .post("/api/children")
      .send({ name: "Anna Kowalska" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Anna Kowalska");
  });

  test("GET /api/users jako admin → 200 z listą", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("DELETE /api/children/123 jako admin → 200", async () => {
    const res = await request(app).delete("/api/children/123");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Deleted");
  });
});

// filtrowanie danych wg roli (admin widzi wszystko, parent tylko swoje)
describe("Filtrowanie danych wg roli", () => {
  function makeChildrenApp(roles) {
    const app = makeApp(roles);
    app.get("/api/children", (req, res) => {
      const userRoles = req.auth.payload["https://kindergarten/roles"];
      if (userRoles.includes("admin")) {
        return res.json([{ name: "Dziecko 1" }, { name: "Dziecko 2" }]);
      }
      return res.json([{ name: "Tylko moje dziecko" }]);
    });
    return app;
  }

  test("admin widzi wszystkie dzieci", async () => {
    const res = await request(makeChildrenApp(["admin"])).get("/api/children");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  test("parent widzi tylko swoje dziecko", async () => {
    const res = await request(makeChildrenApp(["parent"])).get("/api/children");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe("Tylko moje dziecko");
  });
});
