// Global variables
let scene, camera, renderer, controls;
let starSystems = [];
let labels = []; // Array to store label elements
let regionLabels = new Map(); // Changed back to Map for region labels
let showUnclaimedSystems = false;
let showExpeditionRoute = true;
let isAutoRotating = true;
const autoRotateSpeed = 0.1; // Reduced from 0.5 to 0.1 degrees per second
let loadingScreen, loadingProgress;
let routeGroup;
let combinedData = null; // Store combined data globally
let expeditionRoute = null;
let pulseTime = 0;
let fontLoader;
let font;

// Add global variable for label visibility
let showLabels = true;

// Loading screen elements
loadingScreen = document.getElementById('loading-screen');
loadingProgress = document.querySelector('.loading-progress');

// Initialize loading state
let dataLoaded = false;
let sceneInitialized = false;

// Create particle system for unpopulated stars
let particleSystem;
const particlePositions = [];
const particleData = [];

// Initialize special systems from CSV
const SPECIAL_SYSTEMS = {};

// Add event listeners immediately after DOM content loads
document.addEventListener('DOMContentLoaded', () => {
    const unclaimedToggle = document.getElementById('showUnclaimedSystems');
    const routeToggle = document.getElementById('showExpeditionRoute');
    const labelToggle = document.getElementById('showLabels');
    
    // Set initial state of toggles
    unclaimedToggle.checked = showUnclaimedSystems;
    routeToggle.checked = showExpeditionRoute;
    labelToggle.checked = showLabels;
    
    labelToggle.addEventListener('change', (e) => {
        showLabels = e.target.checked;
        scene.traverse((object) => {
            if (object.userData && object.userData.isLabel) {
                object.visible = showLabels;
            }
        });
    });

    unclaimedToggle.addEventListener('change', (e) => {
        console.log('Toggle changed:', e.target.checked);
        showUnclaimedSystems = e.target.checked;
        console.log('showUnclaimedSystems set to:', showUnclaimedSystems);
        updateParticleVisibility();
    });

    routeToggle.addEventListener('change', (e) => {
        console.log('Route toggle changed:', e.target.checked);
        showExpeditionRoute = e.target.checked;
        updateRouteVisibility();
    });
});

