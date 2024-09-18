import fetch from 'node-fetch';
import moment from 'moment-timezone';
import fs from 'fs';

function appendToLog(message) {
  const logFile = '/home/ubuntu/gustbackend-fresh/directionMap/fetch_forecasts.log';
  const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
  fs.appendFileSync(logFile, `${timestamp}: ${message}\n`);
  console.log(message);
}

async function fetchForecastData() {
  appendToLog("Starting fetchForecastData function");

  const baseURL = 'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25_1hr.pl';
  const variables = 'var_UGRD=on&var_VGRD=on&lev_20_m_above_ground=on';
  const subregion = '&subregion=&toplat=51.1&leftlon=-5.3&rightlon=9.6&bottomlat=41.3';
  const cycles = ['00', '06', '12', '18'];
  const parisTimeZone = 'Europe/Paris';
  const maxRequestsPerMinute = 110;
  const optimalTimeoutMs = (60 / maxRequestsPerMinute) * 1000;

  const currentUTCTime = moment.utc();
  let currentCycleIndex = cycles.findIndex(cycle => parseInt(cycle) > currentUTCTime.hour());
  if (currentCycleIndex === -1) currentCycleIndex = 0;
  currentCycleIndex = (currentCycleIndex - 2 + cycles.length) % cycles.length; // Use the cycle before the most recent

  appendToLog(`Current UTC time: ${currentUTCTime.format()}, Using cycle index: ${currentCycleIndex}`);

  const cycle = cycles[currentCycleIndex];
  let cycleDate = moment.utc(currentUTCTime).startOf('day').hour(parseInt(cycle));

  if (currentUTCTime.isBefore(cycleDate)) {
    cycleDate.subtract(1, 'day');
  }

  appendToLog(`Cycle date: ${cycleDate.format()}`);

  async function fetchForTimestamp(forecastHour) {
    const forecastHourStr = `f${forecastHour.toString().padStart(3, '0')}`;
    const forecastDate = cycleDate.clone().add(forecastHour, 'hours');

    const url = `${baseURL}?dir=%2Fgfs.${cycleDate.format('YYYYMMDD')}%2F${cycle}%2Fatmos&file=gfs.t${cycle}z.pgrb2.0p25.${forecastHourStr}&${variables}${subregion}`;

    await new Promise(resolve => setTimeout(resolve, optimalTimeoutMs));

    try {
      appendToLog(`Fetching: ${url}`);
      const forecastResponse = await fetch(url, { follow: 5 });
      if (!forecastResponse.ok) {
        appendToLog(`Fetch failed for URL: ${url} with status: ${forecastResponse.status} ${forecastResponse.statusText}`);
        return null;
      }

      const arrayBuffer = await forecastResponse.arrayBuffer();
      const base64EncodedResponse = Buffer.from(arrayBuffer).toString('base64');

      appendToLog(`Successfully fetched forecast for ${forecastHourStr} (${forecastDate.format('YYYY-MM-DD HH:mm')} Paris Time)`);
      return {
        timestamp: forecastDate.tz(parisTimeZone).format('YYYY-MM-DD HH:mm'),
        cycle: cycle,
        forecastHour: forecastHourStr,
        base64EncodedResponse,
      };
    } catch (error) {
      appendToLog(`Error fetching forecast for ${forecastHourStr}: ${error.message}`);
      return null;
    }
  }

  let responses = [];
  const startDate = moment.tz(cycleDate, parisTimeZone);

  // Fetch data for all 10 days
  for (let day = 0; day < 10; day++) {
    let dayHours;
    if (day < 5) {
      dayHours = [6, 8, 10, 12, 14, 16, 18, 20, 22];
    } else {
      dayHours = Array.from({length: 17}, (_, i) => i + 6); // 6 to 22
    }

    for (const hour of dayHours) {
      const forecastDate = moment(startDate).add(day, 'days').hour(hour).startOf('hour');
      const forecastHour = forecastDate.diff(cycleDate, 'hours');

      const response = await fetchForTimestamp(forecastHour);

      if (response !== null) {
        responses.push(response);
      }
    }
  }

  appendToLog(`Total forecasts fetched: ${responses.length}`);

  // Log a summary of fetched forecasts
  responses.forEach((response, index) => {
    appendToLog(`Forecast ${index + 1}: ${response.timestamp} (Cycle: ${response.cycle}, Hour: ${response.forecastHour})`);
  });

  return responses;
}

// Execute the function and handle the promise
// Execute the function and handle the promise
//fetchForecastData().then((responses) => {
//  appendToLog(`Fetch completed. Total forecasts: ${responses.length}`);
 // responses.forEach(response => {
   // appendToLog(`${response.timestamp}, fetched file ${response.forecastHour}`);
  //});//
//}).catch((error) => {
  //appendToLog(`An error occurred: ${error.message}`);
//});

export { fetchForecastData };
