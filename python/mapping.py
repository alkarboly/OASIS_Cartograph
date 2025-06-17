# OASIS Star System Dataset Generator

# This notebook fetches star systems around each anchor point from EDSM and generates a combined dataset for visualization.
# Each anchor system is processed to find nearby systems within its specified radius, and all data is combined into a single dataset.

# Required input file:
# - data/vis_anchor_systems.csv: Contains anchor system names, radii, and descriptions

import pandas as pd
import requests
from pathlib import Path
import os

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

def fetch_combined_dataset(anchor_systems_df):
    """Fetch and combine data for all anchor systems"""
    data_dir = Path(os.path.abspath("../data"))
    data_dir.mkdir(exist_ok=True)
    
    all_systems = []
    
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
                all_systems.append(systems_df)
                print(f"Found {len(systems_df)} systems near {anchor['name']}")
        
        except Exception as e:
            print(f"❌ Error processing {anchor['name']}: {e}")
    
    if all_systems:
        # First combine all systems
        print("\nCombining datasets...")
        combined_df = pd.concat(all_systems)
        print(f"Total systems before deduplication: {len(combined_df)}")
        
        # Handle duplicates - keep first occurrence but merge anchor information
        print("Removing duplicates...")
        # Sort by anchor system to prioritize certain systems
        combined_df = combined_df.sort_values('anchor_system')
        
        # For systems that appear multiple times, combine their anchor information
        duplicates = combined_df[combined_df.duplicated(subset=['name'], keep=False)]
        if not duplicates.empty:
            print(f"\nFound {len(duplicates)//2} systems that appear in multiple anchor regions:")
            for name in duplicates['name'].unique():
                matches = combined_df[combined_df['name'] == name]
                print(f"- {name} appears in: {', '.join(matches['anchor_system'].unique())}")
        
        # Remove duplicates but keep first occurrence (after sorting)
        combined_df = combined_df.drop_duplicates(subset=['name'], keep='first')
        print(f"Total systems after deduplication: {len(combined_df)}")
        
        # Save combined dataset
        output_file = data_dir / "combined_visualization_systems.csv"
        combined_df.to_csv(output_file, index=False)
        print(f"\n💾 Saved combined dataset to: {output_file}")
        
        return combined_df
    
    return pd.DataFrame()

# Load anchor systems and generate the combined dataset
try:
    # Ensure data directory exists
    data_dir = Path("../data")
    data_dir.mkdir(exist_ok=True)
    
    # Check if anchor systems file exists
    anchor_file = data_dir / "vis_anchor_systems.csv"
    if not anchor_file.exists():
        raise FileNotFoundError(f"Required file not found: {anchor_file}")
        
    # Load anchor systems
    anchor_systems = pd.read_csv(anchor_file)
    if len(anchor_systems) == 0:
        raise ValueError("No anchor systems found in the CSV file")
        
    print(f"Found {len(anchor_systems)} anchor systems:")
    for _, anchor in anchor_systems.iterrows():
        print(f"- {anchor['name']} (radius: {anchor['radius_ly']}ly)")
    print("\nGenerating combined dataset...")
    
    # Generate the dataset
    all_systems = fetch_combined_dataset(anchor_systems)
    
except FileNotFoundError as e:
    print(f"\n❌ Error: {e}")
    print("\nPlease ensure vis_anchor_systems.csv exists in the data directory with columns:")
    print("- name: Name of the anchor system")
    print("- radius_ly: Radius in light years to search around the system")
    print("- description: Description of the anchor system")
except Exception as e:
    print(f"\n❌ Error: {e}")
