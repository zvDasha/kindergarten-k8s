require("dotenv").config({ override: false });
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");
const mqtt = require("mqtt");
//replaced jsonwebtoken + bcryptjs with Auth0 middleware
const { auth } = require("express-oauth2-jwt-bearer");
const fs = require("fs");
const path = require("path");

const Child = require("./models/Child");
const Group = require("./models/Group");
const Announcement = require("./models/Announcement");
const User = require("./models/User");
const Schedule = require("./models/Schedule");

const app = express();
app.use(express.json());
app.use(cors());
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

// Auth0 validation middleware (replaces authenticateToken)
const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
});

//role check middleware (replaces req.user.role checks inline)
const requireRole = (role) => (req, res, next) => {
  const roles = req.auth?.payload["https://kindergarten/roles"] ?? [];
  if (!roles.includes(role)) {
    return res.status(403).json({ error: "Forbidden: insufficient role" });
  }
  next();
};

const server = http.createServer(app);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL,
      "http://localhost:8080",
      "http://127.0.0.1:8080",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/kindergarten";
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error(err));

const logEvent = (message) => {
  const date = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
  const logMessage = `[${date}] ${message}\n`;
  fs.appendFile(path.join(__dirname, "server.log"), logMessage, (err) => {
    if (err) console.error("Error writing log:", err);
  });
};

const mqttClient = mqtt.connect(process.env.MQTT_URL || "mqtt://mqtt:1883");
mqttClient.on("connect", () => mqttClient.subscribe("kindergarten/gate"));

mqttClient.on("message", async (topic, message) => {
  if (topic === "kindergarten/gate") {
    const data = JSON.parse(message.toString());
    const child = await Child.findOne({ rfid: data.rfid }).populate("group");

    if (child) {
      child.isPresent = !child.isPresent;
      await child.save();
      io.emit("update", { msg: `Status change: ${child.name}`, child });
      logEvent(
        `TURNIQUET: Child ${child.name} (Group: ${child.group?.name || "N/A"}) - ${child.isPresent ? "Entered" : "Exited"}`,
      );
    }
  }
});

// routes for api
// role filtering now reads from Auth0 token
app.get("/api/children", checkJwt, async (req, res) => {
  const roles = req.auth?.payload["https://kindergarten/roles"] ?? [];
  const { search } = req.query;
  let query = {};
  if (!roles.includes("admin")) {
    const userId = req.auth?.payload.sub;
    const user = await User.findOne({ auth0Id: userId });
    if (user) query.parentId = user._id;
  }
  if (search) {
    query.name = { $regex: search, $options: "i" };
  }
  const children = await Child.find(query).populate("group");
  res.json(children);
});

app.post("/api/children", checkJwt, requireRole("admin"), async (req, res) => {
  const child = new Child(req.body);
  await child.save();
  logEvent(`DATA: Added child: ${child.name}`);
  res.json(child);
});
app.put(
  "/api/children/:id",
  checkJwt,
  requireRole("admin"),
  async (req, res) => {
    const child = await Child.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    logEvent(`DATA: Updated child: ${child.name}`);
    res.json(child);
  },
);
app.delete(
  "/api/children/:id",
  checkJwt,
  requireRole("admin"),
  async (req, res) => {
    const child = await Child.findById(req.params.id);
    if (child) {
      await Child.findByIdAndDelete(req.params.id);
      logEvent(`DATA: Deleted child: ${child.name}`);
    }
    res.json({ message: "Deleted" });
  },
);

app.get("/api/groups", checkJwt, async (req, res) => {
  const groups = await Group.find();
  res.json(groups);
});

app.post("/api/groups", checkJwt, requireRole("admin"), async (req, res) => {
  const group = new Group(req.body);
  await group.save();
  logEvent(`DATA: Added group: ${group.name}`);
  res.json(group);
});
app.put("/api/groups/:id", checkJwt, requireRole("admin"), async (req, res) => {
  const group = await Group.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  logEvent(`DATA: Updated group: ${group.name}`);
  res.json(group);
});
app.delete(
  "/api/groups/:id",
  checkJwt,
  requireRole("admin"),
  async (req, res) => {
    await Group.findByIdAndDelete(req.params.id);
    logEvent(`DATA: Deleted group ID: ${req.params.id}`);
    res.json({ message: "Deleted" });
  },
);

