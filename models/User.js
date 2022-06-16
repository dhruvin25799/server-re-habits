const mongoose = require("mongoose");
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  firstName: { type: String },
  lastName: { type: String },
  labels: Array,
  habits: Array,
  deleted: Array,
});
module.exports = mongoose.model("User", userSchema);