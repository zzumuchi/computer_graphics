import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { createRoom, createFixedCube, createMirrorCube, createDoor, createPlayer } from './objects.js';
import { createLaserLine, updateLaserSystem } from './laser.js';

// --- 1. 씬 및 카메라 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(20, 20, 20);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// --- 2. 맵 배치 ---
const ROOM_SIZE = 10;
const roomGroup = createRoom(ROOM_SIZE);
scene.add(roomGroup);

const surfaces = [];
roomGroup.traverse((child) => {
    if (child.isMesh && child.userData.isSurface) {
        surfaces.push(child);
    }
});

const source = createFixedCube(0xff0000, -4.5, -4.5, 4.5);
scene.add(source);
const sensor = createFixedCube(0x00ff00, 2.5, 2.5, -4.5);
scene.add(sensor);
const door = createDoor();
scene.add(door);
const player = createPlayer();
scene.add(player);

const mirrors = [];
const laserLine = createLaserLine();
scene.add(laserLine);

// --- 3. 컨트롤 및 회전 기즈모 ---
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.maxPolarAngle = Math.PI / 2;

// [삼각형 화살표 기즈모 - 2개로 축소]
function createTriangleGizmo() {
    const gizmo = new THREE.Group();
    gizmo.visible = false;

    const arrowGeo = new THREE.ConeGeometry(0.2, 0.4, 16);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); // 흰색

    const dist = 0.8; 
    
    // [핵심 수정] 화살표를 2개(X축용, Y축용)만 남김
    const directions = [
        // 1. Right (+X 위치): Y축 기준 회전 (수평 회전)
        // 오른쪽을 가리키는 화살표 -> 수직인 Y축 기준 회전
        { 
            name: 'Rotate Y',
            pos: [dist, 0, 0], 
            rot: [0, 0, -Math.PI/2], // 오른쪽(→)을 향함
            axis: 'y', 
            angle: -Math.PI/2 
        },
        
        // 2. Up (+Y 위치): X축 기준 회전 (수직 회전)
        // 위쪽을 가리키는 화살표 -> 수직인 X축 기준 회전
        { 
            name: 'Rotate X',
            pos: [0, dist, 0], 
            rot: [0, 0, 0], // 위쪽(↑)을 향함
            axis: 'x', 
            angle: -Math.PI/2 
        }
    ];

    directions.forEach(d => {
        const arrow = new THREE.Mesh(arrowGeo, arrowMat);
        arrow.position.set(...d.pos);
        arrow.rotation.set(...d.rot);
        
        arrow.userData = { 
            isGizmo: true, 
            axis: d.axis, 
            angle: d.angle 
        };
        gizmo.add(arrow);
    });

    return gizmo;
}

const rotationGizmo = createTriangleGizmo();
scene.add(rotationGizmo);


// --- 4. 인터랙션 ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedCube = null;
let isDragging = false;
let isRotMode = false;
const infoUI = document.getElementById('info');

// 4-1. Pointer Down
window.addEventListener('pointerdown', (event) => {
    if (event.target.closest('#toolbox') || event.target.closest('#ui-layer')) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // 1. 기즈모(화살표) 클릭
    if (isRotMode && rotationGizmo.visible) {
        const gizmoHits = raycaster.intersectObjects(rotationGizmo.children);
        if (gizmoHits.length > 0) {
            const data = gizmoHits[0].object.userData;
            if (data.isGizmo && selectedCube) {
                // 회전 적용
                if (data.axis === 'x') selectedCube.rotateX(data.angle);
                if (data.axis === 'y') selectedCube.rotateY(data.angle);
                // Z축 회전은 제거됨
                
                updateLaserSystem({ source, sensor, mirrors, door }, laserLine);
                return;
            }
        }
    }

    // 2. 큐브 선택
    const intersects = raycaster.intersectObjects(mirrors);
    if (intersects.length > 0) {
        let target = intersects[0].object;
        while(target.parent && !mirrors.includes(target)) {
             target = target.parent;
        }
        
        if (mirrors.includes(target)) {
            selectedCube = target;
            isDragging = true;
            orbitControls.enabled = false;
            
            rotationGizmo.position.copy(selectedCube.position);
            if (isRotMode) rotationGizmo.visible = true;
        }
    } else {
        if (!isRotMode) {
            selectedCube = null;
            rotationGizmo.visible = false;
        }
        isDragging = false;
    }
});

// 4-2. Pointer Move (드래그)
window.addEventListener('pointermove', (event) => {
    if (isRotMode || !isDragging || !selectedCube) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(surfaces);

    if (intersects.length > 0) {
        const hit = intersects[0];
        const hitPoint = hit.point;
        const faceNormal = hit.face.normal.clone();
        faceNormal.transformDirection(hit.object.matrixWorld).round();

        const targetPos = hitPoint.clone().add(faceNormal.multiplyScalar(0.5));
        
        const snap = (val) => Math.floor(val) + 0.5;
        targetPos.x = snap(targetPos.x);
        targetPos.y = snap(targetPos.y);
        targetPos.z = snap(targetPos.z);

        const limit = (ROOM_SIZE / 2) - 0.5;
        targetPos.x = Math.max(-limit, Math.min(limit, targetPos.x));
        targetPos.y = Math.max(-limit, Math.min(limit, targetPos.y));
        targetPos.z = Math.max(-limit, Math.min(limit, targetPos.z));

        selectedCube.position.copy(targetPos);
        rotationGizmo.position.copy(targetPos); 
    }
});

// 4-3. Pointer Up
window.addEventListener('pointerup', () => {
    isDragging = false;
    orbitControls.enabled = true;
});


// --- 5. UI 및 루프 ---
document.getElementById('btn-add-mirror').addEventListener('click', () => {
    const newCube = createMirrorCube(0.5, -4.5, 0.5);
    scene.add(newCube);
    mirrors.push(newCube);
    
    selectedCube = newCube;
    rotationGizmo.position.copy(newCube.position);
    if (isRotMode) rotationGizmo.visible = true;
});

window.addEventListener('keydown', (event) => {
    switch (event.key.toLowerCase()) {
        case 'r': 
            if (selectedCube) {
                isRotMode = !isRotMode;
                rotationGizmo.visible = isRotMode;
                rotationGizmo.position.copy(selectedCube.position);
                const status = isRotMode ? "🔄 ROTATION" : "↔️ MOVE";
                if(infoUI) infoUI.innerText = `${status}: 화살표(→, ↑)를 눌러 회전`;
            }
            break;
        case 'escape':
            selectedCube = null;
            isRotMode = false;
            rotationGizmo.visible = false;
            if(infoUI) infoUI.innerText = "큐브를 선택하세요";
            break;
        case 'delete': case 'backspace':
            if (selectedCube) {
                scene.remove(selectedCube);
                mirrors.splice(mirrors.indexOf(selectedCube), 1);
                selectedCube = null;
                rotationGizmo.visible = false;
            }
            break;
    }
});

const sceneParams = { source, sensor, mirrors, door };
function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();
    updateLaserSystem(sceneParams, laserLine);
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});