async function init() {
    updateLoadingProgress('Setting up 3D environment...');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000000);
    
    // Check for WebGL support first
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
            throw new Error('WebGL not supported');
        }
        
        // Create renderer with more conservative settings
        renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: false, // Disable antialiasing for better performance
            precision: 'mediump', // Use medium precision
            powerPreference: 'default',
            logarithmicDepthBuffer: false, // Disable log depth buffer
            failIfMajorPerformanceCaveat: false
        });
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio
        document.body.appendChild(renderer.domElement);
        
        // Rest of initialization code...
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.rotateSpeed = 0.3;
        controls.zoomSpeed = 0.8;
        controls.panSpeed = 0.5;
        controls.minDistance = 100;
        controls.maxDistance = 2000;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;

        // Load font first
        fontLoader = new THREE.FontLoader();
        try {
            font = await new Promise((resolve, reject) => {
                fontLoader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', 
                    resolve,
                    undefined,
                    reject
                );
            });
        } catch (error) {
            console.error('Error loading font:', error);
        }

        try {
            // Load special systems first
            await loadSpecialSystems();
            
            // Load all data first
            const [data, expeditionData, routeData, anchorData] = await Promise.all([
                fetch('data/combined_visualization_systems.json')
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        return response.json();
                    }),
                loadExpeditionData(),
                loadExpeditionRoute(),
                fetch('data/vis_anchor_systems.csv')
                    .then(response => response.text())
                    .then(text => {
                        // Parse CSV
                        const lines = text.split('\n');
                        const headers = lines[0].split(',');
                        return lines.slice(1).map(line => {
                            const values = line.split(',');
                            return {
                                name: values[0].trim(),
                                radius: parseFloat(values[1]),
                                description: values[2] ? values[2].trim() : ''
                            };
                        });
                    })
            ]);

            // Store the combined data globally
            combinedData = data;

            // Create a map of anchor systems with descriptions
            const anchorSystems = new Map();
            anchorData.forEach(anchor => {
                if (anchor.description) {
                    anchorSystems.set(anchor.name, anchor);
                }
            });

            // Find memorial system coordinates for camera positioning
            const memorialSystem = data.systems.find(s => s.name === '2MASS J05405172-0226489');
            if (memorialSystem) {
                const position = parseCoordinates(memorialSystem);
                if (position) {
                    camera.position.set(position.x + 500, position.y + 800, position.z + 500);
                    controls.target.copy(position);
                }
            }

            // Create a map of completed systems from route data
            const completedSystems = new Map();
            routeData.forEach(waypoint => {
                if (waypoint.system_name && waypoint['completed?_'] === 'TRUE') {
                    completedSystems.set(waypoint.system_name, true);
                }
            });

            // Log dataset timestamp and size
            const lastUpdated = new Date(data.last_updated);
            console.log(`Star system data last updated: ${lastUpdated.toLocaleString()}`);
            console.log(`Total systems in dataset: ${data.systems.length}`);

            // Clear existing particle data
            particlePositions.length = 0;
            particleData.length = 0;
            
            // Process star systems
            updateLoadingProgress('Creating star systems...');
            const allSystems = data.systems;
            console.log(`Total systems to process: ${allSystems.length}`);
            
            let createdStars = 0;
            let particleStars = 0;
            
            // First create all region labels
            anchorData.forEach(anchor => {
                if (anchor.description) {
                    // Trim any extra spaces from the system name
                    const systemName = anchor.name.trim();
                    const system = allSystems.find(s => s.name.trim() === systemName);
                    if (system) {
                        const position = parseCoordinates(system);
                        if (position) {
                            const label = createRegionLabel(position, anchor.description);
                            if (label) {
                                regionLabels.set(systemName, {
                                    label: label,
                                    position: position.clone()
                                });
                            }
                        }
                    }
                }
            });

            // After loading the data
            console.log('Loaded anchor systems:', Array.from(anchorSystems.keys()));

            // Process star systems
            console.log('Looking for system LAM01 ORIONIS in data...');
            const lamSystem = allSystems.find(s => s.name.includes('LAM') || s.name.includes('ORIO'));
            if (lamSystem) {
                console.log('Found potential match:', lamSystem.name);
            }

            allSystems.forEach(system => {
                const position = parseCoordinates(system);
                if (position) {
                    system.completed = completedSystems.has(system.name);
                    
                    const systemInfo = parseSystemInfo(system.information);
                    const isPopulated = systemInfo.population > 0;
                    const isSpecial = SPECIAL_SYSTEMS[system.name];

                    if (!isPopulated && !isSpecial) {
                        particlePositions.push(position.x, position.y, position.z);
                        particleData.push(system);
                        particleStars++;
                    } else {
                        const star = createStarSystem(system, position);
                        if (star) {
                            createdStars++;
                        }
                    }

                    // Create region label if it's in anchor systems
                    // Try both exact match and case-insensitive match
                    const anchorSystem = anchorSystems.get(system.name) || 
                                       Array.from(anchorSystems.entries())
                                            .find(([key]) => key.toLowerCase() === system.name.toLowerCase() ||
                                                           key.replace(/\s+/g, '') === system.name.replace(/\s+/g, ''))?.[1];
                    
                    if (anchorSystem && anchorSystem.description) {
                        console.log('Creating region label for:', system.name, 'with description:', anchorSystem.description);
                        const label = createRegionLabel(position, anchorSystem.description);
                        if (label) {
                            regionLabels.set(system.name, label);
                        }
                    }
                }
            });

            console.log(`Created ${createdStars} regular stars and ${particleStars} particle stars`);

            // Initialize particle system with the new data
            initParticleSystem();
            updateParticleVisibility();

            // Create route visualization after all data is loaded and processed
            updateLoadingProgress('Creating expedition route...');
            createRouteVisualization(routeData);

            hideLoadingScreen();
        } catch (error) {
            console.error('Error loading data:', error);
            updateLoadingProgress('Error loading data. Please refresh the page.');
            return;
        }
    } catch (error) {
        console.error('Failed to initialize WebGL:', error);
        const errorMessage = document.createElement('div');
        errorMessage.style.position = 'fixed';
        errorMessage.style.top = '50%';
        errorMessage.style.left = '50%';
        errorMessage.style.transform = 'translate(-50%, -50%)';
        errorMessage.style.color = 'white';
        errorMessage.style.background = 'rgba(0, 0, 0, 0.8)';
        errorMessage.style.padding = '20px';
        errorMessage.style.borderRadius = '10px';
        errorMessage.style.textAlign = 'center';
        errorMessage.innerHTML = `
            <h2>WebGL Error</h2>
            <p>Your browser doesn't support WebGL or it's disabled.</p>
            <p>Please try:</p>
            <ul style="text-align: left;">
                <li>Updating your browser</li>
                <li>Enabling hardware acceleration</li>
                <li>Using a different browser</li>
                <li>Updating your graphics drivers</li>
            </ul>
        `;
        document.body.appendChild(errorMessage);
        return;
    }

    // Add event listeners for controls
    controls.addEventListener('start', () => {
        isAutoRotating = false;
        controls.autoRotate = false;
    });

    window.addEventListener('resize', onWindowResize, false);

    animate();

    // Add styles after creating renderer
    addStyles();
}

