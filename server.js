import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve static files from the public directory
app.use(express.static('public'));

// Serve the data directory
app.use('/data', express.static('data'));

// Initialize Google Sheets API
const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Helper function to clean column names
function cleanColumnName(col) {
    return col.toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

// Helper function to clean values
function cleanValue(val) {
    if (typeof val === 'string') {
        val = val.trim();
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
        if (!isNaN(val)) return Number(val);
    }
    return val;
}

// API endpoint to fetch sheet data
app.get('/api/sheets/:sheetName', async (req, res) => {
    console.log(`Received request for sheet: ${req.params.sheetName}`);
    try {
        let sheetName = req.params.sheetName.toUpperCase();
        if (sheetName === 'SETUP') sheetName = 'SETUP';
        else if (sheetName === 'ADMIN-MANIFEST') sheetName = 'Admin-Manifest';
        else if (sheetName === 'ROUTE') sheetName = 'ROUTE';
        else if (sheetName === 'FC-MANIFEST') sheetName = 'FC-Manifest';
        else if (sheetName === 'HAULER-MANIFEST') sheetName = 'Hauler-Manifest';
        else throw new Error('Invalid sheet name');

        console.log(`Fetching sheet: ${sheetName}`);
        console.log('Using spreadsheet ID:', process.env.GOOGLE_SHEETS_ID);
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SHEETS_ID,
            range: sheetName,
        });

        console.log(`Got response from Google Sheets API for ${sheetName}`);
        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.warn(`No data found in sheet ${sheetName}`);
            throw new Error('No data found in sheet');
        }

        console.log(`Processing ${rows.length} rows from ${sheetName}`);
        // Convert headers to clean column names
        const headers = rows[0].map(cleanColumnName);
        console.log('Headers:', headers);

        // Convert rows to objects with cleaned values
        const data = rows.slice(1).map(row => {
            const obj = {};
            row.forEach((value, index) => {
                if (value !== '' && value !== undefined) {
                    obj[headers[index]] = cleanValue(value);
                }
            });
            return obj;
        });

        console.log(`Successfully processed ${data.length} rows from ${sheetName}`);
        res.json(data);
    } catch (error) {
        console.error('Error fetching sheet data:', error);
        if (error.message.includes('invalid_grant')) {
            console.error('Authentication error - check your Google API credentials');
        }
        res.status(500).json({ error: 'Failed to fetch sheet data', details: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
}); 