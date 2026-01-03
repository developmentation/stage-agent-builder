import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, units = "metric" } = await req.json();

    if (!location) {
      throw new Error("location is required");
    }

    // Use Open-Meteo API (free, no API key required)
    // First, geocode the location
    const geoResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`
    );

    if (!geoResponse.ok) {
      throw new Error("Failed to geocode location");
    }

    const geoData = await geoResponse.json();
    
    if (!geoData.results || geoData.results.length === 0) {
      throw new Error(`Location not found: ${location}`);
    }

    const { latitude, longitude, name, country, admin1 } = geoData.results[0];

    // Get weather data
    const temperatureUnit = units === "imperial" ? "fahrenheit" : "celsius";
    const windSpeedUnit = units === "imperial" ? "mph" : "kmh";

    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&temperature_unit=${temperatureUnit}&wind_speed_unit=${windSpeedUnit}&timezone=auto`
    );

    if (!weatherResponse.ok) {
      throw new Error("Failed to fetch weather data");
    }

    const weatherData = await weatherResponse.json();
    const current = weatherData.current;
    const daily = weatherData.daily;

    // Decode weather code to description
    const weatherDescriptions: Record<number, string> = {
      0: "Clear sky",
      1: "Mainly clear",
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
      77: "Snow grains",
      80: "Slight rain showers",
      81: "Moderate rain showers",
      82: "Violent rain showers",
      85: "Slight snow showers",
      86: "Heavy snow showers",
      95: "Thunderstorm",
      96: "Thunderstorm with slight hail",
      99: "Thunderstorm with heavy hail",
    };

    const result = {
      success: true,
      location: {
        name: name,
        region: admin1 || null,
        country: country,
        latitude: latitude,
        longitude: longitude,
      },
      current: {
        temperature: current.temperature_2m,
        feelsLike: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        cloudCover: current.cloud_cover,
        precipitation: current.precipitation,
        windSpeed: current.wind_speed_10m,
        windDirection: current.wind_direction_10m,
        isDay: current.is_day === 1,
        condition: weatherDescriptions[current.weather_code] || "Unknown",
        weatherCode: current.weather_code,
      },
      forecast: daily.time.map((date: string, i: number) => ({
        date: date,
        tempMax: daily.temperature_2m_max[i],
        tempMin: daily.temperature_2m_min[i],
        precipitation: daily.precipitation_sum[i],
        precipitationProbability: daily.precipitation_probability_max[i],
        condition: weatherDescriptions[daily.weather_code[i]] || "Unknown",
      })),
      units: {
        temperature: temperatureUnit === "celsius" ? "°C" : "°F",
        windSpeed: windSpeedUnit === "kmh" ? "km/h" : "mph",
        precipitation: "mm",
      },
      timezone: weatherData.timezone,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Weather handler error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