function updateLoadingProgress(message) {
    if (loadingProgress) {
        loadingProgress.textContent = message;
    }
}

function hideLoadingScreen() {
    if (loadingScreen) {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }
}

function createStars() {
    console.log('Starting star creation...');
    // Clear existing stars and labels
    clearScene();

    const geometry = new THREE.SphereGeometry(0.1, 32, 32);
    let createdStars = 0;
    let errorStars = 0;
    
    starSystems.forEach((system, index) => {
        try {
            console.log(`Processing star system:`, system);
            
            // Parse coordinates
            const x = parseFloat(system.coords?.x) || 0;
            const y = parseFloat(system.coords?.y) || 0;
            const z = parseFloat(system.coords?.z) || 0;

            // Create star
            const material = new THREE.MeshPhongMaterial({
                color: system.requirePermit ? 0x808080 : 0xFFD700,
                emissive: system.requirePermit ? 0x404040 : 0x996515
            });
            
            const star = new THREE.Mesh(geometry, material);
            star.position.set(x, y, z);
            star.userData = system;
            scene.add(star);
            createdStars++;

            // Create label
            const label = document.createElement('div');
            label.className = 'region-label';
            label.textContent = system.name;
            label.style.display = 'none';
            document.body.appendChild(label);
            labels.push({ element: label, position: new THREE.Vector3(x, y, z), star: star });
        } catch (error) {
            console.error('Error creating star:', system, error);
            errorStars++;
        }
    });

    console.log(`Star creation complete. Created ${createdStars} stars, ${errorStars} errors`);
    updateStarVisibility();
}

function clearScene() {
    // Remove existing stars
    scene.children = scene.children.filter(child => !(child instanceof THREE.Mesh));
    
    // Remove existing labels
    labels.forEach(label => {
        if (label.element && label.element.parentNode) {
            label.element.parentNode.removeChild(label.element);
        }
    });
    labels = [];
}

