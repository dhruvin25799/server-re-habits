const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const helpers = require("./helpers");
const { v4: uuidv4 } = require("uuid");
const saltRounds = 10;
const PORT = process.env.PORT || 3001;

const app = express();
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/rehabitsDB"
);
const JWT_SECRET_KEY = process.env.JWT_KEY || "somekeyhere";

const User = require("./models/User");

app.listen(PORT, () => console.log(`Server listening on PORT ${PORT}`));

app.route("/api/register").post(async (req, res) => {
  try {
    const hash = await bcrypt.hash(req.body.password, saltRounds);
    const newUser = new User({
      email: req.body.email,
      password: hash,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      lables: [],
      habits: [],
      deleted: [],
    });
    await newUser.save();
    const token = jwt.sign(newUser._id.toString(), JWT_SECRET_KEY);
    const data = { user: newUser, encodedToken: token };
    res.status(200);
    res.send(JSON.stringify(data));
  } catch (err) {
    if (err.message.split(" ")[0] === "E11000") {
      const data = { error: "Email already registered" };
      res.status(403);
      res.send(JSON.stringify(data));
    } else {
      res.status(500);
      res.send();
    }
  }
});

app.route("/api/login").post(async (req, res) => {
  const userEmail = req.body.email;
  const userPassword = req.body.password;
  try {
    const foundUser = await User.findOne({ email: userEmail });
    if (foundUser) {
      const result = await bcrypt.compare(userPassword, foundUser.password);
      if (result === true) {
        const token = jwt.sign(foundUser._id.toString(), JWT_SECRET_KEY);
        const data = { user: foundUser, encodedToken: token };
        res.status(200);
        res.send(JSON.stringify(data));
      } else {
        throw new Error("Invalid Password");
      }
    } else {
      throw new Error("User not found");
    }
  } catch (err) {
    if (err.message === "Invalid Password") {
      res.status(401);
      res.send(JSON.stringify({ error: err.message }));
    } else if (err.message === "User not found") {
      res.status(404);
      res.send(JSON.stringify({ error: err.message }));
    } else {
      res.status(500);
      res.send(JSON.stringify({ error: "Internal Server Error" }));
    }
  }
});

app.route("/api/labels/add").post(async (req, res) => {
  const token = req.headers["authorization"];
  try {
    const decoded = helpers.verifyToken(token);
    const userLabel = req.body.label;
    const userId = decoded;
    const foundUser = await helpers.findUser(userId);
    foundUser.labels.push(userLabel);
    await foundUser.save();
    res.status(200);
    res.send(JSON.stringify({ labels: foundUser.labels }));
  } catch (err) {
    res.status(403);
    res.send(JSON.stringify({ error: "Invalid token" }));
  }
});

app.route("/api/labels/:labelText").delete(async (req, res) => {
  const token = req.headers["authorization"];
  try {
    const decoded = helpers.verifyToken(token);
    const userId = decoded;
    const labelText = req.params.labelText;
    const foundUser = await helpers.findUser(userId);
    foundUser.labels = foundUser.labels.filter((label) => label !== labelText);
    await foundUser.save();
    res.status(200);
    res.send(JSON.stringify({ labels: foundUser.labels }));
  } catch (err) {
    res.status(403);
    res.send(JSON.stringify({ error: "Invalid Token" }));
  }
});

app.route("/api/habits/add").post(async (req, res) => {
  const token = req.headers["authorization"];
  try {
    const decoded = helpers.verifyToken(token);
    const userId = decoded;
    const habit = req.body.habit;
    const foundUser = await helpers.findUser(userId);
    foundUser.habits.push({ _id: uuidv4(), ...habit, markedAsDone: [] });
    await foundUser.save();
    res.status(200);
    res.send(JSON.stringify({ habits: foundUser.habits }));
  } catch (err) {
    res.status(403);
    res.send(JSON.stringify({ error: "Invalid Token" }));
  }
});

app.route("/api/habits/done/:habitId").post(async (req, res) => {
  const token = req.headers["authorization"];
  try {
    const decoded = helpers.verifyToken(token);
    const habitId = req.params.habitId;
    const date = req.body.date;
    const userId = decoded;
    const foundUser = await helpers.findUser(userId);
    foundUser.habits = foundUser.habits.map((habit) =>
      habit._id === habitId
        ? {
            ...habit,
            markedAsDone: habit.markedAsDone.concat(date),
          }
        : habit
    );
    await foundUser.save();
    res.status(200);
    res.send(JSON.stringify({ habits: foundUser.habits }));
  } catch (err) {
    res.status(403);
    res.send(JSON.stringify({ error: "Invalid Token" }));
  }
});

app.route("/api/habits/edit/:habitId").post(async (req, res) => {
  const token = req.headers["authorization"];
  try {
    const decoded = helpers.verifyToken(token);
    const userId = decoded;
    const habitId = req.params.habitId;
    const editedHabit = req.body.habit;
    const foundUser = await helpers.findUser(userId);
    foundUser.habits = foundUser.habits.map((habit) =>
      habit._id === habitId ? editedHabit : habit
    );
    await foundUser.save();
    res.status(200);
    res.send(JSON.stringify({ habits: foundUser.habits }));
  } catch (err) {
    res.status(403);
    res.send(JSON.stringify({ error: "Invalid Token" }));
  }
});

app.route("/api/habits/delete/:habitId").post(async (req, res) => {
  const token = req.headers["authorization"];
  try {
    const decoded = helpers.verifyToken(token);
    const userId = decoded;
    const habitId = req.params.habitId;
    const foundUser = await helpers.findUser(userId);
    const habit = foundUser.habits.find((habit) => habit._id === habitId);
    foundUser.habits = foundUser.habits.filter((item) => item._id !== habitId);
    foundUser.deleted.push(habit);
    await foundUser.save();
    res.status(200);
    res.send(
      JSON.stringify({ habits: foundUser.habits, deleted: foundUser.deleted })
    );
  } catch (err) {
    res.status(403);
    res.send(JSON.stringify({ error: "Invalid Token" }));
  }
});

app.route("/api/habits/restore/:habitId").post(async (req, res) => {
  const token = req.headers["authorization"];
  try {
    const decoded = helpers.verifyToken(token);
    const userId = decoded;
    const habitId = req.params.habitId;
    const foundUser = await helpers.findUser(userId);
    const habit = foundUser.deleted.find((habit) => habit._id === habitId);
    foundUser.deleted = foundUser.deleted.filter((item) => item._id !== habitId);
    foundUser.habits.push(habit);
    await foundUser.save();
    res.status(200);
    res.send(
      JSON.stringify({ habits: foundUser.habits, deleted: foundUser.deleted })
    );
  } catch (err) {
    res.status(403);
    res.send(JSON.stringify({ error: "Invalid Token" }));
  }
});
