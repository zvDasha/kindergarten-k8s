const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String, enum: ["admin", "parent"], default: "parent" },
  auth0Id: { type: String },
});

module.exports = mongoose.model("User", UserSchema);
