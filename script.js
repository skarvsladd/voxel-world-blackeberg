// Import the full Three.js module and the pointer lock controls from the same version.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/PointerLockControls.js';

let scene, camera, renderer, controls;
const cubes = [];
const move = { forward: false, backward: false, left: false, right: false };
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
let selected = null;

/**
 * Initialize the Three.js scene, camera, renderer and controls.
 */
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // sky blue

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(0, 200, 100);
    scene.add(dirLight);

    // Ground plane
    const groundGeo = new THREE.BoxGeometry(200, 1, 200);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a5f0b });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.5;
    scene.add(ground);

    // Pointer lock controls
    controls = new PointerLockControls(camera, document.body);
    document.body.addEventListener('click', () => {
        if (!controls.isLocked) controls.lock();
    });

    // Event listeners for movement
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onWindowResize);

    // Interaction events
    window.addEventListener('click', onLeftClick, false);
    window.addEventListener('contextmenu', onRightClick, false);

    // Load map data and start animation loop
    loadMapData();
    animate();
}

/**
 * Handle window resize to adjust camera and renderer.
 */
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Handle keydown events to start movement.
 * @param {KeyboardEvent} event
 */
function onKeyDown(event) {
    switch (event.code) {
        case 'KeyW': move.forward = true; break;
        case 'KeyS': move.backward = true; break;
        case 'KeyA': move.left = true; break;
        case 'KeyD': move.right = true; break;
    }
}

/**
 * Handle keyup events to stop movement.
 * @param {KeyboardEvent} event
 */
function onKeyUp(event) {
    switch (event.code) {
        case 'KeyW': move.forward = false; break;
        case 'KeyS': move.backward = false; break;
        case 'KeyA': move.left = false; break;
        case 'KeyD': move.right = false; break;
    }
}

/**
 * Load building map data from Overpass API for Blackeberg area and create voxel cubes.
 */
function loadMapData() {
    // Bounding box for Blackeberg (approximate lat/lon)
    const bbox = [59.344, 17.891, 59.348, 17.902]; // south, west, north, east
    // Overpass API query to fetch buildings and their center points
    const query = `[out:json][timeout:25];(way["building"](${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}););out center;`;
    fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query
    })
    .then(res => res.json())
    .then(data => {
        data.elements.forEach(el => {
            if (el.type === 'way' && el.center) {
                const lat = el.center.lat;
                const lon = el.center.lon;
                // Convert lat/lon to x,z coordinates relative to bounding box
                const scale = 10000; // scale factor to convert degrees to world units
                const x = (lon - bbox[1]) * scale;
                const z = (bbox[2] - lat) * scale;
                const height = 8 + Math.random() * 12; // randomize building height for variety
                const geo = new THREE.BoxGeometry(4, height, 4);
                const mat = new THREE.MeshStandardMaterial({ color: 0xb0b0b0 });
                const building = new THREE.Mesh(geo, mat);
                building.position.set(x, height / 2, z);
                scene.add(building);
                cubes.push(building);
            }
        });
        // If no cubes were created (e.g. API returned no data), add placeholder cubes
        if (cubes.length === 0) {
            addPlaceholderCubes();
        }
    })
    .catch(err => {
        console.error('Failed to load map data:', err);
        // When the API call fails, add placeholder cubes so the world isn't empty
        addPlaceholderCubes();
    });
}

/**
 * Handle left click events to remove cubes.
 * @param {MouseEvent} event
 */
function onLeftClick(event) {
    if (!controls.isLocked) return;
    raycast();
    if (selected) {
        scene.remove(selected);
        const idx = cubes.indexOf(selected);
        if (idx > -1) cubes.splice(idx, 1);
        selected = null;
    }
}

/**
 * Handle right click events to add cubes above the selected cube.
 * @param {MouseEvent} event
 */
function onRightClick(event) {
    event.preventDefault();
    if (!controls.isLocked) return;
    raycast();
    if (selected) {
        const pos = selected.position.clone();
        const size = 4;
        const geo = new THREE.BoxGeometry(size, size, size);
        const mat = new THREE.MeshStandardMaterial({ color: 0x8888ff });
        const newCube = new THREE.Mesh(geo, mat);
        newCube.position.set(pos.x, pos.y + size, pos.z);
        scene.add(newCube);
        cubes.push(newCube);
    }
}

/**
 * Perform a raycast from the camera to detect the first intersected cube.
 */
function raycast() {
    // Use center of screen for raycasting; pointer stays at (0, 0) in NDC when pointer lock is active
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(cubes);
    selected = intersects.length > 0 ? intersects[0].object : null;
}

/**
 * Add a simple grid of placeholder cubes when map data isn't available.
 */
function addPlaceholderCubes() {
    // Create a 5x5 grid of cubes centered around the origin
    for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
            const height = 4;
            const geo = new THREE.BoxGeometry(4, height, 4);
            const mat = new THREE.MeshStandardMaterial({ color: 0x8080ff });
            const cube = new THREE.Mesh(geo, mat);
            cube.position.set(i * 6, height / 2, j * 6);
            scene.add(cube);
            cubes.push(cube);
        }
    }
}

/**
 * Animation loop; handles movement and rendering.
 */
function animate() {
    requestAnimationFrame(animate);

    if (controls.isLocked) {
        const dt = 0.05;
        // Calculate direction vector from movement flags
        direction.set(0, 0, 0);
        if (move.forward) direction.z -= 1;
        if (move.backward) direction.z += 1;
        if (move.left) direction.x -= 1;
        if (move.right) direction.x += 1;
        direction.normalize();
        velocity.x = direction.x * 5;
        velocity.z = direction.z * 5;
        controls.moveRight(velocity.x * dt);
        controls.moveForward(velocity.z * dt);
    }

    renderer.render(scene, camera);
}

// Initialize everything
init();