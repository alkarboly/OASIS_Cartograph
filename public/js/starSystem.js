/**
 * StarSystem Class
 * Represents a single star system with its properties and 3D visualization
 */

class StarSystem {
    constructor(systemData) {
        // Core system data
        this.data = systemData;
        this.systemName = systemData.systemName;
        this.coordinates = systemData.coordinates;
        this.isClaimed = systemData.isClaimed;
        this.primaryPortComplete = systemData.primaryPortComplete;
        
        // 3D visualization properties
        this.mesh = null;
        this.sprite = null;
        this.isVisible = true;
        this.isHovered = false;
        this.originalScale = 1.0;
        
        // Color scheme based on system status
        this.color = this.determineColor();
        
        // Scale factor for coordinate conversion (Elite Dangerous uses light-years)
        this.coordinateScale = 0.1; // Scale down for better visualization
    }

    /**
     * Determine the color of the star based on its status
     * @returns {number} - Hex color value
     */
    determineColor() {
        if (!this.isClaimed) {
            return 0xff4444; // Red for unclaimed systems
        } else if (this.primaryPortComplete) {
            return 0x00ff88; // Green for claimed systems with complete ports
        } else {
            return 0xffaa00; // Orange for claimed systems with incomplete ports
        }
    }

    /**
     * Get the scaled 3D position for Three.js scene
     * @returns {Object} - Object with x, y, z properties scaled for 3D scene
     */
    getScaledPosition() {
        return {
            x: this.coordinates.x * this.coordinateScale,
            y: this.coordinates.y * this.coordinateScale,
            z: this.coordinates.z * this.coordinateScale
        };
    }

