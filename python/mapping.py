# OASIS Star System Dataset Generator

import pandas as pd
import requests
from pathlib import Path
import os
import gspread
import json
import numpy as np
from google.oauth2.service_account import Credentials
from dotenv import load_dotenv
from datetime import datetime, timedelta

# Load environment variables
load_dotenv()

class NumpyJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle numpy and pandas data types"""
    def default(self, obj):
        if isinstance(obj, (np.integer, np.floating)):
            return int(obj) if isinstance(obj, np.integer) else float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif pd.isna(obj):
            return None
        return super().default(obj)

def clean_data_for_json(data):
    """Clean data to ensure it's JSON serializable"""
    if isinstance(data, dict):
        return {k: clean_data_for_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_data_for_json(item) for item in data]
    elif isinstance(data, (pd.DataFrame, pd.Series)):
        return clean_data_for_json(data.to_dict())
    elif pd.isna(data) or isinstance(data, float) and np.isnan(data):
        return None
    elif isinstance(data, (np.integer, np.floating)):
        return int(data) if isinstance(data, np.integer) else float(data)
    elif isinstance(data, np.ndarray):
        return data.tolist()
    return data

def init_google_sheets():
    """Initialize Google Sheets client"""
    scope = [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.readonly'
    ]
    
    creds = {
        "type": "service_account",
        "project_id": "inlaid-keyword-463222",
        "private_key": os.getenv("GOOGLE_PRIVATE_KEY").replace("\\n", "\n"),
        "client_email": os.getenv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
        "token_uri": "https://oauth2.googleapis.com/token",
    }
    
    credentials = Credentials.from_service_account_info(creds, scopes=scope)
    return gspread.authorize(credentials)

def clean_column_name(col):
    """Clean column names to be valid JSON keys"""
    # Remove any trailing colons or spaces
    col = col.strip().rstrip(':').rstrip()
    # Convert to lowercase and replace spaces with underscores
    col = col.lower().replace(' ', '_')
    # Remove any invalid characters
    col = ''.join(c for c in col if c.isalnum() or c == '_')
    return col

def clean_value(val):
    """Clean values to be valid JSON values"""
    if isinstance(val, str):
        val = val.strip()
        # Convert string booleans to actual booleans
        if val.upper() == 'TRUE':
            return True
        elif val.upper() == 'FALSE':
            return False
        # Try to convert to number if possible
        try:
            if '.' in val:
                return float(val)
            else:
                return int(val)
        except ValueError:
            return val
    return val

def fetch_and_save_sheets():
    """Fetch data from all sheets and save each to its own JSON file"""
    client = init_google_sheets()
    spreadsheet_id = os.getenv("GOOGLE_SHEETS_ID")
    spreadsheet = client.open_by_key(spreadsheet_id)
    
    # Create data directory if it doesn't exist
    data_dir = Path(os.path.abspath("../data"))
    sheets_dir = data_dir / "sheets"
    sheets_dir.mkdir(exist_ok=True, parents=True)
    
    # List of sheets to fetch
    sheets_to_fetch = ['SETUP', 'Admin-Manifest', 'ROUTE', 'FC-Manifest', 'Hauler-Manifest']
    
    print("\nFetching and saving Google Sheets data...")
    for sheet_name in sheets_to_fetch:
        try:
            worksheet = spreadsheet.worksheet(sheet_name)
            data = worksheet.get_all_records()
            
            # Clean the data
            cleaned_data = []
            for row in data:
                # Remove empty rows
                if any(row.values()):
                    # Clean column names and values
                    cleaned_row = {
                        clean_column_name(k): clean_value(v)
                        for k, v in row.items()
                        if k.strip() and not pd.isna(v)
                    }
                    if cleaned_row:  # Only add if we have data after cleaning
                        cleaned_data.append(clean_data_for_json(cleaned_row))
            
            # Save to JSON
            output_file = sheets_dir / f"{sheet_name.lower()}.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(cleaned_data, f, indent=2, cls=NumpyJSONEncoder)
            print(f"✓ Saved {sheet_name}: {len(cleaned_data)} rows to {output_file}")
            
        except Exception as e:
            print(f"❌ Error fetching {sheet_name}: {e}")
    
    print("\n💾 All sheets have been saved to individual JSON files in data/sheets/")

def get_coords(system_name):
    """Get x, y, z coordinates from EDSM"""
    url = "https://www.edsm.net/api-v1/system"
    params = {
        "systemName": system_name,
        "showCoordinates": 1
    }
    response = requests.get(url, params=params)
    if response.status_code != 200:
        raise Exception(f"EDSM error: {response.status_code} - {response.text}")
    
    data = response.json()
    if "coords" in data:
        coords = data["coords"]
        return coords["x"], coords["y"], coords["z"]
    else:
        raise ValueError(f"No coordinates found for system '{system_name}'")

