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

// Special systems configuration
const SPECIAL_SYSTEMS = {
    '2MASS J05405172-0226489': { category: 'Memorial', color: 0xFFD700 },  // Gold
    'MSJ2009 L1630MIR-43': { category: 'Core-DEN', alias: 'DEN-Ref', color: 0xFF4500 },  // Orange-Red
    '2MASS J05403931-0226460': { category: 'Core-DEN', alias: 'DEN-Mil/Ref', color: 0xFF4500 },
    'MSJ2009 L1630MIR-54': { category: 'Core-DEN', alias: 'DEN-Ind', color: 0xFF4500 },
    '2MASS J05412214-0216441': { category: 'Core-DEN', alias: 'DEN-Agg', color: 0xFF4500 },
    'Running Man Sector YZ-Y c10': { category: 'Core-DEN', alias: 'DEN-HT', color: 0xFF4500 }
};

// Add event listeners immediately after DOM content loads
document.addEventListener('DOMContentLoaded', () => {
    const unclaimedToggle = document.getElementById('showUnclaimedSystems');
    const routeToggle = document.getElementById('showExpeditionRoute');
    
    // Set initial state of toggles
    unclaimedToggle.checked = showUnclaimedSystems;
    routeToggle.checked = showExpeditionRoute;
    
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

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

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
    
    // Update pulse animation with stronger effect
    pulseTime += 0.05;  // Faster pulse
    const pulseScale = 1 + Math.sin(pulseTime) * 0.5;  // Larger scale variation
    
    // Update pulsating markers
    scene.traverse((object) => {
        if (object.userData && object.userData.isInProgress) {
            object.scale.set(pulseScale, pulseScale, pulseScale);
            // Make the glow pulse too
            if (object.children[0]) {
                const glowScale = 1 + Math.sin(pulseTime + Math.PI) * 0.7;  // Inverse pulse for glow
                object.children[0].scale.set(glowScale, glowScale, glowScale);
                object.children[0].material.opacity = 0.3 + Math.sin(pulseTime) * 0.2;  // Pulse opacity
            }
        }
        
        // Make labels face camera
        if (object.userData && object.userData.isLabel) {
            object.lookAt(camera.position);
        }
    });
    
    renderer.render(scene, camera);
}

// Raycaster for mouse interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Get all meshes in the scene
    const meshes = scene.children.filter(child => child instanceof THREE.Mesh);
    
    // Only perform intersection test if there are meshes
    if (meshes.length > 0) {
        const intersects = raycaster.intersectObjects(meshes);
        if (intersects.length > 0) {
            const systemData = intersects[0].object.userData;
            updateInfoPanel(systemData);
        } else {
            updateInfoPanel(null);
        }
    } else {
        updateInfoPanel(null);
    }
}

window.addEventListener('mousemove', onMouseMove, false);

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
    if (SPECIAL_SYSTEMS[data.name]) {
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

function createTextLabel(text, position, size = 1) {
    if (!font) return null;

    // Create background plane first
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Measure text approximately
    const fontSize = size * 7;
    context.font = `${fontSize}px Arial`;
    const textWidth = context.measureText(text).width;
    
    const backgroundGeometry = new THREE.PlaneGeometry(textWidth / 5, fontSize / 5);
    const backgroundMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });
    const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);

    // Create text
    const textGeometry = new THREE.TextGeometry(text, {
        font: font,
        size: size * 7,
        height: 0.1,
        curveSegments: 1,
        bevelEnabled: false
    });

    textGeometry.computeBoundingBox();
    const centerOffset = -0.5 * (textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x);

    const textMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        transparent: true,
        opacity: 1.0
    });

    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.x += centerOffset;

    // Create a group to hold both background and text
    const group = new THREE.Group();
    background.position.z = -0.1;  // Slightly behind text
    group.add(background);
    group.add(textMesh);
    
    group.position.copy(position);
    group.position.y += 10;
    group.userData = { isLabel: true };

    return group;
}

function createRegionLabel(position, text) {
    const label = createTextLabel(text, position, 2);
    if (label) {
        // Set the text mesh color to yellow (it's the second child in the group)
        label.children[1].material.color.setHex(0xffff00);
        scene.add(label);
        return label;
    }
    return null;
}

// Add this to your init function after creating the renderer
function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .region-label {
            z-index: 1000;
            text-shadow: 0 0 5px rgba(0,0,0,0.5);
            transition: transform 0.1s ease-out;
        }
    `;
    document.head.appendChild(style);
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
            isInProgress: data.isInProgress  // Make sure this is set in the data
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
        const glowGeometry = new THREE.SphereGeometry(starSize * 2, 32, 32);  // Larger glow
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

// Start initialization
init(); 