/**
 * Main Application File
 * Initializes and coordinates all modules for the OASIS Star Cluster Visualizer
 */

class OASISVisualizer {
    constructor() {
        // Core components
        this.csvParser = null;
        this.sceneManager = null;
        this.uiController = null;
        
        // Application state
        this.isInitialized = false;
        this.starSystems = [];
        
        // Configuration
        this.config = {
            csvDataUrl: '/data/OASIS Catalog - OASIS_Catalog.csv',
            sceneContainer: '#scene-container'
        };
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('Initializing OASIS Star Cluster Visualizer...');
            
            // Initialize UI Controller first
            this.uiController = new UIController();
            this.uiController.showLoading('Initializing application...');
            
            // Initialize CSV Parser
            this.csvParser = new CSVParser();
            
            // Initialize Scene Manager
            const container = document.querySelector(this.config.sceneContainer);
            if (!container) {
                throw new Error('Scene container not found');
            }
            
            this.sceneManager = new SceneManager(container);
            
            // Setup event handlers
            this.setupEventHandlers();
            
            // Load and display data
            await this.loadData();
            
            this.isInitialized = true;
            this.uiController.hideLoading();
            this.uiController.showSuccess('OASIS Star Cluster loaded successfully!');
            
            console.log('OASIS Visualizer initialized successfully');
            
        } catch (error) {
            console.error('Error initializing application:', error);
            this.uiController.hideLoading();
            this.uiController.showError(`Failed to initialize application: ${error.message}`);
        }
    }

    /**
     * Setup event handlers between components
     */
    setupEventHandlers() {
        // UI filter changes
        this.uiController.setFiltersChangedCallback((filters) => {
            this.onFiltersChanged(filters);
        });
        
        // Scene manager system interactions
        this.sceneManager.setSystemHoverCallback((starSystem) => {
            this.onSystemHover(starSystem);
        });
        
        // Auto-rotation state changes
        this.sceneManager.setAutoRotateStateCallback((isAutoRotating) => {
            this.onAutoRotateStateChange(isAutoRotating);
        });
        
        console.log('Event handlers setup complete');
    }

    /**
     * Load CSV data and create star systems
     */
    async loadData() {
        try {
            this.uiController.showLoading('Loading star system data...');
            
            // Load CSV data
            const systemsData = await this.csvParser.loadCSV(this.config.csvDataUrl);
            
            if (!systemsData || systemsData.length === 0) {
                throw new Error('No valid star system data found');
            }
            
            this.uiController.showLoading('Creating 3D visualization...');
            
            // Add systems to scene
            this.sceneManager.addStarSystems(systemsData);
            this.starSystems = systemsData;
            
            // Update initial statistics
            this.updateStatistics();
            
            // Show auto-rotation prompt initially
            this.uiController.showAutoRotatePrompt();
            
            console.log(`Loaded ${systemsData.length} star systems`);
            
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }

    /**
     * Handle filter changes from UI
     * @param {Object} filters - New filter settings
     */
    onFiltersChanged(filters) {
        if (!this.sceneManager) return;
        
        // Update scene visibility
        this.sceneManager.updateSystemVisibility(filters);
        
        // Update statistics for visible systems
        this.updateStatistics();
        
        console.log('Filters updated:', filters);
    }

    /**
     * Handle system hover events
     * @param {StarSystem} starSystem - The hovered star system
     */
    onSystemHover(starSystem) {
        // Could add tooltip or other hover effects here
        console.log('System hovered:', starSystem.systemName);
    }

    /**
     * Handle auto-rotation state changes
     * @param {boolean} isAutoRotating - Whether auto-rotation is active
     */
    onAutoRotateStateChange(isAutoRotating) {
        if (isAutoRotating) {
            this.uiController.showAutoRotatePrompt();
        } else {
            this.uiController.hideAutoRotatePrompt();
        }
    }

    /**
     * Update statistics display
     */
    updateStatistics() {
        if (!this.sceneManager || !this.uiController) return;
        
        // Get statistics for currently visible systems
        const stats = this.sceneManager.getVisibleSystemStats();
        
        // Update UI
        this.uiController.updateStatistics(stats);
    }

    /**
     * Handle application errors
     * @param {Error} error - The error that occurred
     * @param {string} context - Context where the error occurred
     */
    handleError(error, context = 'Application') {
        console.error(`${context} Error:`, error);
        
        if (this.uiController) {
            this.uiController.showError(`${context}: ${error.message}`);
        }
    }

    /**
     * Dispose of the application and clean up resources
     */
    dispose() {
        console.log('Disposing OASIS Visualizer...');
        
        if (this.sceneManager) {
            this.sceneManager.dispose();
        }
        
        if (this.uiController) {
            this.uiController.dispose();
        }
        
        this.isInitialized = false;
        console.log('OASIS Visualizer disposed');
    }
}

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing OASIS Visualizer...');
    
    // Create global app instance
    window.oasisApp = new OASISVisualizer();
    
    // Initialize the application
    await window.oasisApp.init();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.oasisApp) {
        window.oasisApp.dispose();
    }
}); 