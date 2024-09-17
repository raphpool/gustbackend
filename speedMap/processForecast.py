import base64
import pygrib
import tempfile
import os
import pandas as pd
import numpy as np
from io import StringIO
import json
import logging
import traceback
import sys
import boto3

# Set up logging
logging.basicConfig(filename='/tmp/speed_map_workflow.log', level=logging.DEBUG, 
                    format='%(asctime)s - %(levelname)s - %(message)s')

def log_exception(e):
    logging.error(f"Exception occurred: {str(e)}")
    logging.error(traceback.format_exc())

def grib_to_csv(base64_encoded_grib):
    try:
        # Decode the base64-encoded content to binary
        grib_content = base64.b64decode(base64_encoded_grib)
        
        # Create a temporary file to save the GRIB content
        with tempfile.NamedTemporaryFile(delete=False, suffix='.grib') as temp_file:
            temp_file.write(grib_content)
            temp_file_path = temp_file.name
        
        # Use pygrib to open the temporary GRIB file and extract data
        with pygrib.open(temp_file_path) as grbs:
            # Example for U and V components at 10m above ground
            ugrd = grbs.select(name='U component of wind')[0]
            vgrd = grbs.select(name='V component of wind')[0]
            
            # Extract latitude, longitude, and data values
            lats, lons = ugrd.latlons()
            u_data = ugrd.values
            v_data = vgrd.values
            
            # Prepare data for DataFrame
            data = {
                'Latitude': lats.ravel(),
                'Longitude': lons.ravel(),
                'U_component_of_wind': u_data.ravel(),
                'V_component_of_wind': v_data.ravel(),
            }
            df = pd.DataFrame(data)
        
        # Cleanup the temporary GRIB file
        os.unlink(temp_file_path)
        
        # Convert DataFrame to CSV string
        return df.to_csv(index=False)
    except Exception as e:
        log_exception(e)
        raise

def process_csv_and_add_wind_data(csv_content):
    try:
        # Convert CSV content to DataFrame
        df = pd.read_csv(StringIO(csv_content))
        # Calculate wind speed in knots and wind direction in degrees
        df["Wind_speed"] = np.sqrt(df["U_component_of_wind"]**2 + df["V_component_of_wind"]**2) * 1.94384
        df["Wind_direction"] = np.arctan2(-df["U_component_of_wind"], -df["V_component_of_wind"]) * (180 / np.pi)
        df["Wind_direction"] = df["Wind_direction"] % 360  # Normalize direction to 0-360 degrees
        # Convert DataFrame back to CSV
        new_csv_content = df.to_csv(index=False)
        return new_csv_content
    except Exception as e:
        log_exception(e)
        raise

def upload_to_s3(filename, csv_content):
    try:
        bucket_name = 'gustlayers'
        s3_client = boto3.client('s3')
        s3_client.put_object(
            Bucket=bucket_name,
            Key=f"csv/{filename}",
            Body=csv_content,
            ContentType='text/csv'
        )
        logging.info(f"Uploaded {filename} to S3")
    except Exception as e:
        log_exception(e)
        raise

def process_forecast_data(forecast_data):
    merged_csv_contents = []
    for entry in forecast_data:
        base64_encoded_grib = entry["base64EncodedResponse"]
        timestamp = entry["timestamp"].replace(':', '').replace(' ', '_').replace('-', '_')  # Formatting timestamp for filename
        
        # Convert the GRIB content to CSV
        csv_content = grib_to_csv(base64_encoded_grib)
        # Process the CSV content to add wind speed and direction
        processed_csv_content = process_csv_and_add_wind_data(csv_content)
        
        filename = f"{timestamp}.csv"
        
        # Upload to S3
        upload_to_s3(filename, processed_csv_content)
        
        # Append the result along with the timestamp (to be used as filename)
        merged_csv_contents.append({
            "filename": filename,
            "csv_content": processed_csv_content
        })
    return merged_csv_contents

if __name__ == "__main__":
    try:
        logging.info("Script started")
        if len(sys.argv) > 1:
            file_path = sys.argv[1]
            with open(file_path, 'r') as file:
                forecast_data = json.load(file)
            
            result = process_forecast_data(forecast_data)
            print(json.dumps(result))
            
            logging.info("All forecast data processed successfully")
        else:
            logging.warning("No input file provided.")
        
        logging.info("Script completed successfully")
    except Exception as e:
        log_exception(e)
        print(f"An error occurred. Check the log file at /tmp/speed_map_workflow.log for details.")
        sys.exit(1)
