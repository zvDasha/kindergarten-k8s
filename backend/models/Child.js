const mongoose = require("mongoose");

const ChildSchema = new mongoose.Schema({
  name: { type: String, required: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
  rfid: String,
  isPresent: { type: Boolean, default: false },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

module.exports = mongoose.model("Child", ChildSchema);
