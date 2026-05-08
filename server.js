const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();

const planRoutes = require("./routes/plans");

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/liftWeatherPlanner";

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", planRoutes);

app.use((req, res) => {
  res.status(404).render("error", {
    title: "Page Not Found",
    message: "That page does not exist. Use the navigation links to get back on track."
  });
});

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(port, () => {
      console.log(`Lift Weather Planner is running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
