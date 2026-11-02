/**
 * Dalkhola Online — Live Environment
 *
 * Displays:
 * - Dalkhola local clock (IST)
 * - Current temperature and weather
 * - Estimated CPCB-scale AQI
 *
 * Data providers:
 * - Open-Meteo Weather API
 * - Open-Meteo Air Quality API
 * - Copernicus CAMS model data
 */

(function () {
    "use strict";

    const LOCATION = {
        latitude: 25.8760,
        longitude: 87.8390,
        timezone: "Asia/Kolkata"
    };

    const WEATHER_REFRESH_MS = 15 * 60 * 1000;
    const AIR_REFRESH_MS = 30 * 60 * 1000;

    const MAX_FETCH_ATTEMPTS = 3;
    const RETRY_DELAYS_MS = [1000, 2500];
    const REQUEST_TIMEOUT_MS = 12000;

    const CACHE_KEYS = {
        weather: "dalkhola-live-weather-v1",
        air: "dalkhola-live-air-v1"
    };

    const weatherDescriptions = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Freezing rain",
        67: "Heavy freezing rain",
        71: "Slight snowfall",
        73: "Moderate snowfall",
        75: "Heavy snowfall",
        77: "Snow grains",
        80: "Rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with hail",
        99: "Severe thunderstorm"
    };

    const aqiCategories = [
        { max: 50, name: "Good" },
        { max: 100, name: "Satisfactory" },
        { max: 200, name: "Moderate" },
        { max: 300, name: "Poor" },
        { max: 400, name: "Very Poor" },
        { max: 500, name: "Severe" }
    ];

    /*
     * CPCB concentration breakpoints.
     * Concentrations are in µg/m³, except CO, which is mg/m³.
     */
    const cpcbBreakpoints = {
        pm2_5: [30, 60, 90, 120, 250],
        pm10: [50, 100, 250, 350, 430],
        nitrogen_dioxide: [40, 80, 180, 280, 400],
        ozone: [50, 100, 168, 208, 748],
        carbon_monoxide: [1, 2, 10, 17, 34],
        sulphur_dioxide: [40, 80, 380, 800, 1600]
    };

    const aqiRanges = [
        [0, 50],
        [51, 100],
        [101, 200],
        [201, 300],
        [301, 400]
    ];

    function getElement(id) {
        return document.getElementById(id);
    }

    function updateText(id, text) {
        const element = getElement(id);

        if (element) {
            element.textContent = text;
        }
    }

    // ----------------------------------------
    // Local cache
    // ----------------------------------------

    function saveCache(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn(
                "Dalkhola environment cache could not be saved:",
                error
            );
        }
    }

    function readCache(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn(
                "Dalkhola environment cache could not be read:",
                error
            );
            return null;
        }
    }

    function formatUpdatedAt(value) {
        const date = new Date(value);

        if (!Number.isFinite(date.getTime())) {
            return "an earlier session";
        }

        return new Intl.DateTimeFormat("en-IN", {
            timeZone: LOCATION.timezone,
            dateStyle: "medium",
            timeStyle: "short"
        }).format(date) + " IST";
    }

    function setReadingTitle(ids, updatedAt, stale) {
        const updatedLabel = formatUpdatedAt(updatedAt);

        const message = stale
            ? `Showing the last successful reading from ${updatedLabel}. Live refresh is temporarily unavailable.`
            : `Last successful update: ${updatedLabel}.`;

        ids.forEach(id => {
            const element = getElement(id);

            if (element) {
                element.title = message;
            }
        });
    }

    function restoreCachedReadings() {
        const weather = readCache(CACHE_KEYS.weather);

        if (
            weather &&
            weather.temperatureText &&
            weather.conditionText
        ) {
            updateText("live-temp", weather.temperatureText);
            updateText("live-condition", weather.conditionText);

            setReadingTitle(
                ["live-temp", "live-condition"],
                weather.updatedAt,
                true
            );
        }

        const air = readCache(CACHE_KEYS.air);

        if (air && air.text) {
            updateText("live-aqi", air.text);

            setReadingTitle(
                ["live-aqi"],
                air.updatedAt,
                true
            );
        }
    }

    // ----------------------------------------
    // Live clock
    // ----------------------------------------

    function updateClock() {
        const now = new Date();

        const time = new Intl.DateTimeFormat("en-IN", {
            timeZone: LOCATION.timezone,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        }).format(now);

        updateText("live-clock", `🕒 ${time} IST`);
    }

    // ----------------------------------------
    // API request with retry and timeout
    // ----------------------------------------

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function fetchJSON(url, options = {}) {
        let lastError;

        for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
            let timeoutId;

            try {
                const controller = new AbortController();

                timeoutId = setTimeout(
                    () => controller.abort(),
                    REQUEST_TIMEOUT_MS
                );

                const response = await fetch(url, {
                    method: "GET",
                    signal: controller.signal
                });

                if (!response.ok) {
                    const error = new Error(
                        `Request failed: HTTP ${response.status}`
                    );

                    error.status = response.status;
                    error.retryable = [
                        408, 429, 500, 502, 503, 504
                    ].includes(response.status);

                    throw error;
                }

                const data = await response.json();

                if (data.error) {
                    const error = new Error(
                        data.reason || "Data provider error"
                    );

                    error.retryable = true;
                    throw error;
                }

                return options.withResponse
                    ? { data, response }
                    : data;

            } catch (error) {
                lastError = error;

                const networkError =
                    error instanceof TypeError ||
                    error.name === "AbortError";

                const canRetry =
                    error.retryable === true ||
                    networkError;

                if (!canRetry || attempt === MAX_FETCH_ATTEMPTS) {
                    throw error;
                }

                const delay = RETRY_DELAYS_MS[attempt - 1] || 3000;

                console.warn(
                    `Request failed. Retrying in ${delay}ms`,
                    error.message
                );

                await wait(delay);

            } finally {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
            }
        }

        throw lastError || new Error("Request failed");
    }

    function describeMETSymbol(symbol) {
        if (!symbol) return "Forecast conditions";

        const descriptions = {
            clearsky: "Clear sky",
            fair: "Mainly clear",
            partlycloudy: "Partly cloudy",
            cloudy: "Cloudy",
            fog: "Fog",
            lightrain: "Light rain",
            rain: "Rain",
            heavyrain: "Heavy rain",
            rainshowers: "Rain showers",
            lightrainshowers: "Light rain showers",
            heavyrainshowers: "Heavy rain showers",
            lightsleet: "Light sleet",
            sleet: "Sleet",
            heavysleet: "Heavy sleet",
            lightsnow: "Light snow",
            snow: "Snow",
            heavysnow: "Heavy snow",
            snowshowers: "Snow showers",
            thunderstorm: "Thunderstorm"
        };

        const base = symbol.replace(
            /_(day|night|polartwilight)$/i,
            ""
        );

        if (descriptions[base]) {
            return descriptions[base];
        }

        for (const [key, description] of Object.entries(descriptions)) {
            if (base.includes(key)) return description;
        }

        return "Weather forecast";
    }


    async function getMETNorwayWeather() {
        const params = new URLSearchParams({
            lat: LOCATION.latitude.toFixed(4),
            lon: LOCATION.longitude.toFixed(4)
        });

        const url =
            `https://api.met.no/weatherapi/locationforecast/2.0/compact?${params}`;

        const result = await fetchJSON(url, {
            withResponse: true
        });

        const timeseries =
            result.data.properties?.timeseries;

        if (!Array.isArray(timeseries) || !timeseries.length) {
            throw new Error("MET Norway returned no forecast data");
        }

        const current = timeseries[0].data;

        const temperature =
            current?.instant?.details?.air_temperature;

        const symbol =
            current?.next_1_hours?.summary?.symbol_code ||
            current?.next_6_hours?.summary?.symbol_code ||
            current?.next_12_hours?.summary?.symbol_code;

        if (!Number.isFinite(temperature)) {
            throw new Error("MET Norway temperature unavailable");
        }

        // Respect the provider's cache lifetime where available.
        const cacheControl =
            result.response.headers.get("Cache-Control") || "";

        const expiresHeader =
            result.response.headers.get("Expires");

        const maxAgeMatch =
            cacheControl.match(/max-age=(\d+)/i);

        const expiresAt = expiresHeader
            ? Date.parse(expiresHeader)
            : maxAgeMatch
                ? Date.now() + Number(maxAgeMatch[1]) * 1000
                : Date.now() + 30 * 60 * 1000;

        return {
            temperatureText: `🌡️ ${Math.round(temperature)}°C`,
            conditionText: `☁️ ${describeMETSymbol(symbol)}`,
            updatedAt: new Date().toISOString(),
            source: "MET Norway",
            expiresAt
        };
    }

    // ----------------------------------------
    // Weather
    // ----------------------------------------

   async function updateWeather() {

    // First try Open-Meteo.
    try {
        const params = new URLSearchParams({
            latitude: LOCATION.latitude,
            longitude: LOCATION.longitude,
            current: "temperature_2m,weather_code",
            timezone: LOCATION.timezone,
            forecast_days: "1"
        });

        const url =
            `https://api.open-meteo.com/v1/forecast?${params}`;

        const data = await fetchJSON(url);

        if (
            !data.current ||
            !Number.isFinite(data.current.temperature_2m) ||
            !Number.isFinite(data.current.weather_code)
        ) {
            throw new Error("Invalid Open-Meteo response");
        }

        const code = data.current.weather_code;

        const reading = {
            temperatureText:
                `🌡️ ${Math.round(data.current.temperature_2m)}°C`,

            conditionText:
                `☁️ ${weatherDescriptions[code] || "Conditions unavailable"}`,

            updatedAt: new Date().toISOString(),
            source: "Open-Meteo",
            expiresAt: 0
        };

        saveCache(CACHE_KEYS.weather, reading);
        showWeatherReading(reading, false);

        return;

    } catch (error) {
        console.warn(
            "Open-Meteo unavailable. Trying MET Norway.",
            error.message
        );
    }

    // Reuse a still-valid MET Norway reading if available.
    const cached = readCache(CACHE_KEYS.weather);

    if (
        cached &&
        cached.source === "MET Norway" &&
        cached.expiresAt &&
        Date.now() < cached.expiresAt
    ) {
        showWeatherReading(cached, true);
        return;
    }

    // Try the fallback provider.
    try {
        const reading = await getMETNorwayWeather();

        saveCache(CACHE_KEYS.weather, reading);
        showWeatherReading(reading, false);

    } catch (error) {
        console.error(
            "Both weather providers failed:",
            error
        );

        // Keep the last successful reading.
        const lastReading = readCache(CACHE_KEYS.weather);

        if (
            lastReading &&
            lastReading.temperatureText &&
            lastReading.conditionText
        ) {
            showWeatherReading(lastReading, true);

        } else {
            updateText(
                "live-temp",
                "🌡️ Weather temporarily unavailable"
            );

            updateText(
                "live-condition",
                "Weather temporarily unavailable"
            );
        }
    }
}
    // ----------------------------------------
    // AQI calculation
    // ----------------------------------------

    function getAverage(hourly, pollutant, hours, now) {
        const values = hourly[pollutant];
        const times = hourly.time;

        if (
            !Array.isArray(values) ||
            !Array.isArray(times)
        ) {
            return null;
        }

        const cutoff =
            now.getTime() - hours * 60 * 60 * 1000;

        const recentValues = [];

        for (let i = 0; i < times.length; i++) {
            const timestamp = Date.parse(times[i]);
            const value = values[i];

            if (
                Number.isFinite(timestamp) &&
                timestamp >= cutoff &&
                timestamp <= now.getTime() &&
                Number.isFinite(value)
            ) {
                recentValues.push(value);
            }
        }

        // Minimum observations required for averaging.
        const minimumSamples =
            hours === 24 ? 16 : 6;

        if (recentValues.length < minimumSamples) {
            return null;
        }

        return recentValues.reduce(
            (sum, value) => sum + value,
            0
        ) / recentValues.length;
    }

    function calculateSubIndex(concentration, pollutant) {
        if (
            !Number.isFinite(concentration) ||
            concentration < 0
        ) {
            return null;
        }

        const breakpoints =
            cpcbBreakpoints[pollutant];

        if (!breakpoints) {
            return null;
        }

        for (let i = 0; i < breakpoints.length; i++) {
            const concentrationLow =
                i === 0 ? 0 : breakpoints[i - 1];

            const concentrationHigh =
                breakpoints[i];

            if (concentration <= concentrationHigh) {
                const [indexLow, indexHigh] =
                    aqiRanges[i];

                const index =
                    ((indexHigh - indexLow) /
                        (concentrationHigh - concentrationLow)) *
                    (concentration - concentrationLow) +
                    indexLow;

                return Math.round(index);
            }
        }

        return 401;
    }

    function getAQICategory(aqi) {
        return (
            aqiCategories.find(
                category => aqi <= category.max
            ) ||
            aqiCategories[aqiCategories.length - 1]
        );
    }

    function calculateCPCBAQI(hourly) {
        const now = new Date();
        const subIndices = [];

        const pollutants = [
            { id: "pm2_5", hours: 24, divisor: 1 },
            { id: "pm10", hours: 24, divisor: 1 },
            { id: "nitrogen_dioxide", hours: 24, divisor: 1 },
            { id: "sulphur_dioxide", hours: 24, divisor: 1 },
            { id: "ozone", hours: 8, divisor: 1 },
            { id: "carbon_monoxide", hours: 8, divisor: 1000 }
        ];

        for (const pollutant of pollutants) {
            const average = getAverage(
                hourly,
                pollutant.id,
                pollutant.hours,
                now
            );

            if (average === null) {
                continue;
            }

            const concentration =
                average / pollutant.divisor;

            const subIndex = calculateSubIndex(
                concentration,
                pollutant.id
            );

            if (subIndex !== null) {
                subIndices.push({
                    pollutant: pollutant.id,
                    value: subIndex
                });
            }
        }

        const hasParticulateData = subIndices.some(
            item =>
                item.pollutant === "pm2_5" ||
                item.pollutant === "pm10"
        );

        if (
            subIndices.length < 3 ||
            !hasParticulateData
        ) {
            throw new Error(
                "Insufficient pollutant data for CPCB AQI"
            );
        }

        return Math.max(
            ...subIndices.map(item => item.value)
        );
    }

    // ----------------------------------------
    // Air quality
    // ----------------------------------------

    async function updateAirQuality() {
        const params = new URLSearchParams({
            latitude: LOCATION.latitude,
            longitude: LOCATION.longitude,

            hourly: [
                "pm2_5",
                "pm10",
                "carbon_monoxide",
                "nitrogen_dioxide",
                "sulphur_dioxide",
                "ozone"
            ].join(","),

            past_hours: "24",
            forecast_hours: "1",
            timezone: "UTC"
        });

        const url =
            `https://air-quality-api.open-meteo.com/v1/air-quality?${params}`;

        const element = getElement("live-aqi");

        if (element) {
            element.title =
                "Modelled estimate calculated using CPCB breakpoints. " +
                "Not an official CPCB monitoring-station reading.";
        }

        try {
            const data = await fetchJSON(url);

            if (!data.hourly) {
                throw new Error(
                    "Hourly air-quality data unavailable"
                );
            }

            const aqi =
                calculateCPCBAQI(data.hourly);

            const category =
                getAQICategory(aqi);

            const displayedAQI =
                aqi >= 401 ? "401+" : aqi;

            const reading = {
                text:
                    `🌫️ AQI ${displayedAQI} · ${category.name}`,

                updatedAt:
                    new Date().toISOString()
            };

            updateText(
                "live-aqi",
                reading.text
            );

            saveCache(
                CACHE_KEYS.air,
                reading
            );

            setReadingTitle(
                ["live-aqi"],
                reading.updatedAt,
                false
            );

        } catch (error) {
            console.error(
                "Dalkhola AQI update failed:",
                error
            );

            const cached =
                readCache(CACHE_KEYS.air);

            if (cached && cached.text) {
                updateText(
                    "live-aqi",
                    cached.text
                );

                setReadingTitle(
                    ["live-aqi"],
                    cached.updatedAt,
                    true
                );

            } else {
                updateText(
                    "live-aqi",
                    "🌫️ Air quality temporarily unavailable"
                );
            }
        }
    }

    // ----------------------------------------
    // Attribution
    // ----------------------------------------

    function addAttribution() {
        const tags =
            document.querySelector(".tags");

        if (
            !tags ||
            document.getElementById(
                "environment-attribution"
            )
        ) {
            return;
        }

        const attribution =
            document.createElement("small");

        attribution.id =
            "environment-attribution";

        attribution.className =
            "environment-attribution";

        attribution.textContent =
            "Weather and air-quality estimates: Open-Meteo / " +
            "Copernicus CAMS. AQI is modelled, not an official " +
            "CPCB station reading.";

        tags.insertAdjacentElement(
            "afterend",
            attribution
        );
    }

    // ----------------------------------------
    // Initialization
    // ----------------------------------------

    function init() {
        restoreCachedReadings();

        updateClock();
        updateWeather();
        updateAirQuality();

        addAttribution();

        setInterval(
            updateClock,
            1000
        );

        setInterval(
            updateWeather,
            WEATHER_REFRESH_MS
        );

        setInterval(
            updateAirQuality,
            AIR_REFRESH_MS
        );
    }

    init();

})();