function updateStarVisibility() {
    console.log('Updating star visibility...');
    let visibleStars = 0;
    let hiddenStars = 0;
    
    scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
            const requiresPermit = object.userData.requirePermit;
            object.visible = !requiresPermit || showUnclaimedSystems;
            if (object.visible) visibleStars++;
            else hiddenStars++;
        }
    });
    
    console.log(`Visibility updated: ${visibleStars} visible, ${hiddenStars} hidden`);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateLabels() {
    const tempV = new THREE.Vector3();
    
    // Update system labels
    labels.forEach(label => {
        // Get the position of the star in screen space
        tempV.copy(label.position);
        tempV.project(camera);

        // Convert to screen coordinates
        const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-tempV.y * 0.5 + 0.5) * window.innerHeight;

        // Check if the star is in front of the camera and within view bounds
        if (tempV.z < 1 && x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight) {
            const distance = camera.position.distanceTo(label.position);
            
            // Only show labels when zoomed in enough
            if (distance < 300) {
                label.element.style.display = 'block';
                label.element.style.transform = `translate(-50%, -50%) translate(${x}px,${y}px)`;
                
                // Fade out as we zoom out
                const opacity = Math.max(0, 1 - (distance - 100) / 200);
                label.element.style.opacity = opacity;
            } else {
                label.element.style.display = 'none';
            }
        } else {
            label.element.style.display = 'none';
        }
    });

    // Update region labels
    regionLabels.forEach((data, key) => {
        tempV.copy(data.position);
        tempV.project(camera);

        const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-tempV.y * 0.5 + 0.5) * window.innerHeight;

        if (tempV.z < 1 && x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight) {
            const distance = camera.position.distanceTo(data.position);
            
            // Show region labels from further away than star labels
            if (distance < 500) {
                data.label.element.style.display = 'block';
                data.label.element.style.transform = `translate(-50%, -50%) translate(${x}px,${y}px)`;
                
                // Scale based on distance from camera
                const scale = Math.max(0.5, Math.min(1.5, 1000 / distance));
                data.label.element.style.transform += ` scale(${scale})`;
            } else {
                data.label.element.style.display = 'none';
            }
        } else {
            data.label.element.style.display = 'none';
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    
    controls.update();
    updateLabelPositions();
    renderer.render(scene, camera);
}

function initParticleSystem() {
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.PointsMaterial({
        color: 0xFFFFFF,
        size: 1.5,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.8
    });
    
    // Set positions if we have any
    if (particlePositions.length > 0) {
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    }
    
    particleSystem = new THREE.Points(geometry, material);
    particleSystem.visible = showUnclaimedSystems;
    scene.add(particleSystem);
    console.log('Particle system initialized with', particlePositions.length / 3, 'particles');
}

function updateParticleSystem() {
    if (particlePositions.length === 0) return;
    
    const geometry = particleSystem.geometry;
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    particleSystem.userData.particleData = particleData;
}

function updateParticleVisibility() {
    console.log('Updating visibility. showUnclaimedSystems:', showUnclaimedSystems);
    
    if (particleSystem) {
        particleSystem.visible = showUnclaimedSystems;
        console.log('Particle system visibility:', particleSystem.visible);
    }
    
    let visibleCount = 0;
    let totalCount = 0;
    
    // Update regular star visibility
    scene.traverse((object) => {
        if (object instanceof THREE.Mesh && !(object instanceof THREE.Points)) {
            totalCount++;
            const systemData = object.userData;
            const requiresPermit = systemData.requirePermit;
            
            // Show if: doesn't require permit OR unclaimed systems are shown
            object.visible = !requiresPermit || showUnclaimedSystems;
            if (object.visible) visibleCount++;
            
            if (systemData.name) {
                console.log(`System "${systemData.name}": requiresPermit=${requiresPermit}, visible=${object.visible}`);
            }
        }
    });
    
    console.log(`Visibility updated: ${visibleCount}/${totalCount} stars visible`);
}

function parseCoordinates(data) {
    try {
        // Log the raw coordinate data for debugging
        console.log('Parsing coordinates for system:', data.name, data.coords);
        
        // Handle direct coordinate values
        if (data.coords && typeof data.coords === 'object') {
            const coords = data.coords;
            // Make sure we have numeric values
            const x = Number(coords.x);
            const y = Number(coords.y);
            const z = Number(coords.z);
            
            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                return new THREE.Vector3(x, y, z);
            }
        }
        
        console.warn(`Invalid coordinate format for system: ${data.name}`, data.coords);
        return null;
    } catch (error) {
        console.error(`Error parsing coordinates for system: ${data.name}`, error, data.coords);
        return null;
    }
}

function parseSystemInfo(information) {
    try {
        if (!information) {
            return { population: 0 };
        }
        return {
            population: information.population || 0
        };
    } catch (error) {
        console.error('Error parsing system information:', error);
        return { population: 0 };
    }
}

function getStarColor(data) {
    // Check if the system is completed in the route
    if (data.completed) {
        return 0x00ff00; // Green for completed systems takes priority
    }
    
    // If not completed, check if it's a special system
    if (data.name && SPECIAL_SYSTEMS[data.name]) {
        return SPECIAL_SYSTEMS[data.name].color;
    }
    
    // Check population from the information field
    let population = 0;
    if (data.information && typeof data.information === 'object') {
        population = data.information.population || 0;
    }

    // Purple for populated systems, white for no population
    return population > 0 ? 0x800080 : 0xFFFFFF;
}