    /**
     * Create the 3D mesh representation of the star system
     * @returns {THREE.Group} - Three.js group containing the star visualization
     */
    create3DMesh() {
        const group = new THREE.Group();
        const position = this.getScaledPosition();
        
        // Create sphere geometry for the star
        const starGeometry = new THREE.SphereGeometry(0.2, 12, 12); // Smaller radius 0.2, reduced detail for performance
        
        // Create material with appropriate color and properties
        const starMaterial = new THREE.MeshBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: 0.9
        });
        
        const starMesh = new THREE.Mesh(starGeometry, starMaterial);
        group.add(starMesh);
        
        // Create text sprite for system name
        this.sprite = this.createTextSprite();
        if (this.sprite) {
            this.sprite.position.set(0, 1.5, 0); // Position above the sphere
            group.add(this.sprite);
        }
        
        // Set position
        group.position.set(position.x, position.y, position.z);
        
        // Store references
        this.mesh = group;
        this.starMesh = starMesh;
        
        // Add user data for raycasting
        starMesh.userData = {
            systemData: this.data,
            starSystem: this,
            isStarSystem: true
        };
        
        return group;
    }

    /**
     * Create a text sprite for the system name
     * @returns {THREE.Sprite} - Three.js sprite with system name
     */
    createTextSprite() {
        try {
            // Create canvas for text rendering
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            // Set canvas size
            canvas.width = 512;
            canvas.height = 128;
            
            // Configure text style
            context.font = 'Bold 32px Arial';
            context.fillStyle = '#ffffff';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            
            // Add background for better readability
            context.fillStyle = 'rgba(0, 0, 0, 0.7)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw text
            context.fillStyle = '#ffffff';
            context.fillText(this.systemName, canvas.width / 2, canvas.height / 2);
            
            // Create texture and sprite
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                opacity: 0.0 // Initially hidden
            });
            
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(12, 3, 1); // Sweet spot - 50% larger than original 8x2
            
            return sprite;
            
        } catch (error) {
            console.warn('Error creating text sprite for', this.systemName, error);
            return null;
        }
    }

    /**
     * Update the visibility of the star system based on filters
     * @param {Object} filters - Filter settings object
     */
    updateVisibility(filters) {
        let shouldBeVisible = true;
        
        // Check claimed/unclaimed filter
        if (this.isClaimed && !filters.showClaimed) {
            shouldBeVisible = false;
        }
        if (!this.isClaimed && !filters.showUnclaimed) {
            shouldBeVisible = false;
        }
        
        // Check port completion filter
        if (this.isClaimed) {
            if (this.primaryPortComplete && !filters.showPortComplete) {
                shouldBeVisible = false;
            }
            if (!this.primaryPortComplete && !filters.showPortIncomplete) {
                shouldBeVisible = false;
            }
        }
        
        this.setVisibility(shouldBeVisible);
    }

    /**
     * Set the visibility of the star system
     * @param {boolean} visible - Whether the system should be visible
     */
    setVisibility(visible) {
        this.isVisible = visible;
        if (this.mesh) {
            this.mesh.visible = visible;
        }
    }

    /**
     * Handle hover state changes
     * @param {boolean} hovered - Whether the system is being hovered
     */
    setHovered(hovered) {
        this.isHovered = hovered;
        
        if (this.mesh) {
            if (hovered) {
                // Scale up sphere and show name on hover
                if (this.starMesh) {
                    this.starMesh.scale.setScalar(1.4); // Scale up by 40%
                }
                if (this.sprite) {
                    this.sprite.material.opacity = 1.0;
                    this.sprite.scale.set(16, 4, 1); // Proportional hover size - 33% larger than base
                }
                
            } else {
                // Reset to normal state
                if (this.starMesh) {
                    this.starMesh.scale.setScalar(1.0); // Reset to normal size
                }
                if (this.sprite) {
                    this.sprite.material.opacity = 0.0;
                    this.sprite.scale.set(12, 3, 1); // Reset to sweet spot base size
                }
            }
        }
    }

    /**
     * Animate the star system (pulsing effect)
     * @param {number} time - Current time for animation
     */
    animate(time) {
        if (!this.mesh || !this.isVisible) return;
        
        // Subtle pulsing animation for spheres
        const pulseScale = 1.0 + Math.sin(time * 0.002 + this.coordinates.x * 0.01) * 0.1;
        
        if (this.starMesh && !this.isHovered) {
            // Only animate scale if not hovered (to avoid conflicting with hover effects)
            this.starMesh.scale.setScalar(pulseScale);
        }
    }

    /**
     * Get formatted information about the star system
     * @returns {Object} - Formatted system information
     */
    getFormattedInfo() {
        return {
            systemName: this.systemName || 'Unknown System',
            cmdrName: this.data.cmdrName || 'Unknown',
            discordName: this.data.discordName || 'Unknown',
            coordinates: `${this.coordinates.x.toFixed(2)} / ${this.coordinates.y.toFixed(2)} / ${this.coordinates.z.toFixed(2)}`,
            isClaimed: this.isClaimed ? 'Yes' : 'No',
            primaryPortComplete: this.primaryPortComplete ? 'Yes' : 'No',
            orbitalSlots: this.data.orbitalSlots || 0,
            planetarySlots: this.data.planetarySlots || 0,
            asteroidBaseSlots: this.data.asteroidBaseSlots || 0,
            narrative: this.data.narrative || 'No description available.',
            inaraLink: this.data.inaraLink || '#',
            colonyScreenshot: this.data.colonyScreenshot || '',
            additionalImages: this.data.additionalImages || ''
        };
    }

    /**
     * Calculate distance to another star system
     * @param {StarSystem} otherSystem - Another star system
     * @returns {number} - Distance in light-years
     */
    distanceTo(otherSystem) {
        const dx = this.coordinates.x - otherSystem.coordinates.x;
        const dy = this.coordinates.y - otherSystem.coordinates.y;
        const dz = this.coordinates.z - otherSystem.coordinates.z;
        
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Get the center point of all systems (for camera positioning)
     * @param {Array} systems - Array of StarSystem objects
     * @returns {Object} - Center coordinates
     */
    static getClusterCenter(systems) {
        if (systems.length === 0) return { x: 0, y: 0, z: 0 };
        
        let totalX = 0, totalY = 0, totalZ = 0;
        
        systems.forEach(system => {
            totalX += system.coordinates.x;
            totalY += system.coordinates.y;
            totalZ += system.coordinates.z;
        });
        
        return {
            x: totalX / systems.length,
            y: totalY / systems.length,
            z: totalZ / systems.length
        };
    }

    /**
     * Get the bounding box of all systems
     * @param {Array} systems - Array of StarSystem objects
     * @returns {Object} - Bounding box with min and max coordinates
     */
    static getClusterBounds(systems) {
        if (systems.length === 0) {
            return {
                min: { x: 0, y: 0, z: 0 },
                max: { x: 0, y: 0, z: 0 }
            };
        }
        
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        
        systems.forEach(system => {
            const coords = system.coordinates;
            minX = Math.min(minX, coords.x);
            minY = Math.min(minY, coords.y);
            minZ = Math.min(minZ, coords.z);
            maxX = Math.max(maxX, coords.x);
            maxY = Math.max(maxY, coords.y);
            maxZ = Math.max(maxZ, coords.z);
        });
        
        return {
            min: { x: minX, y: minY, z: minZ },
            max: { x: maxX, y: maxY, z: maxZ }
        };
    }

    /**
     * Dispose of Three.js resources
     */
    dispose() {
        if (this.mesh) {
            // Dispose of geometries and materials
            this.mesh.traverse((child) => {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    if (child.material.map) {
                        child.material.map.dispose();
                    }
                    child.material.dispose();
                }
            });
        }
    }
} 