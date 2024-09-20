import axios from 'axios';
import dotenv from 'dotenv';
import { getRelativeDirection } from './utils.mjs';

dotenv.config();

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = 'app3mlORKoXMPNhYn';
const TABLE_NAME = 'Forecasts';
const ENDPOINT = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`;

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};

async function processAndUpdateForecasts(spotData, existingForecasts, windForecasts, tideForecasts) {
  const { currentSpotId, currentSpotName, currentSpotHasTides, currentSpotDirection } = spotData;

  console.log(`Processing forecasts for ${currentSpotName} (ID: ${currentSpotId})`);
  console.log(`Number of wind forecasts: ${windForecasts.length}`);
  console.log(`Number of tide forecasts: ${tideForecasts.length}`);

  const outputRecords = [];

  for (const windForecast of windForecasts) {
    // Find the corresponding tide forecast
    const tideForecast = tideForecasts.find(tideForecast => {
      const windTimestamp = new Date(windForecast.timestamp).getTime();
      const tideTimestamp = tideForecast.timestamp.getTime();
      return tideForecast.spotId === currentSpotId && 
             Math.abs(windTimestamp - tideTimestamp) < 60000; // Within 1 minute
    });

    if (tideForecast) {
      console.log(`Matched tide forecast for ${windForecast.timestamp} (Tide: ${tideForecast.timestamp.toISOString()})`);
    } else {
      console.log(`No matching tide forecast for ${windForecast.timestamp}`);
      console.log(`Closest tide forecasts:`);
      tideForecasts.slice(0, 3).forEach(tide => {
        console.log(`  ${tide.timestamp.toISOString()} - Height: ${tide.tideHeight}`);
      });
    }

    // Wind direction check
    let relativeDirection = getRelativeDirection(currentSpotDirection || '', windForecast.windDirection);

    outputRecords.push({
      'timestamp': windForecast.rawTimeStamp,
      'windDirection': windForecast.windDirection,
      'windSpeed': windForecast.windSpeed,
      'windGust': windForecast.windGust,
      'model': windForecast.model,
      'relativeDirection': relativeDirection,
      'windDegrees': windForecast.windDegrees,
      'spotId': currentSpotId,
      'spotName': currentSpotName,
      ...(tideForecast && tideForecast.tideHeight !== null && { 'tideHeight': tideForecast.tideHeight }),
      ...(tideForecast && tideForecast.tideDescription !== null && { 'tideDescription': tideForecast.tideDescription }),
      ...(tideForecast && tideForecast.extremeHour !== null && { 'extremeHour': tideForecast.extremeHour }),
      ...(tideForecast && tideForecast.extremeType !== null && { 'extremeType': tideForecast.extremeType })
    });
  }

  console.log(`Number of output records: ${outputRecords.length}`);

  const toCreate = [];
  const toUpdate = [];

  for (const record of outputRecords) {
    const existingRecord = existingForecasts.find(r => 
      new Date(r.fields.timestamp).toISOString() === new Date(record.timestamp).toISOString() && 
      r.fields.spotId === currentSpotId
    );

    if (existingRecord) {
      toUpdate.push({
        id: existingRecord.id,
        fields: record
      });
    } else {
      toCreate.push({ fields: record });
    }
  }

  const chunk = (arr, size) => 
    arr.reduce((chunks, item, i) => 
      (i % size ? chunks[chunks.length - 1].push(item) : chunks.push([item])) && chunks, []);

  const createChunks = chunk(toCreate, 10);
  const updateChunks = chunk(toUpdate, 10);

  try {
    // Batch update existing records
    for (const updateChunk of updateChunks) {
      await axios.patch(ENDPOINT, { records: updateChunk }, { headers });
    }

    // Batch create new records
    for (const createChunk of createChunks) {
      await axios.post(ENDPOINT, { records: createChunk }, { headers });
    }

    console.log(`Successfully updated/created ${toUpdate.length + toCreate.length} records for ${currentSpotName}`);
  } catch (error) {
    console.error(`Failed to update or create records for ${currentSpotName}. Status code: ${error.response?.status}, Response: ${JSON.stringify(error.response?.data)}`);
    throw new Error(`Failed to update the table for ${currentSpotName}`);
  }

  return outputRecords;
}

export { processAndUpdateForecasts };