function createTextSprite(text) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // More reasonable canvas resolution
    canvas.width = 2048;
    canvas.height = 1024;
    
    // Background
    context.fillStyle = 'rgba(0, 0, 0, 0.85)';
    context.strokeStyle = '#ffff00';
    context.lineWidth = 8;
    
    // Text settings
    context.font = 'bold 96px Arial';
    const textWidth = context.measureText(text).width;
    const padding = 60;
    const boxWidth = textWidth + (padding * 2);
    const boxHeight = 140;
    
    // Draw rounded rectangle background
    const x = (canvas.width - boxWidth) / 2;
    const y = (canvas.height - boxHeight) / 2;
    const radius = 20;
    
    // Outer glow
    context.shadowColor = '#ffff00';
    context.shadowBlur = 30;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + boxWidth - radius, y);
    context.quadraticCurveTo(x + boxWidth, y, x + boxWidth, y + radius);
    context.lineTo(x + boxWidth, y + boxHeight - radius);
    context.quadraticCurveTo(x + boxWidth, y + boxHeight, x + boxWidth - radius, y + boxHeight);
    context.lineTo(x + radius, y + boxHeight);
    context.quadraticCurveTo(x, y + boxHeight, x, y + boxHeight - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
    
    context.fill();
    context.shadowBlur = 0;
    context.stroke();
    
    // Draw text
    context.fillStyle = '#ffff00';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Text shadow
    context.shadowColor = 'rgba(0, 0, 0, 0.8)';
    context.shadowBlur = 8;
    context.shadowOffsetX = 4;
    context.shadowOffsetY = 4;
    
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        renderOrder: 999999
    });
    
    const sprite = new THREE.Sprite(spriteMaterial);
    // Increase the scale significantly but not to the point of crashing
    sprite.scale.set(320, 160, 1);
    sprite.renderOrder = 999999;
    
    return sprite;
}

// This function updates the position of all HTML labels in sync with the 3D scene
function updateLabelPositions() {
    // Find all elements with class 'region-label'
    const labels = document.querySelectorAll('.region-label');
    
    labels.forEach(label => {
        if (label.userData && label.userData.position) {
            // Get the stored 3D position from when we created the label
            const pos = label.userData.position.clone();
            
            // Project the 3D position to 2D screen space
            // This converts from 3D coordinates to normalized device coordinates (NDC)
            const vector = pos.project(camera);
            
            // Convert NDC to pixel coordinates
            // NDC goes from -1 to +1, we need to map this to screen pixels
            const widthHalf = window.innerWidth / 2;
            const heightHalf = window.innerHeight / 2;
            const x = (vector.x * widthHalf) + widthHalf;
            const y = -(vector.y * heightHalf) + heightHalf;
            
            // Different height offsets for different regions
            let yOffset = 25; // Default offset (halved from 50)
            const text = label.textContent;
            
            if (text.includes('Shoulder Of Orion') || text.includes('SoO')) {
                yOffset = 50; // Halved from 100
            } else if (text.includes('OASIS') || text.includes('OSC I')) {
                yOffset = 40; // Halved from 80
            } else if (text.includes('Lambda Orionis') || text.includes('OSC II')) {
                yOffset = 45; // Halved from 90
            }
            
            // Only show labels that are in front of the camera
            // vector.z < 1 means the point is in front of the near plane of the camera
            if (vector.z < 1) {
                label.style.display = 'block';
                label.style.left = `${x}px`;
                label.style.top = `${y - yOffset}px`;
            } else {
                label.style.display = 'none';
            }
        }
    });
}

// This function creates the CSS styles for our labels
function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .region-label {
            /* Position the label absolutely within the viewport */
            position: absolute;
            
            /* Text styling */
            font-family: Arial, sans-serif;
            font-size: 8px;          /* Halved from 16px */
            font-weight: bold;
            color: #ffff00;          /* Bright yellow color */
            
            /* Background and border */
            background: rgba(0, 0, 0, 0.8);  /* Semi-transparent black */
            padding: 3px 6px;        /* Halved from 6px 12px */
            border-radius: 2px;      /* Halved from 4px */
            border: 1px solid #ffff00;
            
            /* Effects */
            text-shadow: 0 0 3px rgba(0,0,0,0.5);  /* Text glow */
            box-shadow: 0 0 10px rgba(255, 255, 0, 0.3);  /* Box glow */
            
            /* Prevent text wrapping */
            white-space: nowrap;
            
            /* Center the label on its position */
            transform: translate(-50%, -50%);
            
            /* Smooth transitions when updating position */
            transition: all 0.1s ease-out;
            
            /* Make sure labels appear above the 3D scene */
            z-index: 1000;
            
            /* Prevent labels from intercepting mouse events */
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);
}

