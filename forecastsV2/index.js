require('dotenv').config();
const express = require('express');
const { fetchForecasts } = require('./fetchForecasts');
const { getOpenMeteoData } = require('./getOpenMeteoData');
const { getWorldTidesData } = require('./getWorldTidesData');
const { processAndUpdateForecasts } = require('./processAndUpdateForecasts');
const { updateSpotStatus } = require('./updateSpotStatus');

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

const authenticateApiKey = (req, res, next) => {
  const providedApiKey = req.headers['x-api-key'];
  if (!providedApiKey || providedApiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
  }
  next();
};

async function runForecastWorkflow(spotData) {
  try {
    const existingForecasts = await fetchForecasts(spotData.currentSpotId);
    const newForecasts = await getOpenMeteoData(spotData);
    let tideData = [];
    if (spotData.currentSpotHasTides === "Yes") {
      tideData = await getWorldTidesData(spotData, existingForecasts, newForecasts);
    }
    await processAndUpdateForecasts(spotData, existingForecasts, newForecasts, tideData);
    await updateSpotStatus(spotData.currentSpotRecId, spotData.nextSpotRecId);
    console.log('Forecast workflow completed successfully');
  } catch (error) {
    console.error('Error in forecast workflow:', error);
  }
}

app.post('/webhook', authenticateApiKey, async (req, res) => {
  try {
    const spotData = req.body;
    await runForecastWorkflow(spotData);
    res.status(200).send('Forecast workflow executed successfully');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Error executing forecast workflow');
  }
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});

// Example usage (you'll need to implement a way to get this data, perhaps from Airtable)
// const spotData = {
//   currentSpotId: 'wissant',
//   currentSpotLat: 50.88836200,
//   currentSpotLon: 1.66026600,
//   currentSpotHasTides: 'Yes',
//   currentSpotName: 'Wissant',
//   currentSpotDirection: 'North-west',
//   currentSpotRecId: 'recpP7JQGrA57UqOb',  // Replace with actual Airtable record ID for Wissant
//   nextSpotRecId: 'rechh2JydPOoYk2Hz'
// };

// // Run the workflow every 6 hours
// //setInterval(() => runForecastWorkflow(spotData), 6 * 60 * 60 * 1000);

// // Run immediately on startup
// runForecastWorkflow(spotData);
