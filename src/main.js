import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { createRoom, createFixedCube, createMirrorCube, createDoor, createPlayer } from './objects.js';
import { createLaserLine, updateLaserSystem } from './laser.js';

// --- 1. 씬 및 카메라 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505); // 어두운 배경

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

// 벽면 감지 대상
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

// --- 3. 컨트롤 및 회전 기즈모 (수정됨) ---
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.maxPolarAngle = Math.PI / 2;

// [NEW] 곡선 화살표 생성 헬퍼 함수
function createCurvedArrow(axis, direction) {
    const group = new THREE.Group();
    const radius = 1.0; // 큐브보다 약간 크게
    const tube = 0.05;  // 튜브 두께
    const color = 0xffffff; // 무조건 흰색

    // 1. 튜브 (몸통) - 90도(PI/2) 가량의 아치
    const arc = Math.PI / 2.5; 
    const torusGeo = new THREE.TorusGeometry(radius, tube, 6, 12, arc);
    const torusMat = new THREE.MeshBasicMaterial({ color: color });
    const body = new THREE.Mesh(torusGeo, torusMat);
    
    // 튜브 위치 조정 (중앙 정렬)
    body.rotation.z = -arc / 2; 

    // 2. 원뿔 (머리)
    const coneGeo = new THREE.ConeGeometry(tube * 3, tube * 6, 12);
    const coneMat = new THREE.MeshBasicMaterial({ color: color });
    const head = new THREE.Mesh(coneGeo, coneMat);
    
    // 머리 위치: 아치 끝부분
    head.position.x = radius * Math.cos(arc / 2);
    head.position.y = radius * Math.sin(arc / 2);
    // 머리 회전: 접선 방향
    head.rotation.z = arc / 2 + Math.PI / 2; 
    // 반대 방향 회전일 경우 머리를 반대쪽 끝에 붙임
    if (direction < 0) {
        head.position.x = radius * Math.cos(-arc / 2);
        head.position.y = radius * Math.sin(-arc / 2);
        head.rotation.z = -arc / 2 - Math.PI / 2;
    }

    // 그룹에 추가 및 데이터 설정 (클릭 감지용)
    const userData = { isGizmo: true, axis: axis, angle: direction * Math.PI / 2 };
    body.userData = userData;
    head.userData = userData;
    
    group.add(body);
    group.add(head);

    // 3. 축에 따른 전체 그룹 회전 및 배치
    // 기본 Torus는 XY 평면에 누워 있음 (Z축 기준 회전)
    if (axis === 'x') {
        // X축 기준 회전 -> YZ 평면에 위치해야 함 -> Y축으로 90도 회전
        group.rotation.y = Math.PI / 2;
        // 방향에 따라 위/아래 배치 구분 등을 위해 추가 회전 필요하면 여기서 조정
        // 여기서는 단순히 시각적 구분을 위해 위치만 조금씩 띄움 안해도 됨
    } else if (axis === 'y') {
        // Y축 기준 회전 -> XZ 평면에 위치해야 함 -> X축으로 90도 회전
        group.rotation.x = Math.PI / 2;
    } else if (axis === 'z') {
        // Z축 기준 회전 -> XY 평면 (기본값)
    }

    return group;
}

// [NEW] 회전 기즈모 생성 함수 (곡선 화살표 조합)
function createRotationGizmo() {
    const gizmo = new THREE.Group(); 
    gizmo.visible = false;
    
    // 6방향 곡선 화살표 생성
    
    // 1. X축 회전 (YZ 평면)
    const xPos = createCurvedArrow('x', 1); // +90도
    const xNeg = createCurvedArrow('x', -1); // -90도
    xNeg.rotation.x = Math.PI; // 반대편에 위치시키기 위해 뒤집음
    
    // 2. Y축 회전 (XZ 평면)
    const yPos = createCurvedArrow('y', 1);
    const yNeg = createCurvedArrow('y', -1);
    yNeg.rotation.z = Math.PI; // 반대편

    // 3. Z축 회전 (XY 평면)
    const zPos = createCurvedArrow('z', 1);
    const zNeg = createCurvedArrow('z', -1);
    zNeg.rotation.x = Math.PI; // 반대편

    // 그룹에 추가
    gizmo.add(xPos, xNeg, yPos, yNeg, zPos, zNeg);
    
    return gizmo;
}

const rotationGizmo = createRotationGizmo();
scene.add(rotationGizmo);


// --- 4. 인터랙션 로직 ---
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

    // 1. 회전 모드일 때 Gizmo 클릭 처리
    if (isRotMode && rotationGizmo.visible) {
        // Gizmo의 자식들(그룹)의 자식들(메쉬)까지 검사해야 함
        const gizmoHits = raycaster.intersectObjects(rotationGizmo.children, true);
        
        // 클릭된 것 중 userData.isGizmo가 있는 첫 번째 물체 찾기
        const hit = gizmoHits.find(h => h.object.userData.isGizmo);

        if (hit && selectedCube) {
            const data = hit.object.userData;
            // 해당 축으로 90도 회전
            if (data.axis === 'x') selectedCube.rotateX(data.angle);
            if (data.axis === 'y') selectedCube.rotateY(data.angle);
            if (data.axis === 'z') selectedCube.rotateZ(data.angle);
            
            // 회전 후 업데이트
            updateLaserSystem({ source, sensor, mirrors, door }, laserLine);
            return; 
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

// 4-2. Pointer Move
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


// --- 5. UI 버튼 & 단축키 ---
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
                const status = isRotMode ? "🔄 ROTATION MODE" : "↔️ MOVE MODE";
                if(infoUI) infoUI.innerText = `${status}: 흰색 화살표를 눌러 회전`;
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


// --- 6. 애니메이션 루프 ---
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