// This function creates a new label for a region
function createRegionLabel(position, text) {
    // Create the HTML element
    const labelDiv = document.createElement('div');
    labelDiv.className = 'region-label';
    labelDiv.textContent = text;
    
    // Store the 3D position for later use in updateLabelPositions
    labelDiv.userData = {
        position: position.clone(),
        isLabel: true
    };
    
    // Add to document
    document.body.appendChild(labelDiv);
    
    return labelDiv;
}

function createFCLabel(position, fc) {
    const labelText = `${fc.name} (${fc.callsign})`;
    const label = createTextSprite(labelText);
    label.position.copy(position);
    label.position.y += 8; // Increased offset for better visibility
    label.userData = { isLabel: true, isFC: true };
    scene.add(label);
    return label;
}

async function loadExpeditionRoute() {
    try {
        const response = await fetch('data/sheets/route.json');
        const routeData = await response.json();
        return routeData;
    } catch (error) {
        console.error('Error loading route data:', error);
        return [];
    }
}

function createRouteVisualization(routeData) {
    if (!combinedData || !combinedData.systems) {
        console.error('Combined data not loaded yet');
        return;
    }

    console.log('Creating route visualization with data:', routeData);
    
    // Remove existing route if any
    if (expeditionRoute) {
        scene.remove(expeditionRoute);
    }

    const points = [];
    const routeSystems = new Map();

    // First pass: collect coordinates for all systems in the route
    routeData.forEach((waypoint, index) => {
        // Skip empty or invalid entries
        if (!waypoint.system_name || waypoint.system_name.trim() === '') {
            return;
        }

        const systemName = waypoint.system_name;
        console.log(`Processing waypoint ${index}: ${systemName}`);
        
        // Find the system in the combined data, regardless of permit status
        const systemData = combinedData.systems.find(s => s.name === systemName);
        
        if (systemData) {
            const position = parseCoordinates(systemData);
            if (position) {
                console.log(`Found coordinates for ${systemName}:`, position);
                points.push(position);
                routeSystems.set(systemName, {
                    position,
                    claimed: waypoint['claimed?_'] === 'TRUE',
                    completed: waypoint['completed?_'] === 'TRUE',
                    architect: waypoint['architect?_'],
                    assignedFC: waypoint['assigned_fc'],
                    requirePermit: systemData.requirePermit
                });
            } else {
                console.warn(`Could not parse coordinates for ${systemName}`);
            }
        } else {
            console.warn(`System not found in combined data: ${systemName}`);
        }
    });

    console.log(`Found coordinates for ${points.length} systems`);

    if (points.length === 0) {
        console.error('No valid points found for route visualization');
        return;
    }

    // Create the route line
    const routeGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const routeMaterial = new THREE.LineBasicMaterial({
        color: 0x00ff00,
        linewidth: 1,
        opacity: 0.7,
        transparent: true
    });
    
    const routeLine = new THREE.Line(routeGeometry, routeMaterial);
    
    // Create markers for waypoints
    const waypointGroup = new THREE.Group();
    
    routeSystems.forEach((data, systemName) => {
        // Determine marker color and state
        let markerColor;
        const isInProgress = data.claimed && !data.completed;
        
        if (data.completed) {
            markerColor = 0x00ff00; // Green for completed
        } else if (isInProgress) {
            markerColor = 0xffa500; // Orange for in-progress
        } else if (data.requirePermit) {
            markerColor = 0xff0000; // Red for permit required
        } else {
            markerColor = 0xffff00; // Yellow for unclaimed
        }

        // Create marker for waypoint - using same size as special stars (2.5)
        const markerGeometry = new THREE.SphereGeometry(2.5, 32, 32);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: markerColor,
            opacity: 0.8,
            transparent: true
        });
        
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.copy(data.position);
        
        // Store state for animation
        marker.userData = {
            isInProgress,
            systemName,
            ...data
        };
        
        // Add glow effect - increased size to match special stars
        const glowGeometry = new THREE.SphereGeometry(3.5, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: markerColor,
            transparent: true,
            opacity: 0.3
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        marker.add(glow);
        
        waypointGroup.add(marker);
    });
    
    // Combine line and waypoints into a single group
    expeditionRoute = new THREE.Group();
    expeditionRoute.add(routeLine);
    expeditionRoute.add(waypointGroup);
    expeditionRoute.visible = showExpeditionRoute;
    
    scene.add(expeditionRoute);
    console.log('Route visualization created and added to scene');
}

