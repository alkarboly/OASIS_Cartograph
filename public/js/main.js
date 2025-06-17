// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Scene center coordinates
const SCENE_CENTER = {
    x: 559.8125,
    y: -373.125,
    z: -1102.03125
};

// Controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 100;
controls.maxDistance = 2000;

// Set initial camera position relative to scene center
camera.position.set(
    SCENE_CENTER.x,
    SCENE_CENTER.y + 200,
    SCENE_CENTER.z + 600
);
controls.target.set(SCENE_CENTER.x, SCENE_CENTER.y, SCENE_CENTER.z);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Grid helper - centered on SCENE_CENTER
const gridHelper = new THREE.GridHelper(2000, 20, 0x444444, 0x222222);
gridHelper.position.set(SCENE_CENTER.x, SCENE_CENTER.y, SCENE_CENTER.z);
scene.add(gridHelper);

// Star systems container
const starSystems = new Map();
const regionLabels = new Map();

// Raycaster for mouse interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let specialSystems = new Map();

// Special systems configuration
const SPECIAL_SYSTEMS = {
    '2MASS J05405172-0226489': { category: 'Memorial', color: 0xFFD700 },  // Gold
    'MSJ2009 L1630MIR-43': { category: 'Core-DEN', alias: 'DEN-Ref', color: 0xFF4500 },  // Orange-Red
    '2MASS J05403931-0226460': { category: 'Core-DEN', alias: 'DEN-Mil/Ref', color: 0xFF4500 },
    'MSJ2009 L1630MIR-54': { category: 'Core-DEN', alias: 'DEN-Ind', color: 0xFF4500 },
    '2MASS J05412214-0216441': { category: 'Core-DEN', alias: 'DEN-Agg', color: 0xFF4500 },
    'Running Man Sector YZ-Y c10': { category: 'Core-DEN', alias: 'DEN-HT', color: 0xFF4500 }
};

// Create particle system for unpopulated stars
let particleSystem;
const particlePositions = [];
const particleData = [];

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

function parseCoordinates(data) {
    try {
        if (data.coords) {
            // Parse the coords string which is in Python dict format
            const coordsStr = data.coords.replace(/'/g, '"').replace(/None/g, 'null');
            const coords = JSON.parse(coordsStr);
            
            if (!isNaN(coords.x) && !isNaN(coords.y) && !isNaN(coords.z)) {
                return new THREE.Vector3(coords.x, coords.y, coords.z);
            }
        }
        
        // Fallback to Coordinates field if coords is not available
        if (data.Coordinates) {
            const [x, y, z] = data.Coordinates.split('/').map(coord => parseFloat(coord.trim()));
            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                return new THREE.Vector3(x, y, z);
            }
        }
        
        console.warn(`Invalid coordinate format for system: ${data.name}`);
        return null;
    } catch (error) {
        console.warn(`Error parsing coordinates for system: ${data.name}`);
        return null;
    }
}

function parseSystemInfo(infoStr) {
    if (!infoStr || infoStr === '{}') return {};
    
    // Replace Python None with JavaScript null
    const jsonStr = infoStr
        .replace(/'/g, '"')        // Replace single quotes with double quotes
        .replace(/None/g, 'null')  // Replace Python None with JavaScript null
        .replace(/True/g, 'true')  // Replace Python True with JavaScript true
        .replace(/False/g, 'false'); // Replace Python False with JavaScript false
    
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        console.warn(`Error parsing system info: ${e.message}`);
        return {};
    }
}

function getStarColor(systemData) {
    // Check if it's a special system
    if (SPECIAL_SYSTEMS[systemData.name]) {
        return SPECIAL_SYSTEMS[systemData.name].color;
    }

    // Check population from the information field
    let population = 0;
    if (systemData.information) {
        const info = parseSystemInfo(systemData.information);
        population = info.population || 0;
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
        systemInfo: systemInfo
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
        info += `Distance to Anchor: ${systemData.distance_to_anchor.toFixed(2)} ly<br>`;
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

// Add visibility state - default to false
let showUnclaimedSystems = false;

// Update particle system visibility based on toggle
function updateParticleVisibility() {
    if (particleSystem) {
        particleSystem.visible = showUnclaimedSystems;
    }
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
        }
    });
}

// Add event listener for toggle
document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('showUnclaimedSystems');
    toggle.addEventListener('change', (e) => {
        showUnclaimedSystems = e.target.checked;
        updateParticleVisibility();
    });
});

// Load and parse the CSV data
d3.csv('data/combined_visualization_systems.csv').then(data => {
    // Initialize particle system
    initParticleSystem();
    
    // Filter systems that don't require permits
    const unlockedSystems = data.filter(system => system.requirePermit === 'False');
    
    // Track processed anchor systems to avoid duplicates
    const processedAnchors = new Set();
    
    unlockedSystems.forEach(system => {
        const position = parseCoordinates(system);
        if (position) {
            createStarSystem(system, position);
            
            // Create region label only for anchor systems with non-empty descriptions
            if (system.anchor_description && system.anchor_description.trim() !== '' && !processedAnchors.has(system.anchor_system)) {
                const label = createRegionLabel(position, system.anchor_description);
                regionLabels.set(system.anchor_system, {
                    label: label,
                    position: position.clone()
                });
                processedAnchors.add(system.anchor_system);
                console.log(`Created label for ${system.anchor_system}: ${system.anchor_description}`);
            }
        }
    });

    // Update particle system after all particles are added
    updateParticleSystem();
    updateParticleVisibility(); // Ensure visibility is correct after initialization

    // Center camera on specified coordinates
    const centerCoords = new THREE.Vector3(559.8125, -373.125, -1102.03125);
    camera.position.set(
        centerCoords.x,
        centerCoords.y + 200,
        centerCoords.z + 600
    );
    controls.target.copy(centerCoords);

    // Add grid helper centered on the specified coordinates
    const gridHelper = new THREE.GridHelper(2000, 20);
    gridHelper.position.copy(centerCoords);
    scene.add(gridHelper);
});

// Mouse move handler
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

// Window resize handler
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    updateRegionLabels();
    renderer.render(scene, camera);
}

// Event listeners
window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('resize', onWindowResize, false);

// Start animation
animate();

// Update the CSS style in the HTML file
const style = document.createElement('style');
style.textContent = `
    .region-label {
        background: rgba(0, 0, 0, 0.7);
        padding: 4px 8px;
        border-radius: 12px;
        white-space: nowrap;
        z-index: 50;
        transition: all 0.2s ease-out;
        border: 1px solid rgba(255, 215, 0, 0.4);
        backdrop-filter: blur(4px);
        letter-spacing: 0.5px;
        box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
    }
`;
document.head.appendChild(style); 