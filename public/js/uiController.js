/**
 * UIController Class
 * Manages all user interface interactions, filters, and information display
 */

class UIController {
    constructor() {
        // Filter state
        this.filters = {
            showClaimed: true,
            showUnclaimed: true,
            showPortComplete: true,
            showPortIncomplete: true
        };
        
        // UI elements
        this.elements = {};
        this.systemInfoPanel = null;
        this.loadingScreen = null;
        
        // Callbacks
        this.onFiltersChanged = null;
        
        this.init();
    }

    /**
     * Initialize the UI controller and bind events
     */
    init() {
        this.cacheElements();
        this.bindEvents();
        this.setupSystemInfoPanel();
        this.updateFilterDisplay();
        
        console.log('UIController initialized');
    }

    /**
     * Cache references to DOM elements
     */
    cacheElements() {
        // Filter checkboxes
        this.elements.showClaimed = document.getElementById('showClaimed');
        this.elements.showUnclaimed = document.getElementById('showUnclaimed');
        this.elements.showPortComplete = document.getElementById('showPortComplete');
        this.elements.showPortIncomplete = document.getElementById('showPortIncomplete');
        
        // Statistics elements
        this.elements.systemCount = document.getElementById('systemCount');
        this.elements.claimedCount = document.getElementById('claimedCount');
        this.elements.portCompleteCount = document.getElementById('portCompleteCount');
        
        // System info panel elements
        this.systemInfoPanel = document.getElementById('system-info');
        this.elements.systemName = document.getElementById('system-name');
        this.elements.cmdrName = document.getElementById('cmdr-name');
        this.elements.discordName = document.getElementById('discord-name');
        this.elements.coordinates = document.getElementById('coordinates');
        this.elements.isClaimed = document.getElementById('is-claimed');
        this.elements.portComplete = document.getElementById('port-complete');
        this.elements.orbitalSlots = document.getElementById('orbital-slots');
        this.elements.planetarySlots = document.getElementById('planetary-slots');
        this.elements.asteroidSlots = document.getElementById('asteroid-slots');
        this.elements.narrative = document.getElementById('narrative');
        this.elements.inaraLink = document.getElementById('inara-link');
        this.elements.closeInfo = document.getElementById('close-info');
        
        // Loading screen
        this.loadingScreen = document.getElementById('loading');
        
        // Auto-rotation prompt
        this.elements.autoRotatePrompt = document.getElementById('auto-rotate-prompt');
    }

