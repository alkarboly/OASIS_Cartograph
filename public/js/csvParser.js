/**
 * CSV Parser Module
 * Handles loading and parsing of the OASIS star catalog CSV data
 */

class CSVParser {
    constructor() {
        this.data = [];
        this.headers = [];
    }

    /**
     * Load and parse CSV data from the specified URL
     * @param {string} url - The URL to the CSV file
     * @returns {Promise<Array>} - Promise that resolves to parsed data array
     */
    async loadCSV(url) {
        try {
            console.log('Loading CSV data from:', url);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const csvText = await response.text();
            this.data = this.parseCSV(csvText);
            
            console.log(`Successfully loaded ${this.data.length} star systems`);
            return this.data;
            
        } catch (error) {
            console.error('Error loading CSV:', error);
            throw error;
        }
    }

    /**
     * Parse CSV text into structured data
     * @param {string} csvText - Raw CSV text content
     * @returns {Array} - Array of parsed system objects
     */
    parseCSV(csvText) {
        // First, let's properly parse the CSV handling multi-line quoted fields
        const records = this.parseCSVWithMultilineSupport(csvText);
        
        if (records.length === 0) {
            throw new Error('CSV file is empty');
        }

        // Parse headers
        this.headers = records[0];
        console.log('CSV Headers:', this.headers);
        console.log(`Total records in CSV: ${records.length} (including header)`);

        // Parse data rows
        const systems = [];
        for (let i = 1; i < records.length; i++) {
            try {
                const values = records[i];
                console.log(`Record ${i + 1}: Has ${values.length} values, expected ${this.headers.length}`);
                
                if (values.length >= this.headers.length) {
                    const system = this.createSystemObject(values);
                    if (system && system.coordinates) {
                        systems.push(system);
                        console.log(`✓ Added system: ${system.systemName} at ${system.coordinates.x}/${system.coordinates.y}/${system.coordinates.z}`);
                    } else {
                        console.warn(`✗ Skipped system on record ${i + 1}: ${system ? 'invalid coordinates' : 'failed to create system'}`);
                    }
                } else {
                    console.warn(`✗ Skipped record ${i + 1}: insufficient values (${values.length} < ${this.headers.length})`);
                }
            } catch (error) {
                console.warn(`✗ Error parsing record ${i + 1}:`, error.message);
            }
        }

        console.log(`Successfully parsed ${systems.length} out of ${records.length - 1} systems`);
        return systems;
    }

    /**
     * Parse CSV with proper support for multi-line quoted fields
     * @param {string} csvText - Raw CSV text content
     * @returns {Array} - Array of record arrays
     */
    parseCSVWithMultilineSupport(csvText) {
        const records = [];
        let currentRecord = [];
        let currentField = '';
        let inQuotes = false;
        let i = 0;
        
        while (i < csvText.length) {
            const char = csvText[i];
            const nextChar = csvText[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    currentField += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // End of field
                currentRecord.push(currentField.trim());
                currentField = '';
            } else if ((char === '\n' || char === '\r') && !inQuotes) {
                // End of record (only if not in quotes)
                if (currentField.trim() || currentRecord.length > 0) {
                    currentRecord.push(currentField.trim());
                    // Only add records that have content and the right number of fields
                    if (currentRecord.some(field => field.length > 0) && currentRecord.length > 5) {
                        console.log(`Adding record ${records.length + 1}: ${currentRecord[0]} (${currentRecord.length} fields)`);
                        records.push(currentRecord);
                    } else if (currentRecord.length > 0) {
                        console.warn(`Skipping incomplete record: ${currentRecord[0]} (${currentRecord.length} fields)`);
                    }
                    currentRecord = [];
                    currentField = '';
                }
                // Skip \r\n combinations
                if (char === '\r' && nextChar === '\n') {
                    i++;
                }
            } else {
                currentField += char;
            }
            
            i++;
        }
        
        // Add the last field and record if any
        if (currentField.trim() || currentRecord.length > 0) {
            currentRecord.push(currentField.trim());
            if (currentRecord.some(field => field.length > 0) && currentRecord.length > 5) {
                console.log(`Adding final record ${records.length + 1}: ${currentRecord[0]} (${currentRecord.length} fields)`);
                records.push(currentRecord);
            } else if (currentRecord.length > 0) {
                console.warn(`Skipping incomplete final record: ${currentRecord[0]} (${currentRecord.length} fields)`);
            }
        }
        
        console.log(`Total records parsed: ${records.length}`);
        return records;
    }

