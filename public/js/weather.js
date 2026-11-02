// Dalkhola Coordinates: 25.8554° N, 87.8504° E
const LATITUDE = 25.8554;
const LONGITUDE = 87.8504;

// 1. Live Local Time Clock (IST / Asia/Kolkata)
function startLiveClock() {
  const clockElement = document.getElementById("live-clock");
  if (!clockElement) return;

  function updateTime() {
    const now = new Date();
    const timeOptions = {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    };
    const dateOptions = {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "numeric",
      month: "short"
    };

    const timeStr = now.toLocaleTimeString("en-IN", timeOptions);
    const dateStr = now.toLocaleDateString("en-IN", dateOptions);

    clockElement.innerHTML = `🕒 <strong>${timeStr}</strong> <span style="opacity:0.85">(${dateStr})</span>`;
  }

  updateTime();
  setInterval(updateTime, 1000);
}

// 2. Map WMO Weather Codes to Emojis & Descriptions
function getWeatherCondition(code) {
  const weatherMap = {
    0: { text: "Clear Sky", icon: "☀️" },
    1: { text: "Mainly Clear", icon: "🌤️" },
    2: { text: "Partly Cloudy", icon: "⛅" },
    3: { text: "Overcast", icon: "☁️" },
    45: { text: "Foggy", icon: "🌫️" },
    48: { text: "Depositing Rime Fog", icon: "🌫️" },
    51: { text: "Light Drizzle", icon: "🌦️" },
    53: { text: "Drizzle", icon: "🌧️" },
    61: { text: "Slight Rain", icon: "🌧️" },
    63: { text: "Moderate Rain", icon: "🌧️" },
    65: { text: "Heavy Rain", icon: "🌧️" },
    80: { text: "Rain Showers", icon: "🌦️" },
    95: { text: "Thunderstorm", icon: "⛈️" }
  };
  return weatherMap[code] || { text: "Weather Updated", icon: "🌡️" };
}

// 3. Fetch Real-Time Weather from Open-Meteo API
async function fetchLiveWeather() {
  const tempElement = document.getElementById("live-temp");
  const condElement = document.getElementById("live-condition");
  if (!tempElement || !condElement) return;

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia%2FKolkata`
    );
    const data = await response.json();

    const current = data.current;
    const temp = Math.round(current.temperature_2m);
    const humidity = current.relative_humidity_2m;
    const wind = current.wind_speed_10m;
    const condition = getWeatherCondition(current.weather_code);

    tempElement.innerHTML = `${condition.icon} <strong>${temp}°C</strong>`;
    condElement.innerHTML = `${condition.text} • 💧 ${humidity}% • 💨 ${wind} km/h`;
  } catch (error) {
    console.error("Failed to load weather data:", error);
    tempElement.innerText = "🌡️ --°C";
    condElement.innerText = "Weather unavailable";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  startLiveClock();
  fetchLiveWeather();
});