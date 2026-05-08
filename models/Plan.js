const mongoose = require("mongoose");

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  splitType: {
    type: String,
    required: true,
    enum: ["Upper/Lower", "Push Pull Legs", "Full Body", "Arnold Split", "Anterior/Posterior"]
  },
  workoutFocus: {
    type: String,
    required: true,
    trim: true
  },
  notes: {
    type: String,
    trim: true,
    default: ""
  },
  temperature: Number,
  windSpeed: Number,
  weatherCode: Number,
  weatherSummary: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Plan", planSchema);
