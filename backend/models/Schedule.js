const mongoose = require("mongoose");

const ActivitySchema = new mongoose.Schema({
  time: { type: String, required: true },
  description: { type: String, required: true },
});

const DaySchema = new mongoose.Schema({
  name: {
    type: String,
    enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    required: true,
  },
  activities: [ActivitySchema],
});

const ScheduleSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    required: true,
    unique: true,
  },
  days: {
    type: [DaySchema],
    default: [
      { name: "Monday", activities: [] },
      { name: "Tuesday", activities: [] },
      { name: "Wednesday", activities: [] },
      { name: "Thursday", activities: [] },
      { name: "Friday", activities: [] },
    ],
  },
});

module.exports = mongoose.model("Schedule", ScheduleSchema);
