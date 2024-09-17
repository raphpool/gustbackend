import { fetchForecastData } from './fetch_forecasts.mjs';
import { exec } from 'child_process';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runDirectionMapWorkflow() {
  try {
    console.log('Starting Direction Map workflow');
    
    // Fetch forecast data
    const forecastData = await fetchForecastData();
    console.log(`Fetched ${forecastData.length} forecasts`);

    // Write forecast data to a temporary file
    const tempFilePath = path.join('/tmp', 'forecast_data.json');
    writeFileSync(tempFilePath, JSON.stringify(forecastData));

    // Define pythonScriptPath
    const pythonScriptPath = path.join(__dirname, 'process_grib.py');

    // Run the Python script
    const pythonCommand = '/home/ubuntu/GUSTBackend/venv/bin/python3';
    exec(`${pythonCommand} ${pythonScriptPath} ${tempFilePath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        return;
      }
      console.log(`Python script output: ${stdout}`);
    });

    console.log('Direction Map workflow completed');
  } catch (error) {
    console.error('Error in Direction Map workflow:', error);
  }
}

// Run the workflow
runDirectionMapWorkflow();
