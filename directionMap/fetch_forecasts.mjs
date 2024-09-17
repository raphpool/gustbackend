import fetch from 'node-fetch';
import moment from 'moment-timezone';

async function fetchForecastData() {
  const baseURL = 'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25_1hr.pl';
  const variables = 'var_UGRD=on&var_VGRD=on&lev_20_m_above_ground=on';
  const subregion = '&subregion=&toplat=51.1&leftlon=-5.3&rightlon=9.6&bottomlat=41.3';
  let responses = [];
  const cycles = ['00', '06', '12', '18'];
  const parisTimeZone = 'Europe/Paris';
  const dateStr = moment.utc().format('YYYYMMDD');

  const maxRequestsPerMinute = 110;
  const optimalTimeoutMs = (60 / maxRequestsPerMinute) * 1000;

  const currentUTCHour = moment.utc().hour();
  const currentCycle = cycles.slice().reverse().find(cycle => parseInt(cycle) <= currentUTCHour);

  // Generate forecast hour strings according to the new rules
  const forecastHours = [];
  for (let i = 1; i <= 119; i += 2) {
    forecastHours.push(`f${i.toString().padStart(3, '0')}`);
  }

  for (const forecastHourStr of forecastHours) {
    const forecastHour = parseInt(forecastHourStr.substring(1)); // Extract hour number from string
    const forecastDate = moment.utc(`${dateStr} ${currentCycle}`, "YYYYMMDD HH").add(forecastHour, 'hours');
    const forecastParisTime = forecastDate.clone().tz(parisTimeZone);
    const parisHour = forecastParisTime.hour();
    
    // Filter out all timestamps not between 06 and 22 Paris time
    if (parisHour < 6 || parisHour > 22) {
      continue;
    }

    const url = `${baseURL}?dir=%2Fgfs.${dateStr}%2F${currentCycle}%2Fatmos&file=gfs.t${currentCycle}z.pgrb2.0p25.${forecastHourStr}&${variables}${subregion}`;

    await new Promise(resolve => setTimeout(resolve, optimalTimeoutMs));

    try {
      const forecastResponse = await fetch(url);
      if (!forecastResponse.ok) {
        console.log(`Fetch failed for URL: ${url} with status: ${forecastResponse.statusText}`);
        continue;
      }

      const buffer = await forecastResponse.buffer();
      const base64EncodedResponse = buffer.toString('base64');
          
      responses.push({
        timestamp: `${forecastParisTime.format('YYYY-MM-DD HH:mm')} Paris Time`,
        cycle: currentCycle,
        forecastHour: forecastHourStr,
        base64EncodedResponse,
      });
    } catch (error) {
      console.error(`Error fetching forecast for ${forecastHourStr}:`, error);
    }
  }
  return responses;
}

// Export the function to be used in other parts of your application
export { fetchForecastData };

// If you want to run this script directly (for testing purposes), you can uncomment the following:
/*
fetchForecastData().then(responses => {
  console.log('Fetched forecasts:', responses.length);
}).catch(error => {
  console.error("Error fetching forecast data:", error);
});
*/
