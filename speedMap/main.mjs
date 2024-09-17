import { fetchForecastData } from './fetchForecastData.mjs';
import { exec } from 'child_process';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runSpeedMapWorkflow() {
  try {
    console.log('Starting Speed Map workflow');
    
    // Fetch forecast data
    const forecastData = await fetchForecastData();
    console.log(`Fetched ${forecastData.length} forecasts`);

    // Write forecast data to a temporary file
    const tempFilePath = path.join('/tmp', 'speed_forecast_data.json');
    writeFileSync(tempFilePath, JSON.stringify(forecastData));

    // Define pythonScriptPath
    const pythonScriptPath = path.join(__dirname, 'processForecast.py');

    // Run the Python script with virtual environment activation
    const command = `bash -c "source /home/ubuntu/gustbackend-fresh/venv/bin/activate && python3 ${pythonScriptPath} ${tempFilePath}"`;
    
    // Increase the maxBuffer size to 1GB
    const maxBuffer = 1024 * 1024 * 1024;

    exec(command, { maxBuffer: maxBuffer }, (error, stdout, stderr) => {
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

    console.log('Speed Map workflow completed');
  } catch (error) {
    console.error('Error in Speed Map workflow:', error);
  }
}

// Run the workflow
runSpeedMapWorkflow();
