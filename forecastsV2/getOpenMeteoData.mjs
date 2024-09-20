import axios from 'axios';
import { isWithinTimeRange, getWindDirection } from './utils.mjs';

const modelDetails = [
  { name: 'meteofrance_arome_france_hd', start: 0, end: 32 },
  { name: 'meteofrance_arpege_europe', start: 32, end: 80 },
  { name: 'gfs_seamless', start: 80, end: 336 }
];

async function fetchData(lat, lon, model) {
  const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude: lat,
      longitude: lon,
      forecast_days: 14,
      hourly: "windspeed_10m,winddirection_10m,windgusts_10m",
      windspeed_unit: "kn",
      models: model,
      timezone: "Europe/Berlin"
    }
  });
  return response.data;
}

async function getOpenMeteoData({ currentSpotId, currentSpotLat, currentSpotLon }) {
  let forecasts = [];
  for (const modelDetail of modelDetails) {
    try {
      const data = await fetchData(currentSpotLat, currentSpotLon, modelDetail.name);
      const now = new Date();
      for (let i = 0; i < data.hourly.time.length; i++) {
        const rawTimeStamp = data.hourly.time[i];
        const timestamp = new Date(rawTimeStamp).toISOString().slice(0, -1);
        const hoursElapsed = (new Date(timestamp) - now) / 3600000;
        if (!isWithinTimeRange(rawTimeStamp, modelDetail.name, hoursElapsed)) continue;
        if (hoursElapsed < modelDetail.start || hoursElapsed >= modelDetail.end) continue;
        
        forecasts.push({
          'timestamp': timestamp,
          'spotId': currentSpotId,
          'windSpeed': Math.round(data.hourly.windspeed_10m[i]),
          'windGust': Math.round(data.hourly.windgusts_10m[i]),
          'windDirection': getWindDirection(data.hourly.winddirection_10m[i]),
          'rawTimeStamp': rawTimeStamp,
          'model': modelDetail.name,
          'windDegrees': data.hourly.winddirection_10m[i]
        });
      }
    } catch (error) {
      console.error(`Error from API for spot ${currentSpotId}: ${error.message}`);
      if (error.response && error.response.data) {
        console.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }
    }
  }
  return forecasts;
}

export { getOpenMeteoData };
