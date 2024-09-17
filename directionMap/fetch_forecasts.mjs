import fetch from 'node-fetch';
import moment from 'moment-timezone';

async function fetchForecastData() {
  const baseURL = 'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25_1hr.pl';
  const variables = 'var_UGRD=on&var_VGRD=on&lev_20_m_above_ground=on';
  const subregion = '&subregion=&toplat=51.1&leftlon=-5.3&rightlon=9.6&bottomlat=41.3';
  const cycles = ['00', '06', '12', '18'];
  const parisTimeZone = 'Europe/Paris';
  const dateStr = moment.utc().format('YYYYMMDD');

  const maxRequestsPerMinute = 110;
  const optimalTimeoutMs = (60 / maxRequestsPerMinute) * 1000;

  const currentUTCHour = moment.utc().hour();
  let currentCycleIndex = cycles.findIndex(cycle => parseInt(cycle) > currentUTCHour);
  if (currentCycleIndex === -1) currentCycleIndex = 0;
  currentCycleIndex = (currentCycleIndex - 1 + cycles.length) % cycles.length;

  const forecastHours = Array.from({length: 60}, (_, i) => `f${(i * 2 + 1).toString().padStart(3, '0')}`);

  async function attemptFetch(cycleIndex) {
    const cycle = cycles[cycleIndex];
    console.log(`Attempting to fetch forecasts for cycle: ${cycle}`);
    let responses = [];

    for (const forecastHourStr of forecastHours) {
      const forecastHour = parseInt(forecastHourStr.substring(1));
      const forecastDate = moment.utc(`${dateStr} ${cycle}`, "YYYYMMDD HH").add(forecastHour, 'hours');
      const forecastParisTime = forecastDate.clone().tz(parisTimeZone);
      const parisHour = forecastParisTime.hour();
      
      if (parisHour < 6 || parisHour > 22) continue;

      const url = `${baseURL}?dir=%2Fgfs.${dateStr}%2F${cycle}%2Fatmos&file=gfs.t${cycle}z.pgrb2.0p25.${forecastHourStr}&${variables}${subregion}`;

      await new Promise(resolve => setTimeout(resolve, optimalTimeoutMs));

      try {
        console.log(`Fetching: ${url}`);
        const forecastResponse = await fetch(url);
        if (!forecastResponse.ok) {
          console.log(`Fetch failed for URL: ${url} with status: ${forecastResponse.statusText}`);
          continue;
        }

        const arrayBuffer = await forecastResponse.arrayBuffer();
        const base64EncodedResponse = Buffer.from(arrayBuffer).toString('base64');
            
        responses.push({
          timestamp: `${forecastParisTime.format('YYYY-MM-DD HH:mm')} Paris Time`,
          cycle: cycle,
          forecastHour: forecastHourStr,
          base64EncodedResponse,
        });
        console.log(`Successfully fetched forecast for ${forecastHourStr}`);
      } catch (error) {
        console.error(`Error fetching forecast for ${forecastHourStr}:`, error);
      }
    }
    return responses;
  }

  let responses = await attemptFetch(currentCycleIndex);
  
  if (responses.length === 0 && currentCycleIndex > 0) {
    console.log("No forecasts found for current cycle. Trying previous cycle.");
    currentCycleIndex = (currentCycleIndex - 1 + cycles.length) % cycles.length;
    responses = await attemptFetch(currentCycleIndex);
  }

  console.log(`Total forecasts fetched: ${responses.length}`);
  return responses;
}

export { fetchForecastData };