    /**
     * Bind event listeners to UI elements
     */
    bindEvents() {
        // Filter checkbox events
        Object.keys(this.filters).forEach(filterKey => {
            const element = this.elements[filterKey];
            if (element) {
                element.addEventListener('change', () => {
                    this.onFilterChange(filterKey, element.checked);
                });
            }
        });
        
        // System info panel close button
        if (this.elements.closeInfo) {
            this.elements.closeInfo.addEventListener('click', () => {
                this.hideSystemInfo();
            });
        }
        
        // Close system info when clicking outside
        if (this.systemInfoPanel) {
            document.addEventListener('click', (event) => {
                if (!this.systemInfoPanel.contains(event.target) && 
                    !this.systemInfoPanel.classList.contains('hidden')) {
                    // Check if click is on the 3D scene (not on control panel)
                    const controlPanel = document.querySelector('.control-panel');
                    if (!controlPanel.contains(event.target)) {
                        this.hideSystemInfo();
                    }
                }
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            this.handleKeyboardShortcuts(event);
        });
    }

    /**
     * Setup the system information panel
     */
    setupSystemInfoPanel() {
        if (this.systemInfoPanel) {
            // Initially hide the panel
            this.systemInfoPanel.classList.add('hidden');
        }
    }

    /**
     * Handle filter changes
     * @param {string} filterKey - The filter that changed
     * @param {boolean} value - The new value
     */
    onFilterChange(filterKey, value) {
        this.filters[filterKey] = value;
        this.updateFilterDisplay();
        
        // Call callback if set
        if (this.onFiltersChanged) {
            this.onFiltersChanged(this.filters);
        }
        
        console.log('Filter changed:', filterKey, '=', value);
    }

    /**
     * Update the visual state of filter controls
     */
    updateFilterDisplay() {
        Object.keys(this.filters).forEach(filterKey => {
            const element = this.elements[filterKey];
            if (element) {
                element.checked = this.filters[filterKey];
            }
        });
    }

    /**
     * Update statistics display
     * @param {Object} stats - Statistics object with counts
     */
    updateStatistics(stats) {
        if (this.elements.systemCount) {
            this.elements.systemCount.textContent = `Total Systems: ${stats.total}`;
        }
        
        if (this.elements.claimedCount) {
            this.elements.claimedCount.textContent = `Claimed: ${stats.claimed}`;
        }
        
        if (this.elements.portCompleteCount) {
            this.elements.portCompleteCount.textContent = `Port Complete: ${stats.portComplete}`;
        }
    }

    /**
     * Show system information panel
     * @param {StarSystem} starSystem - The star system to display info for
     */
    showSystemInfo(starSystem) {
        if (!starSystem || !this.systemInfoPanel) return;
        
        const info = starSystem.getFormattedInfo();
        
        // Update system information
        this.updateElement(this.elements.systemName, info.systemName);
        this.updateElement(this.elements.cmdrName, info.cmdrName);
        this.updateElement(this.elements.discordName, info.discordName);
        this.updateElement(this.elements.coordinates, info.coordinates);
        this.updateElement(this.elements.isClaimed, info.isClaimed);
        this.updateElement(this.elements.portComplete, info.primaryPortComplete);
        this.updateElement(this.elements.orbitalSlots, info.orbitalSlots);
        this.updateElement(this.elements.planetarySlots, info.planetarySlots);
        this.updateElement(this.elements.asteroidSlots, info.asteroidBaseSlots);
        this.updateElement(this.elements.narrative, info.narrative);
        
        // Update Inara link
        if (this.elements.inaraLink && info.inaraLink && info.inaraLink !== '#') {
            this.elements.inaraLink.href = info.inaraLink;
            this.elements.inaraLink.style.display = 'inline';
        } else if (this.elements.inaraLink) {
            this.elements.inaraLink.style.display = 'none';
        }
        
        // Show the panel
        this.systemInfoPanel.classList.remove('hidden');
        
        console.log('Showing system info for:', info.systemName);
    }

    /**
     * Hide the system information panel
     */
    hideSystemInfo() {
        if (this.systemInfoPanel) {
            this.systemInfoPanel.classList.add('hidden');
        }
    }

    /**
     * Update a DOM element's content safely
     * @param {HTMLElement} element - The element to update
     * @param {string} content - The content to set
     */
    updateElement(element, content) {
        if (element) {
            if (element.tagName === 'INPUT') {
                element.value = content;
            } else {
                element.textContent = content;
            }
        }
    }

    /**
     * Show the loading screen
     * @param {string} message - Optional loading message
     */
    showLoading(message = 'Loading OASIS Star Cluster Data...') {
        if (this.loadingScreen) {
            const loadingText = this.loadingScreen.querySelector('p');
            if (loadingText) {
                loadingText.textContent = message;
            }
            this.loadingScreen.classList.remove('hidden');
        }
    }

    /**
     * Hide the loading screen
     */
    hideLoading() {
        if (this.loadingScreen) {
            this.loadingScreen.classList.add('hidden');
        }
    }

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyboardShortcuts(event) {
        // Escape key to close system info
        if (event.key === 'Escape') {
            this.hideSystemInfo();
        }
        
        // Number keys to toggle filters
        switch (event.key) {
            case '1':
                this.toggleFilter('showClaimed');
                break;
            case '2':
                this.toggleFilter('showUnclaimed');
                break;
            case '3':
                this.toggleFilter('showPortComplete');
                break;
            case '4':
                this.toggleFilter('showPortIncomplete');
                break;
        }
    }

    /**
     * Toggle a filter programmatically
     * @param {string} filterKey - The filter to toggle
     */
    toggleFilter(filterKey) {
        if (this.filters.hasOwnProperty(filterKey)) {
            const newValue = !this.filters[filterKey];
            this.onFilterChange(filterKey, newValue);
        }
    }

    /**
     * Set callback for filter changes
     * @param {Function} callback - Callback function
     */
    setFiltersChangedCallback(callback) {
        this.onFiltersChanged = callback;
    }

    /**
     * Get current filter state
     * @returns {Object} - Current filter settings
     */
    getFilters() {
        return { ...this.filters };
    }

    /**
     * Set filter state
     * @param {Object} newFilters - New filter settings
     */
    setFilters(newFilters) {
        Object.assign(this.filters, newFilters);
        this.updateFilterDisplay();
        
        if (this.onFiltersChanged) {
            this.onFiltersChanged(this.filters);
        }
    }

    /**
     * Show an error message to the user
     * @param {string} message - Error message to display
     */
    showError(message) {
        // Create error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.innerHTML = `
            <div class="error-content">
                <h3>Error</h3>
                <p>${message}</p>
                <button onclick="this.parentElement.parentElement.remove()">Close</button>
            </div>
        `;
        
        // Add error styles
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #ff4444;
            z-index: 3000;
            max-width: 400px;
            text-align: center;
        `;
        
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }

    /**
     * Show a success message to the user
     * @param {string} message - Success message to display
     */
    showSuccess(message) {
        // Create success notification
        const successDiv = document.createElement('div');
        successDiv.className = 'success-notification';
        successDiv.innerHTML = `
            <div class="success-content">
                <p>${message}</p>
            </div>
        `;
        
        // Add success styles
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 255, 136, 0.9);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            border: 1px solid #00ff88;
            z-index: 3000;
            max-width: 300px;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(successDiv);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (successDiv.parentElement) {
                successDiv.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => successDiv.remove(), 300);
            }
        }, 3000);
    }

    /**
     * Create a tooltip for system hover
     * @param {StarSystem} starSystem - The star system being hovered
     * @param {number} x - Mouse X position
     * @param {number} y - Mouse Y position
     */
    showTooltip(starSystem, x, y) {
        // Remove existing tooltip
        this.hideTooltip();
        
        const info = starSystem.getFormattedInfo();
        
        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.id = 'system-tooltip';
        tooltip.innerHTML = `
            <div class="tooltip-content">
                <h4>${info.systemName}</h4>
                <p><strong>Commander:</strong> ${info.cmdrName}</p>
                <p><strong>Status:</strong> ${info.isClaimed} / ${info.primaryPortComplete}</p>
                <p><strong>Coordinates:</strong> ${info.coordinates}</p>
            </div>
        `;
        
        // Style the tooltip
        tooltip.style.cssText = `
            position: fixed;
            left: ${x + 10}px;
            top: ${y - 10}px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 10px;
            border-radius: 5px;
            border: 1px solid #00d4ff;
            z-index: 2000;
            pointer-events: none;
            font-size: 12px;
            max-width: 250px;
        `;
        
        document.body.appendChild(tooltip);
    }

    /**
     * Hide the tooltip
     */
    hideTooltip() {
        const tooltip = document.getElementById('system-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    /**
     * Update tooltip position
     * @param {number} x - Mouse X position
     * @param {number} y - Mouse Y position
     */
    updateTooltipPosition(x, y) {
        const tooltip = document.getElementById('system-tooltip');
        if (tooltip) {
            tooltip.style.left = `${x + 10}px`;
            tooltip.style.top = `${y - 10}px`;
        }
    }

    /**
     * Add CSS animations for notifications
     */
    addNotificationStyles() {
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Initialize notification styles
     */
    initializeNotifications() {
        this.addNotificationStyles();
    }

    /**
     * Show auto-rotation prompt
     */
    showAutoRotatePrompt() {
        if (this.elements.autoRotatePrompt) {
            this.elements.autoRotatePrompt.classList.remove('hidden');
        }
    }

    /**
     * Hide auto-rotation prompt
     */
    hideAutoRotatePrompt() {
        if (this.elements.autoRotatePrompt) {
            this.elements.autoRotatePrompt.classList.add('hidden');
        }
    }

    /**
     * Dispose of the UI controller and clean up
     */
    dispose() {
        // Remove event listeners and clean up
        console.log('UIController disposed');
    }
} 