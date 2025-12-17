import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createRoom, createFixedCube, createMirrorCube, createDoor, createPlayer } from './objects.js';
import { createLaserLine, updateLaserSystem } from './laser.js';

// --- 1. 씬 및 카메라 설정 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);

const width = window.innerWidth;
const height = window.innerHeight;
const aspect = width / height;

// 1-1. Perspective Camera (원근)
const perspCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
perspCamera.position.set(20, 20, 20);
perspCamera.lookAt(0, 0, 0);

// 1-2. Orthographic Camera (직교)
const frustumSize = 25; // 뷰 크기
const orthoCamera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2, frustumSize * aspect / 2,
    frustumSize / 2, frustumSize / -2,
    0.1, 1000
);
// 직교 뷰 초기 위치 (아이소메트릭 뷰 각도)
orthoCamera.position.set(20, 20, 20);
orthoCamera.lookAt(0, 0, 0);

// 현재 활성 카메라
let activeCamera = perspCamera;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// --- Post-processing ---
// [중요] RenderPass의 카메라는 나중에 switchCamera에서 업데이트해야 함
const renderScene = new RenderPass(scene, activeCamera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.85;
bloomPass.strength = 0.4;
bloomPass.radius = 0.3;

const outputPass = new OutputPass();
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
composer.addPass(outputPass);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
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

const source = createFixedCube(0xff0000, -4.5, -4.5, 4.5, 'source');
scene.add(source);
const sensor = createFixedCube(0x00ff00, 2.5, 2.5, -4.5, 'sensor');
scene.add(sensor);
const door = createDoor();
scene.add(door);
const player = createPlayer();
scene.add(player);

const mirrors = [];
const laserLine = createLaserLine();
scene.add(laserLine);

// --- 3. 컨트롤 및 기즈모 ---
const orbitControls = new OrbitControls(activeCamera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.maxPolarAngle = Math.PI / 2;

// [NEW] 카메라 전환 함수
const btnCamera = document.getElementById('btn-camera');
function switchCamera() {
    if (activeCamera === perspCamera) {
        // Perspective -> Ortho
        activeCamera = orthoCamera;
        btnCamera.innerText = "📐 Orthographic";
        
        // Ortho 모드: 회전 잠금, 줌만 가능
        orbitControls.object = orthoCamera;
        orbitControls.enableRotate = false; // 회전 불가능
        orbitControls.reset(); // 컨트롤 리셋하여 뷰 꼬임 방지
        
        // 보기 좋은 각도로 강제 설정
        orthoCamera.position.set(20, 20, 20);
        orthoCamera.lookAt(0, 0, 0);
        orthoCamera.zoom = 1;
        orthoCamera.updateProjectionMatrix();

    } else {
        // Ortho -> Perspective
        activeCamera = perspCamera;
        btnCamera.innerText = "🎥 Perspective";
        
        // Persp 모드: 자유 회전 가능
        orbitControls.object = perspCamera;
        orbitControls.enableRotate = true;
    }
    
    // Composer(Bloom)의 카메라도 교체해야 함!
    renderScene.camera = activeCamera;
}
btnCamera.addEventListener('click', switchCamera);


function createAxisGizmo() {
    const gizmo = new THREE.Group();
    gizmo.visible = false;
    const radius = 1.3; const tube = 0.02;
    const mat = new THREE.MeshBasicMaterial({ color: 0x888888, toneMapped: false, transparent: true, opacity: 0.8 });
    const torusGeo = new THREE.TorusGeometry(radius, tube, 16, 64);

    const ringX = new THREE.Mesh(torusGeo, mat.clone());
    ringX.rotation.y = Math.PI / 2; ringX.userData = { isGizmo: true, axis: 'x', name: 'X-Axis' };
    gizmo.add(ringX);

    const ringY = new THREE.Mesh(torusGeo, mat.clone());
    ringY.rotation.x = Math.PI / 2; ringY.userData = { isGizmo: true, axis: 'y', name: 'Y-Axis' };
    gizmo.add(ringY);

    const ringZ = new THREE.Mesh(torusGeo, mat.clone());
    ringZ.userData = { isGizmo: true, axis: 'z', name: 'Z-Axis' };
    gizmo.add(ringZ);

    return gizmo;
}
const rotationGizmo = createAxisGizmo();
scene.add(rotationGizmo);


// --- 4. 게임 상태 ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const infoUI = document.getElementById('info');

let selectedCube = null;     
let activeAxis = null;       
let isDragging = false;      
let mouseDownTime = 0;       
let mouseDownPos = new THREE.Vector2();

let isLaserOn = false; 
let lives = 5;
let isSuccess = false;
let failTimer = null;

function highlightCube(cube, isSelected) {
    if (!cube) return;
    const outline = cube.getObjectByName('selectionOutline');
    if (outline) {
        outline.material.color.setHex(isSelected ? 0xffff00 : 0x555555);
        outline.material.linewidth = isSelected ? 2 : 1;
        outline.material.toneMapped = !isSelected;
    }
}

function updateGizmoColors() {
    rotationGizmo.children.forEach(ring => {
        if (activeAxis && ring.userData.axis === activeAxis) {
            ring.material.color.setHex(0xffff00); 
            ring.material.opacity = 1.0;
            ring.scale.setScalar(1.1); 
        } else {
            ring.material.color.setHex(0xaaaaaa); 
            ring.material.opacity = 0.5;
            ring.scale.setScalar(1.0);
        }
    });
}

const sceneParams = { source, sensor, mirrors, door };

function checkLaser() {
    const hit = updateLaserSystem(sceneParams, laserLine, isLaserOn);
    if (isLaserOn) {
        if (hit) {
            isSuccess = true;
            if(failTimer) clearTimeout(failTimer); 
            if(infoUI) {
                infoUI.innerText = "SUCCESS! 문이 열렸습니다!";
                infoUI.style.color = "#00ff00";
            }
        } else {
            isSuccess = false;
        }
    } else {
        isSuccess = false;
    }
}

function updateUI() {
    if(!infoUI) return;
    if(lives <= 0) {
        infoUI.innerText = "GAME OVER (새로고침하세요)";
        infoUI.style.color = "red";
    } else if (isSuccess) {
        // msg
    } else {
        const laserStatus = isLaserOn ? "ON" : "OFF";
        infoUI.innerText = `❤️ Lives: ${lives} | Laser: ${laserStatus} | 🟥 광원을 클릭하여 발사`;
        infoUI.style.color = "white";
    }
}

// --- 5. 이벤트 리스너 ---

window.addEventListener('pointerdown', (event) => {
    if (event.target.closest('#toolbox') || event.target.closest('#ui-layer') || event.target.closest('#btn-camera')) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    mouseDownPos.set(event.clientX, event.clientY);
    mouseDownTime = Date.now();
    // [중요] 현재 활성화된 카메라로 레이캐스팅
    raycaster.setFromCamera(mouse, activeCamera);

    // 1. 기즈모 클릭
    let hitGizmo = false;
    if (selectedCube && rotationGizmo.visible) {
        const gizmoHits = raycaster.intersectObjects(rotationGizmo.children);
        if (gizmoHits.length > 0) {
            const hit = gizmoHits[0].object;
            if (hit.userData.isGizmo) {
                activeAxis = hit.userData.axis;
                updateGizmoColors();
                orbitControls.enabled = false; 
                hitGizmo = true;
                return; 
            }
        }
    }

    if (!hitGizmo) {
        activeAxis = null;
        updateGizmoColors();
        orbitControls.enabled = true;
    }

    // 2. 광원 클릭
    const sourceHits = raycaster.intersectObject(source);
    if (sourceHits.length > 0) {
        if (failTimer) clearTimeout(failTimer);
        isLaserOn = !isLaserOn;
        if (isLaserOn) {
            checkLaser();
            const hit = updateLaserSystem(sceneParams, laserLine, true);
            if (!hit) {
                lives--;
                if(infoUI) {
                    infoUI.innerText = `FAIL! 다시 시도하세요. (남은 목숨: ${lives})`;
                    infoUI.style.color = "orange";
                }
                failTimer = setTimeout(() => {
                    isLaserOn = false;
                    checkLaser();
                    updateUI();
                }, 3000);
            }
        } else {
            checkLaser();
            updateUI();
        }
        return;
    }

    // 3. 반사 큐브 드래그
    const intersects = raycaster.intersectObjects(mirrors);
    if (intersects.length > 0) {
        let target = intersects[0].object;
        while(target.parent && !mirrors.includes(target)) { target = target.parent; }
        
        if (mirrors.includes(target)) {
            isDragging = true; 
            orbitControls.enabled = false; 
            window.dragTarget = target; 
        }
    } else {
        isDragging = false;
    }
});

window.addEventListener('pointermove', (event) => {
    if (isDragging && window.dragTarget) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, activeCamera); // 활성 카메라 사용

        const intersects = raycaster.intersectObjects(surfaces);
        if (intersects.length > 0) {
            const hit = intersects[0];
            const faceNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).round();
            const targetPos = hit.point.clone().add(faceNormal.multiplyScalar(0.5));
            const snap = (val) => Math.floor(val) + 0.5;
            targetPos.x = snap(targetPos.x); targetPos.y = snap(targetPos.y); targetPos.z = snap(targetPos.z);
            const limit = (ROOM_SIZE / 2) - 0.5;
            targetPos.x = Math.max(-limit, Math.min(limit, targetPos.x));
            targetPos.y = Math.max(-limit, Math.min(limit, targetPos.y));
            targetPos.z = Math.max(-limit, Math.min(limit, targetPos.z));
            
            window.dragTarget.position.copy(targetPos);
            if (selectedCube === window.dragTarget) {
                rotationGizmo.position.copy(targetPos);
            }
            if (isLaserOn) checkLaser();
        }
        return;
    }

    if (selectedCube && rotationGizmo.visible && !activeAxis) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, activeCamera);
        const hits = raycaster.intersectObjects(rotationGizmo.children);
        
        rotationGizmo.children.forEach(r => {
            if (r.userData.axis !== activeAxis) {
                r.material.color.setHex(0xaaaaaa);
                r.material.opacity = 0.5;
                r.scale.setScalar(1.0);
            }
        });

        if (hits.length > 0) {
            hits[0].object.material.color.setHex(0xffffff);
            hits[0].object.material.opacity = 1.0;
            hits[0].object.scale.setScalar(1.05);
        }
    }
});

