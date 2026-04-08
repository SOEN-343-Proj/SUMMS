import { requestJson } from './api'

const MONTREAL_COORDINATES = {
  latitude: 45.5017,
  longitude: -73.5673,
}

const WEATHER_CODE_LABELS = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm with hail',
}

function getWeatherLabel(weatherCode) {
  return WEATHER_CODE_LABELS[weatherCode] || 'Current conditions'
}

function getWeatherSymbol(weatherCode) {
  if ([0, 1].includes(weatherCode)) {
    return '☀'
  }

  return '☁'
}

export async function fetchMontrealWeather() {
  const query = new URLSearchParams({
    latitude: String(MONTREAL_COORDINATES.latitude),
    longitude: String(MONTREAL_COORDINATES.longitude),
    current: [
      'temperature_2m',
      'apparent_temperature',
      'weather_code',
      'wind_speed_10m',
      'is_day',
    ].join(','),
    timezone: 'America/Toronto',
    wind_speed_unit: 'kmh',
  })

  const response = await requestJson(`https://api.open-meteo.com/v1/forecast?${query.toString()}`)
  const current = response?.current || {}

  return {
    city: 'Montreal',
    temperature: current.temperature_2m,
    feelsLike: current.apparent_temperature,
    windSpeed: current.wind_speed_10m,
    weatherCode: current.weather_code,
    summary: getWeatherLabel(current.weather_code),
    symbol: getWeatherSymbol(current.weather_code),
    isDay: Boolean(current.is_day),
  }
}
