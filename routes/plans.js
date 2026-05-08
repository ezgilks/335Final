const express = require("express");
const Plan = require("../models/Plan");

const router = express.Router();

function weatherText(code) {
  const labels = {
    0: "Clear sky",
    1: "Mostly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm"
  };

  return labels[code] || "Weather data available";
}

function workoutAdvice(temp, wind, code) {
  if (code >= 61 && code <= 82) {
    return "Rain is likely, so an indoor gym session is the safer plan.";
  }
  if (temp <= 40) {
    return "Cold weather today. Warm up longer before heavy sets.";
  }
  if (temp >= 85) {
    return "Hot weather today. Bring water and avoid long outdoor conditioning.";
  }
  if (wind >= 20) {
    return "Wind is high, so keep any outdoor work simple and controlled.";
  }

  return "Weather looks manageable. This is a good day for a normal training session.";
}

async function getWeather(city) {
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const geoResponse = await fetch(geoUrl);

  if (!geoResponse.ok) {
    throw new Error("Could not reach the location lookup API.");
  }

  const geoData = await geoResponse.json();
  if (!geoData.results || geoData.results.length === 0) {
    throw new Error("City was not found. Try a larger nearby city.");
  }

  const place = geoData.results[0];
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph`;
  const weatherResponse = await fetch(weatherUrl);

  if (!weatherResponse.ok) {
    throw new Error("Could not reach the weather forecast API.");
  }

  const weatherData = await weatherResponse.json();
  const current = weatherData.current;
  const code = current.weather_code;

  return {
    resolvedCity: `${place.name}${place.admin1 ? ", " + place.admin1 : ""}${place.country ? ", " + place.country : ""}`,
    temperature: current.temperature_2m,
    windSpeed: current.wind_speed_10m,
    weatherCode: code,
    weatherSummary: weatherText(code),
    advice: workoutAdvice(current.temperature_2m, current.wind_speed_10m, code)
  };
}

router.get("/", async (req, res) => {
  const recentPlans = await Plan.find().sort({ createdAt: -1 }).limit(5);

  res.render("index", {
    title: "Lift Weather Planner",
    recentPlans,
    error: null,
    formData: {}
  });
});

router.post("/plans", async (req, res) => {
  const { name, email, city, splitType, workoutFocus, notes } = req.body;

  try {
    if (!name || !email || !city || !splitType || !workoutFocus) {
      throw new Error("Please complete every required field.");
    }

    const weather = await getWeather(city);

    const newPlan = new Plan({
      name,
      email,
      city: weather.resolvedCity,
      splitType,
      workoutFocus,
      notes,
      temperature: weather.temperature,
      windSpeed: weather.windSpeed,
      weatherCode: weather.weatherCode,
      weatherSummary: weather.weatherSummary
    });

    await newPlan.save();
    res.redirect(`/plans/${newPlan._id}`);
  } catch (err) {
    const recentPlans = await Plan.find().sort({ createdAt: -1 }).limit(5);

    res.status(400).render("index", {
      title: "Lift Weather Planner",
      recentPlans,
      error: err.message,
      formData: req.body
    });
  }
});

router.get("/plans", async (req, res) => {
  const email = req.query.email ? req.query.email.trim().toLowerCase() : "";
  const filter = email ? { email } : {};
  const plans = await Plan.find(filter).sort({ createdAt: -1 });

  res.render("plans", {
    title: "Saved Plans",
    plans,
    email
  });
});

router.get("/plans/:id", async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);

    if (!plan) {
      return res.status(404).render("error", {
        title: "Plan Not Found",
        message: "The saved plan could not be found."
      });
    }

    const advice = workoutAdvice(plan.temperature, plan.windSpeed, plan.weatherCode);
    res.render("detail", {
      title: "Plan Saved",
      plan,
      advice
    });
  } catch (err) {
    res.status(400).render("error", {
      title: "Invalid Plan",
      message: "The plan link is not valid."
    });
  }
});

router.post("/plans/:id/delete", async (req, res) => {
  try {
    await Plan.findByIdAndDelete(req.params.id);
    res.redirect("/plans");
  } catch (err) {
    res.status(400).render("error", {
      title: "Delete Failed",
      message: "The plan could not be deleted."
    });
  }
});

module.exports = router;
