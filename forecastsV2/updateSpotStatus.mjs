import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = 'app3mlORKoXMPNhYn';
const TABLE_NAME = 'SpotCharacteristics';
const ENDPOINT = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`;

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};

async function updateSpotStatus(currentSpotRecId, nextSpotRecId) {
  try {
    await axios.patch(ENDPOINT, {
      records: [
        { id: currentSpotRecId, fields: { "forecastStatus": "Processed" } },
        { id: nextSpotRecId, fields: { "forecastStatus": "Next" } }
      ]
    }, { headers });
    console.log("Successfully updated the table.");
  } catch (error) {
    console.error(`Failed to update records. Status code: ${error.response?.status}, Response: ${JSON.stringify(error.response?.data)}`);
    throw error;
  }
}

export { updateSpotStatus };
