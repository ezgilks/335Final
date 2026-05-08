const express = require("express");
const Plan = require("../models/Plan");

const router = express.Router();

function weatherText(description) {
  if (!description) {
    return "Weather data available";
  }

  return description;
}

function cleanNumber(value) {
  if (!value) {
    return 0;
  }

  return Number(String(value).replace("+", "").replace("°F", "").trim());
}

function workoutAdvice(temp, wind, description) {
  const lowerDescription = description ? description.toLowerCase() : "";

  if (lowerDescription.includes("rain") || lowerDescription.includes("shower") || lowerDescription.includes("storm")) {
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
  const cleanCity = city.trim();

  const weatherUrl = `https://wttr.in/${encodeURIComponent(cleanCity)}?format=j1`;

  console.log("Weather URL:", weatherUrl);

  const weatherResponse = await fetch(weatherUrl, {
    headers: {
      "User-Agent": "LiftWeatherPlanner/1.0"
    }
  });

  console.log("Weather status:", weatherResponse.status);

  if (!weatherResponse.ok) {
    const weatherErrorText = await weatherResponse.text();
    console.log("Weather API error:", weatherErrorText);
    throw new Error("Could not reach the weather API.");
  }

  const weatherData = await weatherResponse.json();

  if (!weatherData.current_condition || weatherData.current_condition.length === 0) {
    console.log("Unexpected weather data:", weatherData);
    throw new Error("Weather data came back in an unexpected format.");
  }

  const current = weatherData.current_condition[0];
  const area = weatherData.nearest_area && weatherData.nearest_area[0];

  const description =
    current.weatherDesc && current.weatherDesc[0] && current.weatherDesc[0].value
      ? current.weatherDesc[0].value
      : "Weather data available";

  const temp = cleanNumber(current.temp_F);
  const wind = cleanNumber(current.windspeedMiles);

  let resolvedCity = cleanCity;

  if (area) {
    const areaName =
      area.areaName && area.areaName[0] && area.areaName[0].value
        ? area.areaName[0].value
        : cleanCity;

    const region =
      area.region && area.region[0] && area.region[0].value
        ? area.region[0].value
        : "";

    const country =
      area.country && area.country[0] && area.country[0].value
        ? area.country[0].value
        : "";

    resolvedCity = `${areaName}${region ? ", " + region : ""}${country ? ", " + country : ""}`;
  }

  return {
    resolvedCity,
    temperature: temp,
    windSpeed: wind,
    weatherCode: 0,
    weatherSummary: weatherText(description),
    advice: workoutAdvice(temp, wind, description)
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
      name: name.trim(),
      email: email.trim().toLowerCase(),
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

    const advice = workoutAdvice(plan.temperature, plan.windSpeed, plan.weatherSummary);

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