def fetch_systems_near_coords(x, y, z, radius=100, system_name=""):
    """Fetch systems within radius of given coordinates"""
    url = "https://www.edsm.net/api-v1/sphere-systems"
    params = {
        "x": x,
        "y": y,
        "z": z,
        "radius": radius,
        "limit": 10000,
        "showCoordinates": 1,
        "showPermit": 1,
        "showId": 1,
        "showAllegiance": 1,
        "showGovernment": 1,
        "showInformation": 1,
        "showPrimaryStar": 1
    }

    print(f"→ Fetching systems near {system_name}...")
    response = requests.get(url, params=params)
    print(f"→ Status Code: {response.status_code}")

    try:
        systems = response.json()
    except Exception as e:
        print(f"❌ Failed to parse JSON for {system_name}:", e)
        return pd.DataFrame()

    print(f"✓ Found {len(systems)} systems within {radius}ly of {system_name}\n")

    if not systems:
        print(f"⚠️ No systems returned for {system_name}.")
        return pd.DataFrame()

    return pd.DataFrame(systems)

def check_if_update_needed(file_path):
    """Check if the file needs to be updated based on timestamp"""
    if not file_path.exists():
        print("💫 No existing dataset found. Will create new one.")
        return True
        
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
            if not isinstance(data, dict) or 'last_updated' not in data:
                print("💫 Invalid or old format dataset found. Will update.")
                return True
            
            last_updated = datetime.fromisoformat(data['last_updated'])
            time_since_update = datetime.now() - last_updated
            
            if time_since_update > timedelta(hours=24):
                print(f"💫 Dataset is {time_since_update.total_seconds() / 3600:.1f} hours old. Will update.")
                return True
            else:
                print(f"✨ Dataset is only {time_since_update.total_seconds() / 3600:.1f} hours old. Skipping update.")
                return False
                
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        print(f"💫 Error reading existing dataset: {e}. Will create new one.")
        return True

def fetch_combined_dataset(anchor_systems_df):
    """Fetch and combine data for all anchor systems"""
    data_dir = Path(os.path.abspath("../data"))
    data_dir.mkdir(exist_ok=True)
    
    output_file = data_dir / "combined_visualization_systems.json"
    
    # Check if we need to update the dataset
    if not check_if_update_needed(output_file):
        return None
    
    # Initialize the combined DataFrame
    combined_df = pd.DataFrame()
    
    for _, anchor in anchor_systems_df.iterrows():
        try:
            # Get coordinates for the anchor system
            x, y, z = get_coords(anchor['name'])
            print(f"✓ Got coordinates for {anchor['name']}: ({x}, {y}, {z})")
            
            # Fetch nearby systems
            systems_df = fetch_systems_near_coords(x, y, z, anchor['radius_ly'], anchor['name'])
            
            if not systems_df.empty:
                # Add anchor system information
                systems_df['anchor_system'] = anchor['name']
                systems_df['anchor_description'] = anchor['description']
                
                if combined_df.empty:
                    # First anchor system, just store its data
                    combined_df = systems_df
                    print(f"✓ Added {len(systems_df)} systems from {anchor['name']}")
                else:
                    # Check for duplicates with existing systems
                    existing_systems = set(combined_df['name'])
                    new_systems = systems_df[~systems_df['name'].isin(existing_systems)]
                    
                    # Add only the new systems
                    if not new_systems.empty:
                        combined_df = pd.concat([combined_df, new_systems])
                        print(f"✓ Added {len(new_systems)} new systems from {anchor['name']}")
                    
                    # Report duplicates
                    duplicates = systems_df[systems_df['name'].isin(existing_systems)]
                    if not duplicates.empty:
                        print(f"ℹ️ Skipped {len(duplicates)} duplicate systems from {anchor['name']}")
        
        except Exception as e:
            print(f"❌ Error processing {anchor['name']}: {e}")
    
    if not combined_df.empty:
        print(f"\nTotal unique systems: {len(combined_df)}")
        
        # Convert DataFrame to list of dictionaries and add timestamp
        systems_data = combined_df.to_dict('records')
        output_data = {
            'last_updated': datetime.now().isoformat(),
            'systems': clean_data_for_json(systems_data)
        }
        
        # Save as JSON
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, cls=NumpyJSONEncoder)
        print(f"\n💾 Saved combined dataset to: {output_file}")
        
        return combined_df
    
    return pd.DataFrame()

# Main execution
if __name__ == "__main__":
    try:
        # Fetch and save Google Sheets data
        fetch_and_save_sheets()
        
        # Continue with existing EDSM data fetching
        data_dir = Path("../data")
        data_dir.mkdir(exist_ok=True)
        
        anchor_file = data_dir / "vis_anchor_systems.csv"
        if not anchor_file.exists():
            raise FileNotFoundError(f"Required file not found: {anchor_file}")
        
        anchor_systems = pd.read_csv(anchor_file)
        if len(anchor_systems) == 0:
            raise ValueError("No anchor systems found in the CSV file")
        
        print(f"\nFound {len(anchor_systems)} anchor systems:")
        for _, anchor in anchor_systems.iterrows():
            print(f"- {anchor['name']} (radius: {anchor['radius_ly']}ly)")
        print("\nGenerating combined dataset...")
        
        # Generate combined dataset
        combined_df = fetch_combined_dataset(anchor_systems)
        
        if combined_df is None:
            print("\n✨ Using existing dataset (less than 24 hours old)")
        elif not combined_df.empty:
            print("\n✨ Successfully generated new dataset!")
            print(f"Total systems: {len(combined_df)}")
        else:
            print("\n❌ Failed to generate combined dataset")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
