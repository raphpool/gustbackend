import base64
import pygrib
import tempfile
import os
import numpy as np
import json
from scipy.interpolate import griddata
import boto3
import logging
import traceback
import sys
from itertools import islice

# Set up logging
logging.basicConfig(filename='/tmp/direction_map_workflow.log', level=logging.DEBUG, 
                    format='%(asctime)s - %(levelname)s - %(message)s')

def log_exception(e):
    logging.error(f"Exception occurred: {str(e)}")
    logging.error(traceback.format_exc())

def json_to_geojson(json_content):
    try:
        logging.info("Starting json_to_geojson conversion")
        data = json.loads(json_content)
        geojson = {
            "type": "FeatureCollection",
            "features": [  # Change this line
                {
                    "type": "Feature",
                    "properties": {"wind_direction": entry["wind_direction"]},
                    "geometry": {
                        "type": "Point",
                        "coordinates": [entry["lon"], entry["lat"]]
                    }
                }
                for entry in data
            ]  # And this line
        }
        logging.info("json_to_geojson conversion completed")
        return json.dumps(geojson)
    except Exception as e:
        log_exception(e)
        raise

def upload_file_to_s3(bucket_name, key, content):
    try:
        logging.info(f"Attempting to upload file to S3. Bucket: {bucket_name}, Key: {key}")
        s3_client = boto3.client('s3')
        response = s3_client.put_object(
            Bucket=bucket_name,
            Key=key,
            Body=content,
            ContentType='application/json'
        )
        logging.info(f"File uploaded successfully. Response: {response}")
    except Exception as e:
        log_exception(e)
        raise

def grib_to_interpolated_json(base64_encoded_grib):
    try:
        logging.info("Starting grib_to_interpolated_json conversion")
        grib_content = base64.b64decode(base64_encoded_grib)
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.grib') as temp_file:
            temp_file.write(grib_content)
            temp_file_path = temp_file.name
        
        logging.info(f"Temporary GRIB file created: {temp_file_path}")
        
        with pygrib.open(temp_file_path) as grbs:
            ugrd = grbs.select(name='U component of wind')[0]
            vgrd = grbs.select(name='V component of wind')[0]
            
            lats, lons = ugrd.latlons()
            u_data = ugrd.values
            v_data = vgrd.values
        
        logging.info("GRIB data extracted successfully")
        
        os.unlink(temp_file_path)
        logging.info("Temporary GRIB file deleted")
        
        wind_direction = np.arctan2(-u_data, -v_data) * (180 / np.pi)
        wind_direction %= 360
        
        lats_flat = lats.ravel()
        lons_flat = lons.ravel()
        wind_direction_flat = wind_direction.ravel()
        
        lon_min, lon_max = np.min(lons), np.max(lons)
        lat_min, lat_max = np.min(lats), np.max(lats)
        lon_new = np.linspace(lon_min, lon_max, len(np.unique(lons_flat)) * 4)  # Reduced density
        lat_new = np.linspace(lat_min, lat_max, len(np.unique(lats_flat)) * 4)  # Reduced density
        lon_new_mesh, lat_new_mesh = np.meshgrid(lon_new, lat_new)
        
        logging.info("Starting interpolation")
        wind_direction_interpolated = griddata((lons_flat, lats_flat), wind_direction_flat, (lon_new_mesh, lat_new_mesh), method='linear')
        logging.info("Interpolation completed")
        
        def generate_interpolated_data():
            for lon, lat, wd in zip(lon_new_mesh.ravel(), lat_new_mesh.ravel(), wind_direction_interpolated.ravel()):
                if not np.isnan(wd):
                    yield {"lon": float(lon), "lat": float(lat), "wind_direction": float(wd)}
        
        logging.info("Interpolated data prepared")
        return json.dumps(list(generate_interpolated_data()))
    except Exception as e:
        log_exception(e)
        raise

def process_forecast_data(forecast_data):
    try:
        logging.info(f"Starting to process forecast data. Entries: {len(forecast_data)}")
        bucket_name = 'gustlayers'
        
        for i, entry in enumerate(forecast_data):
            logging.info(f"Processing entry {i+1}/{len(forecast_data)}")
            base64_encoded_grib = entry["base64EncodedResponse"]
            timestamp = entry["timestamp"].replace(':', '').replace(' ', '_').replace('-', '_')
            
            json_content = grib_to_interpolated_json(base64_encoded_grib)
            geojson_content = json_to_geojson(json_content)
            
            s3_key = f"geojson/{timestamp}.geojson"
            
            upload_file_to_s3(bucket_name, s3_key, geojson_content)
            logging.info(f"Completed processing entry {i+1}/{len(forecast_data)}")
        
        logging.info("All forecast data processed successfully")
    except Exception as e:
        log_exception(e)
        raise

def process_in_batches(file_path, batch_size=5):
    with open(file_path, 'r') as file:
        data = json.load(file)
        for i in range(0, len(data), batch_size):
            yield data[i:i + batch_size]

if __name__ == "__main__":
    try:
        logging.info("Script started")
        if len(sys.argv) > 1:
            file_path = sys.argv[1]
            for batch in process_in_batches(file_path):
                process_forecast_data(batch)
            logging.info("All batches processed successfully")
        else:
            logging.warning("No input file provided.")
        
        logging.info("Script completed successfully")
    except Exception as e:
        log_exception(e)
        print(f"An error occurred. Check the log file at /tmp/direction_map_workflow.log for details.")
        sys.exit(1)