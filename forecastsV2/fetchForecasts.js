const axios = require('axios');

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = 'app3mlORKoXMPNhYn';
const TABLE_NAME = 'Forecasts';
const ENDPOINT = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`;

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};

async function fetchForecasts(currentSpotId) {
  let allRecords = [];
  let offset = null;

  while (true) {
    let params = {
      filterByFormula: `{spotId} = "${currentSpotId}"`
    };
    if (offset) {
      params.offset = offset;
    }
    try {
      const response = await axios.get(ENDPOINT, { headers, params });
      const data = response.data;
      allRecords = allRecords.concat(data.records);
      offset = data.offset;
      if (!offset) break;
    } catch (error) {
      console.error(`Failed to retrieve records. Status code: ${error.response?.status}, Response: ${JSON.stringify(error.response?.data)}`);
      break;
    }
  }
  return allRecords;
}

module.exports = { fetchForecasts };
