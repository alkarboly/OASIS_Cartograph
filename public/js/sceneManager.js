/**
 * SceneManager Class
 * Manages the Three.js scene, camera, renderer, and all 3D visualization components
 */

class SceneManager {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.raycaster = null;
        this.mouse = new THREE.Vector2();
        
        // Star systems and interaction
        this.starSystems = [];
        this.hoveredSystem = null;
        this.selectedSystem = null;
        
        // Animation and rendering
        this.animationId = null;
        this.clock = new THREE.Clock();
        
        // Auto-rotation state
        this.autoRotate = true;
        this.autoRotateSpeed = 8.0; // Much faster rotation - 8 degrees per second
        this.userHasInteracted = false;
        
        // Auto-rotation system name display
        this.autoRotateSystemIndex = 0;
        this.autoRotateSystemTimer = 0;
        this.autoRotateSystemInterval = 3000; // Show each system for 3 seconds
        this.currentAutoRotateSystem = null;
        
        // Event callbacks
        this.onSystemHover = null;
        this.onAutoRotateStateChange = null;
        
        // Scene setup
        this.init();
    }

    /**
     * Initialize the Three.js scene and all components
     */
    init() {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createControls();
        this.createLighting();
        this.createBackground();
        this.setupEventListeners();
        this.setupRaycasting();
        
        // Start the render loop
        this.animate();
        
        console.log('SceneManager initialized successfully');
    }

    /**
     * Create the Three.js scene
     */
    createScene() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x000000, 50, 200); // Add atmospheric fog
    }

    /**
     * Create and configure the camera
     */
    createCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        
        // Position camera to get a good view of the cluster
        this.camera.position.set(50, 30, 50);
        this.camera.lookAt(0, 0, 0);
    }

    /**
     * Create and configure the WebGL renderer
     */
    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0); // Transparent background
        
        // Enable shadows for better visual quality
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        this.container.appendChild(this.renderer.domElement);
    }

    /**
     * Create orbit controls for camera interaction
     */
    createControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        
        // Configure controls
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 200;
        this.controls.maxPolarAngle = Math.PI;
        
        // Smooth controls
        this.controls.enableZoom = true;
        this.controls.enableRotate = true;
        this.controls.enablePan = true;
        
        // Disable auto-rotation when user interacts
        this.controls.addEventListener('start', () => {
            if (this.autoRotate) {
                this.userHasInteracted = true;
                this.autoRotate = false;
                console.log('User interaction detected - auto-rotation disabled');
                
                // Trigger callback
                if (this.onAutoRotateStateChange) {
                    this.onAutoRotateStateChange(false);
                }
            }
        });
    }

    /**
     * Create lighting for the scene
     */
    createLighting() {
        // Ambient light for overall illumination
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        // Directional light to simulate distant starlight
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 50, 50);
        directionalLight.castShadow = true;
        
        // Configure shadow properties
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        
        this.scene.add(directionalLight);
        
        // Add some colored accent lights for atmosphere
        const blueLight = new THREE.PointLight(0x0088ff, 0.3, 100);
        blueLight.position.set(-30, 20, -30);
        this.scene.add(blueLight);
        
        const orangeLight = new THREE.PointLight(0xff8800, 0.3, 100);
        orangeLight.position.set(30, -20, 30);
        this.scene.add(orangeLight);
    }

    /**
     * Create a starfield background
     */
    createBackground() {
        // Removed starfield background to focus only on registered OASIS systems
        // The background will be the CSS gradient from the body element
        console.log('Background setup complete - showing only registered systems');
    }

    /**
     * Setup raycasting for mouse interaction
     */
    setupRaycasting() {
        this.raycaster = new THREE.Raycaster();
        // Set a reasonable near/far for better precision
        this.raycaster.near = 0.1;
        this.raycaster.far = 1000;
    }

    /**
     * Setup event listeners for mouse interaction and window resize
     */
    setupEventListeners() {
        // Mouse move for hover detection (but not interaction detection)
        this.renderer.domElement.addEventListener('mousemove', (event) => {
            this.onMouseMove(event);
        });
        
        // Mouse click detection for stopping auto-rotation
        this.renderer.domElement.addEventListener('mousedown', () => {
            if (this.autoRotate && !this.userHasInteracted) {
                this.userHasInteracted = true;
                this.autoRotate = false;
                console.log('Click interaction detected - auto-rotation disabled');
                
                // Trigger callback
                if (this.onAutoRotateStateChange) {
                    this.onAutoRotateStateChange(false);
                }
            }
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });
        
        // Prevent context menu on right click
        this.renderer.domElement.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
    }

    /**
     * Handle mouse move events for hover detection
     * @param {MouseEvent} event - Mouse move event
     */
    onMouseMove(event) {
        // Don't process hover during auto-rotation
        if (this.autoRotate && !this.userHasInteracted) {
            return;
        }
        
        // Calculate mouse position in normalized device coordinates
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Get all intersections with star systems - check sphere meshes
        const meshes = [];
        this.starSystems.forEach(system => {
            if (system.starMesh && system.isVisible) {
                meshes.push(system.starMesh);
            }
        });
        
        const intersects = this.raycaster.intersectObjects(meshes, false);
        
        // Find the closest visible star system
        let newHoveredSystem = null;
        let closestDistance = Infinity;
        
        for (const intersect of intersects) {
            // The intersected object should be the sphere mesh with star system data
            if (intersect.object.userData && intersect.object.userData.isStarSystem) {
                const starSystem = intersect.object.userData.starSystem;
                
                // If this star system is visible and closer than previous ones
                if (starSystem && starSystem.isVisible && intersect.distance < closestDistance) {
                    newHoveredSystem = starSystem;
                    closestDistance = intersect.distance;
                }
            }
        }
        
        // Update hover state
        if (newHoveredSystem !== this.hoveredSystem) {
            // Clear previous hover
            if (this.hoveredSystem) {
                this.hoveredSystem.setHovered(false);
            }
            
            // Set new hover
            this.hoveredSystem = newHoveredSystem;
            if (this.hoveredSystem) {
                this.hoveredSystem.setHovered(true);
                
                // Call hover callback
                if (this.onSystemHover) {
                    this.onSystemHover(this.hoveredSystem);
                }
            }
            
            // Update cursor style
            this.renderer.domElement.style.cursor = this.hoveredSystem ? 'pointer' : 'default';
        }
    }

    /**
     * Handle window resize events
     */
    onWindowResize() {
        // Update camera aspect ratio
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        
        // Update renderer size
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    /**
     * Add star systems to the scene
     * @param {Array} systemsData - Array of system data objects
     */
    addStarSystems(systemsData) {
        console.log(`Adding ${systemsData.length} star systems to scene`);
        
        // Clear existing systems
        this.clearStarSystems();
        
        // Create StarSystem objects and add to scene
        systemsData.forEach(systemData => {
            try {
                const starSystem = new StarSystem(systemData);
                const mesh = starSystem.create3DMesh();
                
                if (mesh) {
                    this.scene.add(mesh);
                    this.starSystems.push(starSystem);
                }
            } catch (error) {
                console.warn('Error creating star system:', systemData.systemName, error);
            }
        });
        
        // Position camera to view the cluster
        this.positionCameraForCluster();
        
        console.log(`Successfully added ${this.starSystems.length} star systems`);
    }

    /**
     * Position the camera to get a good view of the entire cluster
     */
    positionCameraForCluster() {
        if (this.starSystems.length === 0) return;
        
        // Get cluster bounds and center
        const center = StarSystem.getClusterCenter(this.starSystems);
        const bounds = StarSystem.getClusterBounds(this.starSystems);
        
        // Calculate cluster size
        const size = Math.max(
            bounds.max.x - bounds.min.x,
            bounds.max.y - bounds.min.y,
            bounds.max.z - bounds.min.z
        ) * 0.1; // Apply coordinate scale
        
        // Position camera at a closer distance (50% closer)
        const distance = size * 0.5; // Reduced from size * 1.0 to size * 0.5 for 50% zoom in
        this.camera.position.set(
            center.x * 0.1 + distance,
            center.y * 0.1 + distance * 0.5,
            center.z * 0.1 + distance
        );
        
        // Look at cluster center
        this.controls.target.set(
            center.x * 0.1,
            center.y * 0.1,
            center.z * 0.1
        );
        
        this.controls.update();
    }

    /**
     * Update star system visibility based on filters
     * @param {Object} filters - Filter settings
     */
    updateSystemVisibility(filters) {
        this.starSystems.forEach(system => {
            system.updateVisibility(filters);
        });
    }

    /**
     * Clear all star systems from the scene
     */
    clearStarSystems() {
        this.starSystems.forEach(system => {
            if (system.mesh) {
                this.scene.remove(system.mesh);
                system.dispose();
            }
        });
        this.starSystems = [];
        this.hoveredSystem = null;
        this.selectedSystem = null;
    }

    /**
     * Animation loop
     */
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        const time = this.clock.getElapsedTime() * 1000; // Convert to milliseconds
        
        // Auto-rotation around the cluster
        if (this.autoRotate && !this.userHasInteracted) {
            // Simple rotation around Y axis
            const rotationSpeed = this.autoRotateSpeed * 0.016; // Approximate 60fps delta
            
            // Get current camera position relative to controls target
            const offset = new THREE.Vector3();
            offset.copy(this.camera.position).sub(this.controls.target);
            
            // Rotate around Y axis
            const angle = THREE.MathUtils.degToRad(rotationSpeed);
            const cosAngle = Math.cos(angle);
            const sinAngle = Math.sin(angle);
            
            const newX = offset.x * cosAngle - offset.z * sinAngle;
            const newZ = offset.x * sinAngle + offset.z * cosAngle;
            
            offset.x = newX;
            offset.z = newZ;
            
            // Update camera position
            this.camera.position.copy(this.controls.target).add(offset);
            
            // Handle auto-rotation system name display
            this.updateAutoRotateSystemDisplay(time);
        } else {
            // Clear auto-rotation system display when not auto-rotating
            if (this.currentAutoRotateSystem) {
                this.currentAutoRotateSystem.setHovered(false);
                this.currentAutoRotateSystem = null;
            }
        }
        
        // Update controls
        this.controls.update();
        
        // Animate star systems
        this.starSystems.forEach(system => {
            system.animate(time);
        });
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Set callback for system hover events
     * @param {Function} callback - Callback function
     */
    setSystemHoverCallback(callback) {
        this.onSystemHover = callback;
    }

    /**
     * Set callback for auto-rotation state changes
     * @param {Function} callback - Callback function
     */
    setAutoRotateStateCallback(callback) {
        this.onAutoRotateStateChange = callback;
    }

    /**
     * Get statistics about visible systems
     * @returns {Object} - Statistics object
     */
    getVisibleSystemStats() {
        const visible = this.starSystems.filter(system => system.isVisible);
        const claimed = visible.filter(system => system.isClaimed);
        const portComplete = visible.filter(system => system.primaryPortComplete);
        
        return {
            total: visible.length,
            claimed: claimed.length,
            unclaimed: visible.length - claimed.length,
            portComplete: portComplete.length,
            portIncomplete: claimed.length - portComplete.length
        };
    }

    /**
     * Focus camera on a specific star system
     * @param {StarSystem} starSystem - The system to focus on
     */
    focusOnSystem(starSystem) {
        if (!starSystem || !starSystem.mesh) return;
        
        const position = starSystem.getScaledPosition();
        
        // Animate camera to system
        const targetPosition = new THREE.Vector3(
            position.x + 10,
            position.y + 5,
            position.z + 10
        );
        
        // Set controls target to the system
        this.controls.target.set(position.x, position.y, position.z);
        
        // Smoothly move camera (you could use a tween library for smoother animation)
        this.camera.position.copy(targetPosition);
        this.controls.update();
    }

    /**
     * Dispose of all resources and stop animation
     */
    dispose() {
        // Stop animation loop
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Dispose of star systems
        this.clearStarSystems();
        
        // Dispose of renderer
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        // Remove event listeners
        window.removeEventListener('resize', this.onWindowResize);
        
        console.log('SceneManager disposed');
    }

    /**
     * Update auto-rotation system name display
     * @param {number} time - Current time in milliseconds
     */
    updateAutoRotateSystemDisplay(time) {
        if (this.starSystems.length === 0) return;
        
        // Check if it's time to switch to the next system
        if (time - this.autoRotateSystemTimer > this.autoRotateSystemInterval) {
            // Clear current system hover
            if (this.currentAutoRotateSystem) {
                this.currentAutoRotateSystem.setHovered(false);
            }
            
            // Move to next system
            this.autoRotateSystemIndex = (this.autoRotateSystemIndex + 1) % this.starSystems.length;
            this.currentAutoRotateSystem = this.starSystems[this.autoRotateSystemIndex];
            
            // Show the new system name
            if (this.currentAutoRotateSystem && this.currentAutoRotateSystem.isVisible) {
                this.currentAutoRotateSystem.setHovered(true);
                
                // Call hover callback to update UI
                if (this.onSystemHover) {
                    this.onSystemHover(this.currentAutoRotateSystem);
                }
            }
            
            this.autoRotateSystemTimer = time;
        }
    }
} 