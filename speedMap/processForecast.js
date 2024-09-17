import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pythonPath = '/home/ubuntu/gustbackend-fresh/venv/bin/python';
const pythonScriptPath = path.join(__dirname, 'processForecast.py');

async function processForecast(forecastData) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('/bin/bash', ['-c', `source /home/ubuntu/gustbackend-fresh/venv/bin/activate && ${pythonPath} ${pythonScriptPath}`]);

    let result = '';
    let error = '';

    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${error}`));
      } else {
        try {
          const parsedResult = JSON.parse(result);
          resolve(parsedResult);
        } catch (parseError) {
          reject(new Error(`Failed to parse Python output: ${parseError.message}`));
        }
      }
    });

    // Write input data to the Python process
    pythonProcess.stdin.write(JSON.stringify(forecastData));
    pythonProcess.stdin.end();
  });
}

export { processForecast };