function updateRouteVisibility() {
    if (expeditionRoute) {
        expeditionRoute.visible = showExpeditionRoute;
    }
}

// Update info panel on hover
function updateInfoPanel(systemData) {
    const infoPanel = document.getElementById('info');
    if (!systemData) {
        infoPanel.innerHTML = 'Hover over a star to see details';
        return;
    }
    
    let info = `<strong>${systemData.name}</strong><br>`;
    if (systemData.special) {
        info += `Category: ${systemData.special.category}<br>`;
        if (systemData.special.alias) {
            info += `Alias: ${systemData.special.alias}<br>`;
        }
    }
    if (systemData.anchor_system && systemData.name !== systemData.anchor_system) {
        info += `Anchor System: ${systemData.anchor_system}<br>`;
    }
    info += `Body Count: ${systemData.bodyCount || 'N/A'}<br>`;
    info += `Distance: ${systemData.distance} ly<br>`;
    
    const sysInfo = systemData.systemInfo;
    if (sysInfo.population > 0) {
        info += `Population: ${sysInfo.population.toLocaleString()}<br>`;
    }
    if (sysInfo.economy) {
        info += `Economy: ${sysInfo.economy}${sysInfo.secondEconomy ? ' / ' + sysInfo.secondEconomy : ''}<br>`;
    }
    if (sysInfo.government) {
        info += `Government: ${sysInfo.government}<br>`;
    }
    if (sysInfo.allegiance) {
        info += `Allegiance: ${sysInfo.allegiance}<br>`;
    }
    
    infoPanel.innerHTML = info;
}

