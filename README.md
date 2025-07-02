# OASIS Cartograph - Elite Dangerous Mapping Tools

A collection of mapping tools and datasets for Elite Dangerous star systems, focusing on the OASIS region and other strategic locations.

![Elite Dangerous](https://img.shields.io/badge/Elite%20Dangerous-Mapping-orange)
![Python](https://img.shields.io/badge/Python-3.7%2B-blue)

## Features

- **Automated System Discovery**: Fetch star systems from EDSM API based on anchor systems
- **Multi-Region Support**: Handle multiple regions with different anchor system lists
- **Data Aggregation**: Combine data from Google Sheets and EDSM for comprehensive mapping
- **Flexible Radius Mapping**: Configurable search radius for each anchor system
- **JSON Export**: Clean, structured data output for integration with other tools

## Project Structure

```
OASIS_Cartograph/
├── README.md                 # This file
├── python/
│   └── mapping.py           # Main mapping script
└── data/
    ├── vis_anchor_systems.csv          # Anchor systems for mapping
    ├── combined_visualization_systems.json # Generated system data
    ├── special_systems.csv             # Special systems of interest
    └── sheets/                         # Google Sheets data
        ├── admin-manifest.json
        ├── fc-manifest.json
        ├── hauler-manifest.json
        ├── route.json
        └── setup.json
```

## Installation

### Prerequisites

- Python 3.7 or higher
- pip package manager

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/alkarboly/OASIS_Cartograph.git
   cd OASIS_Cartograph
   ```

2. **Install Python dependencies**
   ```bash
   pip install pandas requests gspread google-oauth2-tool numpy python-dotenv
   ```

3. **Configure environment variables** (optional, for Google Sheets integration)
   Create a `.env` file in the root directory:
   ```
   GOOGLE_SHEETS_ID=your_sheet_id
   GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY=your_private_key
   ```

## Usage

### Basic Mapping

The main mapping script (`python/mapping.py`) can be used to:

1. **Fetch systems around anchor points**: Uses EDSM API to find all systems within specified radii
2. **Aggregate Google Sheets data**: Pulls operational data from connected spreadsheets
3. **Generate comprehensive datasets**: Combines multiple data sources into unified JSON files

### Anchor Systems Format

The `vis_anchor_systems.csv` file defines the mapping anchor points:

```csv
name,radius_ly,description
System Name,100,Description
Another System,50,Another description
```

- `name`: Star system name (must match EDSM exactly)
- `radius_ly`: Search radius in light years
- `description`: Optional description/category

### Running the Mapping Script

```bash
cd python
python mapping.py
```

This will:
1. Read anchor systems from `../data/vis_anchor_systems.csv`
2. Fetch systems within each anchor's radius from EDSM
3. Combine with Google Sheets data (if configured)
4. Generate `combined_visualization_systems.json`

## Data Sources

- **EDSM API**: Star system coordinates and basic information
- **Google Sheets**: Operational data (manifests, routes, setup info)
- **Local CSV files**: Anchor systems and special systems lists

## Adding New Regions

To add a new region for mapping:

1. Create a new CSV file with anchor systems for that region
2. Update the mapping script to read from your new file
3. Run the script to generate the dataset

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add your mapping improvements
4. Submit a pull request

## License

MIT License - feel free to use this for your own Elite Dangerous mapping projects. 