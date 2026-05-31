const mongoose = require("mongoose");

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  room: Number,
});

module.exports = mongoose.model("Group", GroupSchema);