window.addEventListener('pointerup', (event) => {
    const timeDiff = Date.now() - mouseDownTime;
    const distDiff = new THREE.Vector2(event.clientX, event.clientY).distanceTo(mouseDownPos);
    isDragging = false; 
    orbitControls.enabled = true;
    const releasedCube = window.dragTarget; 
    window.dragTarget = null;

    if (timeDiff < 200 && distDiff < 5) {
        if (activeAxis) return; 
        
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, activeCamera);
        if (rotationGizmo.visible && raycaster.intersectObjects(rotationGizmo.children).length > 0) return;

        if (releasedCube) {
            // 선택 토글 로직 제거 -> 무조건 선택 (사용자 피드백 반영)
            // 대신, 다른 걸 누르면 교체
            if (selectedCube) highlightCube(selectedCube, false);
            
            selectedCube = releasedCube; 
            highlightCube(selectedCube, true);
            
            rotationGizmo.visible = true; 
            rotationGizmo.position.copy(selectedCube.position);
            activeAxis = null; 
            updateGizmoColors();
        } else {
            // 빈 공간 -> 해제
            if (selectedCube) {
                highlightCube(selectedCube, false);
                selectedCube = null;
                rotationGizmo.visible = false;
                activeAxis = null;
                updateUI();
            }
        }
    }
});

