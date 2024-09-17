const axios = require('axios');
const { isDaylightSavingTimeParis } = require('./utils');

const WORLD_TIDES_API_KEY = process.env.WORLD_TIDES_API_KEY;

async function getTideData(lat, lon, start) {
  const baseUrl = `https://www.worldtides.info/api/v3?heights&length=1&start=${start}&lat=${lat}&lon=${lon}&key=${WORLD_TIDES_API_KEY}`;
  const response = await axios.get(baseUrl);
  return response.data;
}

async function getTideExtremes(lat, lon, start, end) {
  const baseUrl = `https://www.worldtides.info/api/v3?extremes&start=${start}&end=${end}&lat=${lat}&lon=${lon}&key=${WORLD_TIDES_API_KEY}`;
  const response = await axios.get(baseUrl);
  return response.data;
}

async function getWorldTidesData({ currentSpotId, currentSpotLat, currentSpotLon }, existingForecasts, newForecasts) {
  // Extract the timestamps
  let existingTimestamps = existingForecasts.map(forecast => forecast.fields.timestamp.slice(0, -1));
  let newTimestamps = newForecasts.map(forecast => forecast.timestamp);
  console.log('Existing timestamps:', existingTimestamps);
  console.log('New timestamps:', newTimestamps);

  // Get the timestamps that exist in newForecasts but not in existingForecasts
  let timestampsToFetch = newTimestamps.filter(timestamp => !existingTimestamps.includes(timestamp));
  console.log(`Timestamps to fetch: ${timestampsToFetch}`);
  console.log(`Number of timestamps to fetch: ${timestampsToFetch.length}`);

  // If there are no timestamps to fetch, end the workflow
  if (timestampsToFetch.length === 0) {
    console.log("No new forecasts to fetch tide data for.");
    return [];
  }

  // Convert the timestamps to seconds since the Unix epoch
  let startsToFetch = timestampsToFetch.map(timestamp => {
    let date = new Date(timestamp);
    let dstOffset = isDaylightSavingTimeParis(date) ? 2 : 1;
    date.setUTCHours(date.getUTCHours() - dstOffset);
    return Math.floor(date.getTime() / 1000);
  });

  // Sort the startsToFetch array in ascending order
  startsToFetch.sort((a, b) => a - b);

  let fetchedExtremes = {}; // Object to store the fetched extremes for each day
  let tides = [];

  console.log(`Starting to process ${startsToFetch.length} timestamps`);

  for (let i = 0; i < startsToFetch.length; i++) {
    const start = startsToFetch[i];
    const dayStart = Math.floor(start / 86400) * 86400; // start of the day in Unix time
    const dayEnd = dayStart + 86400; // end of the day in Unix time

    let extremesData;

    // Check if the extremes for the day have already been fetched
    if (fetchedExtremes.hasOwnProperty(dayStart)) {
      extremesData = fetchedExtremes[dayStart];
    } else {
      try {
        extremesData = await getTideExtremes(currentSpotLat, currentSpotLon, dayStart, dayEnd);
        fetchedExtremes[dayStart] = extremesData; // Store the fetched extremes in the object
        console.log(`Fetched extremes: ${JSON.stringify(extremesData.extremes)}`);
      } catch (error) {
        console.error(`API Request failed for spot ${currentSpotId}: ${error.message}`);
        continue;
      }
    }

    // Convert extremes to a format that's easier to work with
    let extremes = extremesData.extremes.map(extreme => {
      let extremeDate = new Date(extreme.dt * 1000);
      if (isDaylightSavingTimeParis(extremeDate)) {
        extremeDate.setUTCHours(extremeDate.getUTCHours() + 2); // UTC+2 for DST
      } else {
        extremeDate.setUTCHours(extremeDate.getUTCHours() + 1); // UTC+1 otherwise
      }
      const extremeHour = extremeDate.getTime() / 1000 / 3600;
      return { type: extreme.type, hour: extremeHour, used: false };
    });

    extremes.sort((a, b) => a.hour - b.hour); // Sort the extremes by hour

    // Filter the extremes for the day to get the lows and highs
    const lows = extremesData.extremes.filter(extreme => extreme.type === "Low");
    const highs = extremesData.extremes.filter(extreme => extreme.type === "High");

    // Find the lowest low tide and the highest high tide for the day
    const lowTideHeight = Math.min(...lows.map(low => low.height));
    const highTideHeight = Math.max(...highs.map(high => high.height));

    // Calculate the mid tide height
    const midTideHeight = (lowTideHeight + highTideHeight) / 2;
    console.log(`Fetching tide data for timestamp ${i + 1}`);
    let tideData;
    try {
      tideData = await getTideData(currentSpotLat, currentSpotLon, start);
      console.log(`Successfully fetched tide data for timestamp ${i + 1}`);
    } catch (error) {
      console.error(`API Request failed for spot ${currentSpotId} at timestamp ${i + 1}: ${error.message}`);
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }
      continue;
    }

    for (let heightInfo of tideData.heights) {
      const localHourString = heightInfo.date.split("T")[1].slice(0, 2);
      const localHour = parseInt(localHourString, 10);

      // Only process tides between 06:00 AM and 10:00 PM
      if (localHour < 4 || localHour > 22) continue;

      const tideDateTime = new Date(heightInfo.dt * 1000);
      const offset = isDaylightSavingTimeParis(tideDateTime) ? 2 : 1;
      tideDateTime.setHours(tideDateTime.getHours() + offset); // Adjust to GMT+1 or GMT+2 based on DST

      // Calculate the absolute differences between the current tide height and the low, mid, and high tide heights
      const lowDiff = Math.abs(heightInfo.height - lowTideHeight);
      const midDiff = Math.abs(heightInfo.height - midTideHeight);
      const highDiff = Math.abs(heightInfo.height - highTideHeight);

      // Determine the tide description based on the smallest difference
      let tideDescription;
      if (lowDiff < midDiff && lowDiff < highDiff) {
        tideDescription = "low";
      } else if (midDiff < lowDiff && midDiff < highDiff) {
        tideDescription = "mid";
      } else {
        tideDescription = "high";
      }

      // Create a tide record
      const tideRecord = {
        timestamp: tideDateTime,
        spotId: currentSpotId,
        tideHeight: heightInfo.height,
        tideDescription: tideDescription,
        extremeHour: null,
        extremeType: null
      };

      // Iterate over the tide records and assign extremes
      let tideHour = Math.floor(new Date(tideRecord.timestamp).getTime() / 1000 / 3600);

      // Find the first extreme that is up to 2 hours after the tide record
      for (let extreme of extremes) {
        if (!extreme.used && extreme.hour >= tideHour && extreme.hour < tideHour + 2) {
          tideRecord.extremeHour = extreme.hour;
          tideRecord.extremeType = extreme.type;
          extreme.used = true;
          break;
        }
      }

      // Convert the extremeHour to HH:MM format
      if (tideRecord.extremeHour !== null) {
        let extremeDate = new Date(tideRecord.extremeHour * 3600 * 1000);
        let extremeHour = extremeDate.getUTCHours();
        let extremeMinute = extremeDate.getUTCMinutes();
        tideRecord.extremeHour = `${extremeHour.toString().padStart(2, '0')}:${extremeMinute.toString().padStart(2, '0')}`;
      }

      tides.push(tideRecord);
    }
    console.log(`Processed ${tideData.heights.length} tide heights for timestamp ${i + 1}`);
  }
  console.log("Tide forecasts:");
  tides.forEach(tide => {
    console.log(`${tide.timestamp.toISOString()} - Height: ${tide.tideHeight}`);
  });
  console.log(`Finished processing. Total tide records: ${tides.length}`);

  return tides;
}

module.exports = { getWorldTidesData };