//role check now reads from Auth0 token instead of req.user
app.get("/api/schedule", checkJwt, async (req, res) => {
  try {
    const roles = req.auth?.payload["https://kindergarten/roles"] ?? [];
    const userId = req.auth?.payload.sub;

    if (roles.includes("admin")) {
      const { groupId } = req.query;
      if (!groupId) return res.json(null);

      const schedule = await Schedule.findOne({ group: groupId });
      return res.json(
        schedule || {
          group: groupId,
          monday: [],
          tuesday: [],
          wednesday: [],
          thursday: [],
          friday: [],
        },
      );
    }

    if (roles.includes("parent")) {
      const user = await User.findOne({ auth0Id: userId });
      const child = user ? await Child.findOne({ parentId: user._id }) : null;
      if (!child || !child.group) {
        return res
          .status(404)
          .json({ message: "Your child is not assigned to a group yet." });
      }
      const schedule = await Schedule.findOne({ group: child.group });
      return res.json(
        schedule || { message: "Schedule not set for this group yet." },
      );
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/schedule", checkJwt, requireRole("admin"), async (req, res) => {
  const { groupId, days } = req.body;
  const schedule = await Schedule.findOneAndUpdate(
    { group: groupId },
    {
      group: groupId,
      monday: days.monday,
      tuesday: days.tuesday,
      wednesday: days.wednesday,
      thursday: days.thursday,
      friday: days.friday,
    },
    { new: true, upsert: true },
  );
  logEvent(`DATA: Schedule updated for Group ID: ${groupId}`);
  res.json(schedule);
});

app.get("/api/announcement", checkJwt, async (req, res) => {
  const announcements = await Announcement.find().sort({ date: -1 });
  res.json(announcements);
});

app.post(
  "/api/announcement",
  checkJwt,
  requireRole("admin"),
  async (req, res) => {
    const announcement = new Announcement(req.body);
    await announcement.save();
    logEvent(`DATA: Added announcement: ${announcement.title}`);
    res.json(announcement);
  },
);
app.put(
  "/api/announcement/:id",
  checkJwt,
  requireRole("admin"),
  async (req, res) => {
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );
    res.json(announcement);
  },
);
app.delete(
  "/api/announcement/:id",
  checkJwt,
  requireRole("admin"),
  async (req, res) => {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  },
);

app.get("/api/users", checkJwt, requireRole("admin"), async (req, res) => {
  const users = await User.find({}, "-password");
  res.json(users);
});

app.delete(
  "/api/users/:id",
  checkJwt,
  requireRole("admin"),
  async (req, res) => {
    const user = await User.findByIdAndDelete(req.params.id);
    if (user) logEvent(`ADMIN: Deleted user: ${user.username}`);
    res.json({ message: "User deleted" });
  },
);

app.put("/api/users/:id/password", checkJwt, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: "Password too short" });
  }
  const bcrypt = require("bcryptjs");
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await User.findByIdAndUpdate(req.params.id, { password: hashedPassword });
  logEvent(`AUTH: Password changed for user ID: ${req.params.id}`);
  res.json({ success: true });
});

//removed /api/register and /api/login — auth  now handled by Auth0

app.get("/api/schedule/:groupId", checkJwt, async (req, res) => {
  try {
    const { groupId } = req.params;
    let schedule = await Schedule.findOne({ group: groupId });

    if (!schedule) {
      schedule = new Schedule({
        group: groupId,
        days: [
          { name: "Monday", activities: [] },
          { name: "Tuesday", activities: [] },
          { name: "Wednesday", activities: [] },
          { name: "Thursday", activities: [] },
          { name: "Friday", activities: [] },
        ],
      });
      await schedule.save();
    }
    res.json(schedule);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch schedule" });
  }
});

app.put(
  "/api/schedule/:groupId",
  checkJwt,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { groupId } = req.params;
      const { days } = req.body;

      let schedule = await Schedule.findOne({ group: groupId });
      if (!schedule) {
        schedule = new Schedule({ group: groupId });
      }
      schedule.days = days;
      await schedule.save();
      res.json(schedule);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update schedule" });
    }
  },
);

server.listen(3000, () => console.log("Server running on 3000"));