window.addEventListener('wheel', (event) => {
    if (selectedCube && activeAxis) {
        const direction = event.deltaY > 0 ? -1 : 1; 
        const angle = (Math.PI / 2) * direction;
        
        const worldX = new THREE.Vector3(1, 0, 0);
        const worldY = new THREE.Vector3(0, 1, 0);
        const worldZ = new THREE.Vector3(0, 0, 1);

        if (activeAxis === 'x') selectedCube.rotateOnWorldAxis(worldX, angle);
        else if (activeAxis === 'y') selectedCube.rotateOnWorldAxis(worldY, angle);
        else if (activeAxis === 'z') selectedCube.rotateOnWorldAxis(worldZ, angle);
        
        selectedCube.updateMatrixWorld();
        if(isLaserOn) checkLaser();
    }
}, { passive: false });


// --- 6. 초기화 및 루프 ---
document.getElementById('btn-add-mirror').addEventListener('click', () => {
    const newCube = createMirrorCube(0.5, -4.5, 0.5);
    scene.add(newCube); mirrors.push(newCube);
    
    if (selectedCube) {
        highlightCube(selectedCube, false);
        selectedCube = null;
        rotationGizmo.visible = false;
        activeAxis = null;
    }
    
    updateGizmoColors();
    updateUI();
});

updateUI();

function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();

    const doorPanel = door.userData.panel;
    if (isSuccess) {
        if (doorPanel.position.y < 3) doorPanel.position.y += 0.05;
    } else {
        if (doorPanel.position.y > 0) doorPanel.position.y -= 0.05;
    }
    composer.render();
}
animate();

window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    // Perspective 업데이트
    perspCamera.aspect = aspect;
    perspCamera.updateProjectionMatrix();

    // Orthographic 업데이트 (Frustum 유지)
    orthoCamera.left = -frustumSize * aspect / 2;
    orthoCamera.right = frustumSize * aspect / 2;
    orthoCamera.top = frustumSize / 2;
    orthoCamera.bottom = -frustumSize / 2;
    orthoCamera.updateProjectionMatrix();

    renderer.setSize(width, height);
    composer.setSize(width, height);
    
    // 해상도 전달은 Line2를 안 쓰므로 제거 (CylinderGeometry는 필요 없음)
});