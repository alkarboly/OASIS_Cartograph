let scene, camera, renderer, controls;
let labels = [];
const starSystems = new Map();
const regionLabels = new Map();
let showUnclaimedSystems = false;

// Loading screen elements
const loadingScreen = document.getElementById('loading-screen');
const loadingProgress = document.querySelector('.loading-progress');

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

async function init() {
    updateLoadingProgress('Setting up 3D environment...');
    
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 100;
    controls.maxDistance = 2000;

    // Scene center coordinates
    const SCENE_CENTER = {
        x: 559.8125,
        y: -373.125,
        z: -1102.03125
    };

    // Set initial camera position relative to scene center
    camera.position.set(
        SCENE_CENTER.x,
        SCENE_CENTER.y + 400, // Increased Y offset
        SCENE_CENTER.z + 1200 // Increased Z offset for more zoom out
    );
    controls.target.set(SCENE_CENTER.x, SCENE_CENTER.y, SCENE_CENTER.z);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Grid helper centered on SCENE_CENTER
    const gridHelper = new THREE.GridHelper(2000, 20, 0x444444, 0x222222);
    gridHelper.position.set(SCENE_CENTER.x, SCENE_CENTER.y, SCENE_CENTER.z);
    scene.add(gridHelper);

    // Load and parse the data
    updateLoadingProgress('Loading star data...');
    try {
        const [combinedData, expeditionData] = await Promise.all([
            fetch('data/combined_visualization_systems.json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                }),
            loadExpeditionData()
        ]);

        updateLoadingProgress('Creating visualization...');
        
        // Log dataset timestamp and size
        const lastUpdated = new Date(combinedData.last_updated);
        console.log(`Star system data last updated: ${lastUpdated.toLocaleString()}`);
        console.log(`Total systems in dataset: ${combinedData.systems.length}`);

        // Initialize particle system
        initParticleSystem();
        
        // Filter systems that don't require permits
        const unlockedSystems = combinedData.systems.filter(system => system.requirePermit === false);
        console.log(`Unlocked systems: ${unlockedSystems.length}`);
        
        // Track processed anchor systems to avoid duplicates
        const processedAnchors = new Set();
        let createdStars = 0;
        let particleStars = 0;
        
        unlockedSystems.forEach(system => {
            const position = parseCoordinates(system);
            if (position) {
                const star = createStarSystem(system, position);
                if (star) {
                    createdStars++;
                } else {
                    particleStars++;
                }
                
                // Create region label only for anchor systems with non-empty descriptions
                if (system.anchor_description && system.anchor_description.trim() !== '' && !processedAnchors.has(system.anchor_system)) {
                    const label = createRegionLabel(position, system.anchor_description);
                    regionLabels.set(system.anchor_system, {
                        label: label,
                        position: position.clone()
                    });
                    processedAnchors.add(system.anchor_system);
                }
            }
        });

        // Update particle system after all particles are added
        updateParticleSystem();
        updateParticleVisibility();

        hideLoadingScreen();
    } catch (error) {
        console.error('Error loading data:', error);
        updateLoadingProgress('Error loading data. Please refresh the page.');
    }

    // Add auto-rotation until user interacts
    let isAutoRotating = true;
    const autoRotateSpeed = 0.5; // degrees per second

    // Stop auto-rotation on any user interaction
    controls.addEventListener('start', () => {
        isAutoRotating = false;
    });

    function animate() {
        requestAnimationFrame(animate);
        
        // Auto-rotate if enabled
        if (isAutoRotating) {
            const rotationMatrix = new THREE.Matrix4();
            rotationMatrix.makeRotationY(autoRotateSpeed * Math.PI / 180);
            
            const cameraPosition = new THREE.Vector3();
            camera.getWorldPosition(cameraPosition);
            cameraPosition.sub(controls.target);
            cameraPosition.applyMatrix4(rotationMatrix);
            cameraPosition.add(controls.target);
            camera.position.copy(cameraPosition);
            
            camera.lookAt(controls.target);
        }
        
        controls.update();
        updateLabels();
        updateRegionLabels();
        renderer.render(scene, camera);
    }

    // Also stop auto-rotation on mouse wheel
    renderer.domElement.addEventListener('wheel', () => {
        isAutoRotating = false;
    });

    // Stop auto-rotation on touch events for mobile
    renderer.domElement.addEventListener('touchstart', () => {
        isAutoRotating = false;
    });

    animate();
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
    labels.forEach(label => {
        // Get the position of the star in screen space
        tempV.copy(label.position);
        tempV.project(camera);

        // Convert to screen coordinates
        const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-tempV.y * 0.5 + 0.5) * window.innerHeight;

        // Check if the star is in front of the camera
        if (tempV.z < 1) {
            label.element.style.transform = `translate(-50%, -50%) translate(${x}px,${y}px)`;
            
            // Show label only when star is visible and mouse is over it
            const isClaimed = label.star.userData.claimed === 'True';
            const isVisible = isClaimed || showUnclaimedSystems;
            label.element.style.display = isVisible ? 'none' : 'none'; // Initially hide all labels
        } else {
            label.element.style.display = 'none';
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    updateLabels();
    updateRegionLabels();
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

    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(scene.children);
    
    // First check regular star intersections
    const starIntersect = intersects.find(intersect => intersect.object instanceof THREE.Mesh);
    if (starIntersect) {
        updateInfoPanel(starIntersect.object.userData);
        return;
    }
    
    // Then check particle intersections
    const particleIntersect = intersects.find(intersect => intersect.object === particleSystem);
    if (particleIntersect) {
        const particleIndex = Math.floor(particleIntersect.index / 3);
        const particleData = particleSystem.userData.particleData[particleIndex];
        if (particleData) {
            updateInfoPanel(particleData);
            return;
        }
    }
    
    // No intersections
    updateInfoPanel(null);
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
    
    particleSystem = new THREE.Points(geometry, material);
    particleSystem.visible = showUnclaimedSystems; // Set initial visibility to match state
    scene.add(particleSystem);
}

function updateParticleSystem() {
    if (particlePositions.length === 0) return;
    
    const geometry = particleSystem.geometry;
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    particleSystem.userData.particleData = particleData;
}

function updateParticleVisibility() {
    if (particleSystem) {
        particleSystem.visible = showUnclaimedSystems;
    }
    
    // Also update regular star visibility
    scene.traverse((object) => {
        if (object instanceof THREE.Mesh && !(object instanceof THREE.Points)) {
            const systemData = object.userData;
            const isPopulated = systemData.systemInfo && systemData.systemInfo.population > 0;
            const isSpecial = SPECIAL_SYSTEMS[systemData.name];
            
            // Show if: it's populated/special OR unclaimed systems are shown
            object.visible = (isPopulated || isSpecial || showUnclaimedSystems);
        }
    });
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

function parseSystemInfo(infoStr) {
    if (!infoStr || typeof infoStr !== 'object') return {};
    return infoStr; // The information is now a proper JSON object
}

function getStarColor(systemData) {
    // Check if it's a special system
    if (SPECIAL_SYSTEMS[systemData.name]) {
        return SPECIAL_SYSTEMS[systemData.name].color;
    }

    // Check population from the information field
    let population = 0;
    if (systemData.information && typeof systemData.information === 'object') {
        population = systemData.information.population || 0;
    }

    // White for no population, purple for populated systems
    return population > 0 ? 0x800080 : 0xFFFFFF;
}

function createStarSystem(data, position) {
    // Parse system info once
    const systemInfo = parseSystemInfo(data.information);
    const isPopulated = systemInfo.population > 0;
    const isSpecial = SPECIAL_SYSTEMS[data.name];
    
    // Store common system data
    const systemData = {
        name: data.name,
        bodyCount: data.bodyCount,
        distance: data.distance,
        special: SPECIAL_SYSTEMS[data.name],
        systemInfo: systemInfo,
        anchor_system: data.anchor_system,
        anchor_description: data.anchor_description
    };

    // Handle unpopulated systems as particles
    if (!isPopulated && !isSpecial) {
        particlePositions.push(position.x, position.y, position.z);
        particleData.push(systemData);
        return null;
    }
    
    // Create regular star for populated/special systems
    const starSize = isSpecial ? 2.5 : 2;
    const color = getStarColor(data);
    
    // Create the star
    const geometry = new THREE.SphereGeometry(starSize, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: color });
    const star = new THREE.Mesh(geometry, material);
    star.position.copy(position);
    
    // Add glow effect
    const glowGeometry = new THREE.SphereGeometry(starSize * 1.5, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    star.add(glow);
    
    // Store system data for hover info
    star.userData = systemData;
    
    scene.add(star);
    return star;
}

// Enhanced region label creation
function createRegionLabel(position, text) {
    const label = document.createElement('div');
    label.className = 'region-label';
    label.textContent = text;
    label.style.position = 'absolute';
    label.style.visibility = 'hidden';  // Start hidden
    document.body.appendChild(label);
    return label;
}

// Improved label update function
function updateRegionLabels() {
    regionLabels.forEach((labelData, systemName) => {
        const { label, position } = labelData;
        
        // Convert 3D position to screen coordinates
        const screenPosition = position.clone();
        screenPosition.project(camera);
        
        // Calculate screen coordinates
        const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-screenPosition.y * 0.5 + 0.5) * window.innerHeight;
        
        // Check if the label should be visible
        const isBehindCamera = screenPosition.z > 1;
        const distanceToCamera = camera.position.distanceTo(position);
        const isWithinRange = distanceToCamera < 1200; // Reduced from 1500
        const isTooClose = distanceToCamera < 200; // Hide when too close
        
        if (!isBehindCamera && isWithinRange && !isTooClose) {
            label.style.visibility = 'visible';
            label.style.display = 'block';
            
            // Position the label with more offset
            label.style.left = `${x}px`;
            label.style.top = `${y - 60}px`;  // Increased offset from star
            
            // More subtle scaling
            const scale = Math.max(0.7, Math.min(1.2, 1200 / distanceToCamera));
            label.style.transform = `translate(-50%, -50%) scale(${scale})`;
            
            // More subtle opacity changes
            const baseOpacity = 0.85;
            const distanceOpacity = Math.max(0.5, Math.min(0.85, 1200 / distanceToCamera));
            const finalOpacity = Math.min(baseOpacity, distanceOpacity);
            label.style.opacity = finalOpacity;
            
            // Add subtle fade-in
            label.style.transition = 'all 0.3s ease-out';
        } else {
            label.style.visibility = 'hidden';
            label.style.display = 'none';
        }
    });
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

// Add event listener for toggle
document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('showUnclaimedSystems');
    toggle.addEventListener('change', (e) => {
        showUnclaimedSystems = e.target.checked;
        updateParticleVisibility();
    });
});

// Start initialization
init(); 