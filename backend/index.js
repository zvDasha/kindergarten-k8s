require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");
const mqtt = require("mqtt");
const jwt = require("jsonwebtoken");

const Child = require("./models/Child");
const Group = require("./models/Group");
const Announcement = require("./models/Announcement");
const User = require("./models/User");
const Schedule = require("./models/Schedule");

const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors());
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

const JWT_SECRET = process.env.JWT_SECRET;

const server = http.createServer(app);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
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

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
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
app.post("/api/children", authenticateToken, async (req, res) => {
  const child = new Child(req.body);
  await child.save();
  logEvent(`DATA: Added child: ${child.name}`);
  res.json(child);
});
app.put("/api/children/:id", authenticateToken, async (req, res) => {
  const child = await Child.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  logEvent(`DATA: Updated child: ${child.name}`);
  res.json(child);
});
app.delete("/api/children/:id", authenticateToken, async (req, res) => {
  const child = await Child.findById(req.params.id);
  if (child) {
    await Child.findByIdAndDelete(req.params.id);
    logEvent(`DATA: Deleted child: ${child.name}`);
  }
  res.json({ message: "Deleted" });
});

app.get("/api/groups", authenticateToken, async (req, res) => {
  const groups = await Group.find();
  res.json(groups);
});
app.post("/api/groups", authenticateToken, async (req, res) => {
  const group = new Group(req.body);
  await group.save();
  logEvent(`DATA: Added group: ${group.name}`);
  res.json(group);
});
app.put("/api/groups/:id", authenticateToken, async (req, res) => {
  const group = await Group.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  logEvent(`DATA: Updated group: ${group.name}`);
  res.json(group);
});
app.delete("/api/groups/:id", authenticateToken, async (req, res) => {
  await Group.findByIdAndDelete(req.params.id);
  logEvent(`DATA: Deleted group ID: ${req.params.id}`);
  res.json({ message: "Deleted" });
});

app.get("/api/schedule", authenticateToken, async (req, res) => {
  try {
    if (req.user.role === "admin") {
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
    if (req.user.role === "parent") {
      const child = await Child.findOne({ parentId: req.user.id });
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

app.post("/api/schedule", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") return res.sendStatus(403);
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

app.get("/api/announcement", authenticateToken, async (req, res) => {
  const announcements = await Announcement.find().sort({ date: -1 });
  res.json(announcements);
});
app.post("/api/announcement", authenticateToken, async (req, res) => {
  const announcement = new Announcement(req.body);
  await announcement.save();
  logEvent(`DATA: Added announcement: ${announcement.title}`);
  res.json(announcement);
});
app.put("/api/announcement/:id", authenticateToken, async (req, res) => {
  const announcement = await Announcement.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true },
  );
  res.json(announcement);
});
app.delete("/api/announcement/:id", authenticateToken, async (req, res) => {
  await Announcement.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

app.get("/api/users", authenticateToken, async (req, res) => {
  const users = await User.find({}, "-password");
  res.json(users);
});

app.delete("/api/users/:id", authenticateToken, async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (user) logEvent(`ADMIN: Deleted user: ${user.username}`);
  res.json({ message: "User deleted" });
});

app.put("/api/users/:id/password", authenticateToken, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: "Password too short" });
  }
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await User.findByIdAndUpdate(req.params.id, { password: hashedPassword });
  logEvent(`AUTH: Password changed for user ID: ${req.params.id}`);
  res.json({ success: true });
});

app.post("/api/register", async (req, res) => {
  const { username, password, role, childCard } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Fill in all fields" });
  }

  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return res
      .status(400)
      .json({ success: false, message: "Username is already taken" });
  }

  let linkedChild = null;

  if (role === "parent") {
    if (!childCard) {
      return res.status(400).json({
        success: false,
        message: "Please enter your Child's RFID Card Number",
      });
    }

    linkedChild = await Child.findOne({ rfid: childCard });

    if (!linkedChild) {
      return res.status(400).json({
        success: false,
        message: "Child with this Card ID not found!",
      });
    }
  }

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

  logEvent(`AUTH: Registered new user: ${username} (${role})`);

  res.json({ success: true, message: "User created!" });
});

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

app.get("/api/schedule/:groupId", authenticateToken, async (req, res) => {
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

app.put("/api/schedule/:groupId", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Only admins can edit schedules" });
  }
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
});

server.listen(3000, () => console.log("Server running on 3000"));