    /**
     * Create a system object from parsed CSV values
     * @param {Array} values - Array of CSV values
     * @returns {Object} - Structured system object
     */
    createSystemObject(values) {
        try {
            const system = {};
            
            // Map CSV columns to object properties
            this.headers.forEach((header, index) => {
                const value = values[index] || '';
                system[this.normalizePropertyName(header)] = value;
            });

            // Check if this is a valid system (must have a system name and coordinates)
            if (!system.systemName || !system.systemName.trim()) {
                console.warn(`Skipping record with empty system name`);
                return null;
            }

            // Parse and validate coordinates
            const coords = this.parseCoordinates(system.coordinates);
            if (!coords) {
                console.warn(`Invalid coordinates for system: ${system.systemName}`);
                return null;
            }
            
            system.coordinates = coords;
            
            // Normalize boolean fields
            system.isClaimed = this.parseBoolean(system.isClaimed);
            system.primaryPortComplete = this.parseBoolean(system.primaryPortComplete);
            system.isArchitect = this.parseBoolean(system.isArchitect);
            
            // Parse numeric fields
            system.orbitalSlots = this.parseNumber(system.orbitalSlots);
            system.planetarySlots = this.parseNumber(system.planetarySlots);
            system.asteroidBaseSlots = this.parseNumber(system.asteroidBaseSlots);
            
            // Clean up text fields
            system.narrative = this.cleanText(system.narrative);
            system.systemName = this.cleanText(system.systemName);
            system.cmdrName = this.cleanText(system.cmdrName);
            system.discordName = this.cleanText(system.discordName);
            
            // Additional validation - system must have a commander name or be claimed
            if (!system.cmdrName && !system.isClaimed) {
                console.warn(`Skipping system ${system.systemName}: no commander and not claimed`);
                return null;
            }
            
            console.log(`Valid system created: ${system.systemName} (Claimed: ${system.isClaimed}, Commander: ${system.cmdrName})`);
            return system;
            
        } catch (error) {
            console.error('Error creating system object:', error);
            return null;
        }
    }

    /**
     * Parse coordinate string into x, y, z values
     * @param {string} coordString - Coordinate string in format "x / y / z"
     * @returns {Object|null} - Object with x, y, z properties or null if invalid
     */
    parseCoordinates(coordString) {
        if (!coordString || typeof coordString !== 'string') {
            console.warn(`Invalid coordinate input: ${coordString}`);
            return null;
        }

        // Handle different coordinate formats
        const cleanCoords = coordString.trim();
        console.log(`Parsing coordinates: "${cleanCoords}"`);
        
        // Split by various possible delimiters
        let parts = cleanCoords.split('/');
        if (parts.length !== 3) {
            parts = cleanCoords.split(',');
        }
        if (parts.length !== 3) {
            parts = cleanCoords.split(/\s+/);
        }

        if (parts.length !== 3) {
            console.warn(`Invalid coordinate format: ${coordString} - got ${parts.length} parts:`, parts);
            return null;
        }

        try {
            const x = parseFloat(parts[0].trim());
            const y = parseFloat(parts[1].trim());
            const z = parseFloat(parts[2].trim());

            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                console.warn(`Non-numeric coordinates: ${coordString} -> x:${x}, y:${y}, z:${z}`);
                return null;
            }

            console.log(`✓ Parsed coordinates: ${x}, ${y}, ${z}`);
            return { x, y, z };
            
        } catch (error) {
            console.warn(`Error parsing coordinates: ${coordString}`, error);
            return null;
        }
    }

    /**
     * Parse boolean values from various string representations
     * @param {string} value - String value to parse as boolean
     * @returns {boolean} - Parsed boolean value
     */
    parseBoolean(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value !== 'string') return false;
        
        const normalized = value.toLowerCase().trim();
        return normalized === 'yes' || normalized === 'true' || normalized === '1';
    }

    /**
     * Parse numeric values, returning 0 for invalid numbers
     * @param {string} value - String value to parse as number
     * @returns {number} - Parsed numeric value
     */
    parseNumber(value) {
        const num = parseInt(value, 10);
        return isNaN(num) ? 0 : num;
    }

    /**
     * Clean text fields by removing extra whitespace and quotes
     * @param {string} text - Text to clean
     * @returns {string} - Cleaned text
     */
    cleanText(text) {
        if (!text || typeof text !== 'string') return '';
        
        return text
            .trim()
            .replace(/^["']|["']$/g, '') // Remove surrounding quotes
            .replace(/\s+/g, ' '); // Normalize whitespace
    }

    /**
     * Normalize property names for consistent object keys
     * @param {string} header - CSV header name
     * @returns {string} - Normalized property name
     */
    normalizePropertyName(header) {
        return header
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '') // Remove special characters
            .replace(/\s+/g, '') // Remove spaces
            .replace(/\?/g, '') // Remove question marks
            .replace(/systemname/g, 'systemName')
            .replace(/isarchitect/g, 'isArchitect')
            .replace(/discordname/g, 'discordName')
            .replace(/cmdrname/g, 'cmdrName')
            .replace(/isclaimed/g, 'isClaimed')
            .replace(/primaryportcomplete/g, 'primaryPortComplete')
            .replace(/orbitalslots/g, 'orbitalSlots')
            .replace(/planetaryslots/g, 'planetarySlots')
            .replace(/asteroidbaseslots/g, 'asteroidBaseSlots')
            .replace(/inaralink/g, 'inaraLink')
            .replace(/colonyscreenshot/g, 'colonyScreenshot')
            .replace(/additionalimages/g, 'additionalImages');
    }

    /**
     * Get the parsed data
     * @returns {Array} - Array of parsed system objects
     */
    getData() {
        return this.data;
    }

    /**
     * Get statistics about the loaded data
     * @returns {Object} - Statistics object
     */
    getStatistics() {
        const total = this.data.length;
        const claimed = this.data.filter(system => system.isClaimed).length;
        const portComplete = this.data.filter(system => system.primaryPortComplete).length;
        const unclaimed = total - claimed;

        return {
            total,
            claimed,
            unclaimed,
            portComplete,
            portIncomplete: claimed - portComplete
        };
    }
} 