function createStarSystem(data, position) {
    try {
        const systemInfo = parseSystemInfo(data.information);
        const isPopulated = systemInfo.population > 0;
        const isSpecial = SPECIAL_SYSTEMS[data.name];
        
        const systemData = {
            name: data.name,
            bodyCount: data.bodyCount,
            distance: data.distance,
            special: SPECIAL_SYSTEMS[data.name],
            systemInfo: systemInfo,
            anchor_system: data.anchor_system,
            anchor_description: data.anchor_description,
            requirePermit: data.requirePermit,
            completed: data.completed,
            isInProgress: data.isInProgress
        };

        const starSize = isSpecial ? 2.5 : (isPopulated ? 2.0 : 1.5);
        const color = getStarColor(data);
        
        const geometry = new THREE.SphereGeometry(starSize, 32, 32);
        const material = new THREE.MeshBasicMaterial({ 
            color: color,
            opacity: 0.8,
            transparent: true
        });
        const star = new THREE.Mesh(geometry, material);
        star.position.copy(position);
        
        // Enhanced glow effect
        const glowGeometry = new THREE.SphereGeometry(starSize * 2, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        star.add(glow);
        
        star.userData = systemData;
        if (systemData.isInProgress) {
            star.userData.isInProgress = true;
        }
        
        scene.add(star);
        return star;
    } catch (error) {
        console.error(`Error creating star system: ${data.name}`, error);
        return null;
    }
}

// Load expedition data from JSON files
async function loadExpeditionData() {
    const sheets = ['setup', 'admin-manifest', 'route', 'fc-manifest', 'hauler-manifest'];
    const expeditionData = {};
    
    for (const sheet of sheets) {
        try {
            const response = await fetch(`data/sheets/${sheet}.json`);
            expeditionData[sheet] = await response.json();
            console.log(`✓ Loaded ${sheet} data: ${expeditionData[sheet].length} rows`);
        } catch (error) {
            console.error(`❌ Error loading ${sheet} data:`, error);
            expeditionData[sheet] = [];
        }
    }
    
    return expeditionData;
}

// Load special systems from CSV
async function loadSpecialSystems() {
    try {
        const response = await fetch('data/special_systems.csv');
        const csvText = await response.text();
        const lines = csvText.split('\n').slice(1); // Skip header
        
        lines.forEach(line => {
            if (!line.trim()) return; // Skip empty lines
            const [name, category, alias, color] = line.split(',');
            if (name && color) {
                // Convert hex color string to number
                const colorNum = parseInt(color.replace('#', '0x'));
                SPECIAL_SYSTEMS[name] = {
                    category: category || '',
                    alias: alias || '',
                    color: colorNum
                };
            }
        });
        console.log('Loaded special systems:', Object.keys(SPECIAL_SYSTEMS).length);
    } catch (error) {
        console.error('Error loading special systems:', error);
    }
}

function createControlPanel() {
    // Remove any existing control panels
    const existingPanels = document.querySelectorAll('.control-panel');
    existingPanels.forEach(panel => panel.remove());

    const container = document.createElement('div');
    container.className = 'control-panel';
    container.style.position = 'absolute';
    container.style.top = '10px';
    container.style.right = '10px';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    container.style.padding = '15px';
    container.style.borderRadius = '8px';
    container.style.color = 'white';
    container.style.zIndex = '1000';
    container.style.minWidth = '200px';
    container.style.fontFamily = 'Arial, sans-serif';

    const title = document.createElement('div');
    title.textContent = 'Display Options';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '10px';
    title.style.borderBottom = '1px solid rgba(255, 255, 255, 0.3)';
    title.style.paddingBottom = '5px';
    container.appendChild(title);

    // Create toggle for Labels (first in the list)
    const labelToggle = createToggle(
        'Show Labels',
        showLabels,
        (checked) => {
            showLabels = checked;
            scene.traverse((object) => {
                if (object.userData && object.userData.isLabel) {
                    object.visible = checked;
                }
            });
        }
    );
    container.appendChild(labelToggle);

    // Add other toggles...
    const fcToggle = createToggle(
        'Show Fleet Carriers',
        fcMarkersVisible,
        (checked) => {
            fcMarkersVisible = checked;
            scene.traverse((object) => {
                if (object.userData && object.userData.isFC) {
                    object.visible = checked;
                }
            });
        }
    );
    container.appendChild(fcToggle);

    const unclaimedToggle = createToggle(
        'Show Unclaimed Systems',
        showUnclaimedSystems,
        (checked) => {
            showUnclaimedSystems = checked;
            updateParticleVisibility();
        }
    );
    container.appendChild(unclaimedToggle);

    const routeToggle = createToggle(
        'Show Expedition Route',
        showExpeditionRoute,
        (checked) => {
            showExpeditionRoute = checked;
            if (window.routeLine) {
                window.routeLine.visible = checked;
            }
            expeditionWaypoints.visible = checked;
        }
    );
    container.appendChild(routeToggle);

    document.body.appendChild(container);
}

// Helper function to create toggle switches
function createToggle(label, initialState, onChange) {
    const container = document.createElement('div');
    container.className = 'toggle-container';
    container.style.marginBottom = '10px';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.cursor = 'pointer';
    container.style.padding = '5px';
    container.style.borderRadius = '4px';
    container.style.transition = 'background-color 0.2s';
    container.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = initialState;
    checkbox.style.marginRight = '10px';
    checkbox.style.cursor = 'pointer';
    checkbox.style.width = '20px';
    checkbox.style.height = '20px';

    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.style.cursor = 'pointer';
    labelElement.style.userSelect = 'none';
    labelElement.style.flex = '1';

    container.appendChild(checkbox);
    container.appendChild(labelElement);

    container.addEventListener('mouseover', () => {
        container.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    });

    container.addEventListener('mouseout', () => {
        container.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    });

    container.addEventListener('click', (e) => {
        if (e.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
            onChange(checkbox.checked);
        }
    });

    checkbox.addEventListener('change', () => {
        onChange(checkbox.checked);
    });

    return container;
}

// Start initialization
init(); 