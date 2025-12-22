import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
// [중요 수정] createDispersionCube 제거 (objects.js에 없어서 에러 발생했음)
import { createBrickRoom, createFixedCube, createMirrorCube, createFixedObstacle,
    createTrapezoidMirrorCube, createHalfMirrorCube, createPlayer, createFixedDoubleMirror, 
    createLaserSource, createLaserSensor, createColorSensor } from './objects.js'; 
import { createLaserLine, updateLaserSystem } from './laser.js';
import { STAGES } from './stages.js'; 

// --- 상수 설정 ---
let MAP_SIZE = 15; 
let HALF_MAP = MAP_SIZE / 2; 
let FLOOR_SURFACE_Y = -HALF_MAP; 
const EYE_LEVEL = 2.0; 

// --- 1. 씬 및 카메라 설정 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const width = window.innerWidth;
const height = window.innerHeight;
const aspect = width / height;

// 1-1. Perspective Camera (3D)
const perspCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
perspCamera.position.set(25, 25, 25);
perspCamera.lookAt(0, 0, 0);

// 1-2. Orthographic Camera (2D 정면/측면/탑뷰용)
// 초기값은 임시이며 loadStage나 resize에서 갱신됨
let frustumSize = 30; 
const orthoCamera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2, frustumSize * aspect / 2,
    frustumSize / 2, frustumSize / -2,
    0.1, 1000
);
orthoCamera.position.set(0, 20, 0);
orthoCamera.lookAt(0, 0, 0);

let activeCamera = perspCamera;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// --- Post-processing ---
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

// 조명 설정
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.0); 
dirLight.position.set(20, 50, 20); 
dirLight.target.position.set(0, 0, 0); 
dirLight.castShadow = true; 
dirLight.shadow.bias = -0.0001; 
dirLight.shadow.mapSize.width = 2048; 
dirLight.shadow.mapSize.height = 2048;
const d = 50; 
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;

scene.add(dirLight);
scene.add(dirLight.target); 

// --- 2. 룸 및 오브젝트 생성 ---
let roomGroup = createBrickRoom(MAP_SIZE);
scene.add(roomGroup);

const surfaces = [];
roomGroup.traverse(c => { 
    if(c.isMesh && c.userData.isSurface) surfaces.push(c); 
});

const laserLine = createLaserLine();
scene.add(laserLine);

// --- 3. 변수 초기화 ---
let source = null;
let sensors = [];
let mirrors = [];
const sceneParams = { source, sensors, mirrors };

let currentStageIndex = 0;
let isLaserOn = false;
let isSuccess = false;
let lives = 5;
let failTimer = null;
let isCleared = false; 

// --- UI 요소 참조 ---
const infoUI = document.getElementById('info');
const elLifeText = document.getElementById('life-text');
const elCameraText = document.getElementById('camera-text');
const elLaserText = document.getElementById('laser-text');
// 스테이지 트랜지션 화면
const elStageTransition = document.getElementById('stage-transition');
const elStNum = document.getElementById('st-stage-num');
const elStTitle = document.getElementById('st-title');
const elStDesc = document.getElementById('st-desc');
// 버튼들
const btnAddMirror = document.getElementById('btn-add-mirror');
const btnAddTrapezoid = document.getElementById('btn-add-trapezoid');
const btnAddHalf = document.getElementById('btn-add-half');
const crosshair = document.getElementById('crosshair');

// 컨트롤 관련
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedCube = null;     
let activeAxis = null;       
let isDragging = false;      
let mouseDownTime = 0;       

// --- 가이드라인 및 기즈모 ---
function createGuideLines() {
    const group = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 });
    const length = 100;
    const geoX = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-length, 0, 0), new THREE.Vector3(length, 0, 0)]);
    group.add(new THREE.Line(geoX, mat));
    const geoY = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -length, 0), new THREE.Vector3(0, length, 0)]);
    group.add(new THREE.Line(geoY, mat));
    const geoZ = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -length), new THREE.Vector3(0, 0, length)]);
    group.add(new THREE.Line(geoZ, mat));
    group.visible = false;
    return group;
}
const guideLines = createGuideLines();
scene.add(guideLines);

function createAxisGizmo() {
    const gizmo = new THREE.Group();
    gizmo.visible = false;
    const radius = 1.3; const tube = 0.08;
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

// --- 4. 플레이어 및 컨트롤러 ---
const playerMesh = createPlayer();
const controls = new PointerLockControls(perspCamera, document.body);
const playerGroup = controls.getObject(); 
playerMesh.position.set(0, -1.0, 0); 
playerGroup.add(playerMesh); 
scene.add(playerGroup);      

const orbitControls = new OrbitControls(activeCamera, renderer.domElement);
orbitControls.enableDamping = true; 
orbitControls.dampingFactor = 0.05;

const moveState = { forward: false, backward: false, left: false, right: false };
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const clock = new THREE.Clock();
const SENSITIVITY = 150.0;
const CameraMode = { FIRST_PERSON: 0, PERSPECTIVE: 1, TOP: 2, FRONT: 3, SIDE: 4 };
let currentMode = CameraMode.FIRST_PERSON;

// --- 5. 스테이지 로드 함수 ---
function updateGlobalBoundaries(size) {
    MAP_SIZE = size;
    HALF_MAP = size / 2;
    FLOOR_SURFACE_Y = -HALF_MAP;
}

function loadStage(index) {
    const data = STAGES[index];
    if (!data) {
        alert("모든 스테이지 클리어! 축하합니다!");
        location.reload();
        return;
    }
    currentStageIndex = index;

    // [요청 반영] 스테이지 전환 시 검은 배경 및 설명 표시
    if (elStNum) elStNum.innerText = `STAGE ${data.id}`;
    if (elStTitle) elStTitle.innerText = (data.msg && data.msg.includes(':')) ? data.msg.split(':')[1].trim() : "LIGHT LABYRINTH";
    if (elStDesc) elStDesc.innerText = data.desc || "거울을 배치해 빛을 연결하세요.";

    if (elStageTransition) {
        elStageTransition.classList.add('active'); // CSS opacity: 1
        setTimeout(() => {
            elStageTransition.classList.remove('active');
        }, 2500);
    }

    // 맵 사이즈 업데이트
    MAP_SIZE = data.mapSize || 15; 
    HALF_MAP = MAP_SIZE / 2;
    FLOOR_SURFACE_Y = -HALF_MAP;
    updateGlobalBoundaries(MAP_SIZE);

    if (roomGroup) scene.remove(roomGroup);
    roomGroup = createBrickRoom(MAP_SIZE); 
    scene.add(roomGroup);

    surfaces.length = 0;
    roomGroup.traverse(c => { 
        if(c.isMesh && c.userData.isSurface) surfaces.push(c); 
    });

    // [요청 반영] 오쏘그래픽(2D) 뷰 사이즈 정상화
    const aspect = window.innerWidth / window.innerHeight;
    frustumSize = MAP_SIZE * 1.5; 
    orthoCamera.left = -frustumSize * aspect / 2;
    orthoCamera.right = frustumSize * aspect / 2;
    orthoCamera.top = frustumSize / 2;
    orthoCamera.bottom = -frustumSize / 2;
    orthoCamera.updateProjectionMatrix();

    // 오브젝트 초기화
    playerGroup.position.set(0, FLOOR_SURFACE_Y + EYE_LEVEL, 0);

    if (source) scene.remove(source);
    sensors.forEach(s => scene.remove(s));
    sensors = [];
    mirrors.forEach(m => scene.remove(m));
    mirrors = [];
    
    source = createLaserSource(data.sourcePos[0], data.sourcePos[1], data.sourcePos[2], data.sourceDir);
    scene.add(source);

    if (data.sensorData && Array.isArray(data.sensorData)) {
        data.sensorData.forEach(sData => {
            const s = createLaserSensor(sData.pos[0], sData.pos[1], sData.pos[2], sData.dir, sData.color);
            scene.add(s);
            sensors.push(s);
        });
    }

    if (data.fixedElements) {
        data.fixedElements.forEach(el => {
            if (el.type === 'obstacle') {
                const size = el.size || [1, 1, 1];
                const obs = createFixedObstacle(el.pos[0], el.pos[1], el.pos[2], size[0], size[1], size[2], el.color);
                scene.add(obs); mirrors.push(obs); 
            } else if (el.type === 'fixedMirror') {
                const fm = createMirrorCube(...el.pos);
                fm.userData.draggable = false; fm.rotation.set(...el.rotation);
                scene.add(fm); mirrors.push(fm);
            } else if (el.type === 'doubleMirror') {
                const dm = createFixedDoubleMirror(el.pos[0], el.pos[1], el.pos[2], el.rotation || [0, 0, 0]);
                dm.userData.draggable = el.draggable !== undefined ? el.draggable : false;
                scene.add(dm); mirrors.push(dm);
            }
        });
    }

    isSuccess = false;
    isLaserOn = false;
    isCleared = false;
    scene.background = new THREE.Color(0x000000);

    if (selectedCube) highlightCube(selectedCube, false);
    selectedCube = null;
    guideLines.visible = false;
    rotationGizmo.visible = false;

    sceneParams.source = source;
    sceneParams.sensors = sensors;
    sceneParams.mirrors = mirrors;
    
    updateUI();
    setCameraMode(CameraMode.PERSPECTIVE);
}

// [요청 반영] 하단은 설명만, 우측 상단은 상태창만 표시
function updateUI() {
    const data = STAGES[currentStageIndex];
    if (!data) return;

    // 1. 거울 개수 카운트
    const currentCounts = { triangle: 0, trapezoid: 0, half: 0 };
    mirrors.forEach(m => {
        if (m.userData.draggable !== false) {
            if (m.userData.mirrorType === 'triangle') currentCounts.triangle++;
            else if (m.userData.mirrorType === 'trapezoid') currentCounts.trapezoid++;
            else if (m.userData.mirrorType === 'half') currentCounts.half++;
        }
    });

    const updateButton = (btn, type, label) => {
        if (!btn) return;
        const max = (data.maxMirrors && data.maxMirrors[type]) ? data.maxMirrors[type] : 0;
        const remain = max - currentCounts[type];
        btn.disabled = (remain <= 0);
        btn.innerText = remain > 0 ? `${label} (${remain})` : `${label} (0)`;
        btn.style.opacity = remain > 0 ? 1 : 0.4;
    };

    updateButton(btnAddMirror, 'triangle', '🪞 삼각 거울');
    updateButton(btnAddTrapezoid, 'trapezoid', '📐 사다리꼴');
    updateButton(btnAddHalf, 'half', '▮ 직육면체');

    // 2. 우측 상단 패널 (Lives, Laser, View Mode)
    if (elLifeText) elLifeText.innerText = `Lives: ${lives}`;
    if (elLaserText) {
        elLaserText.innerText = isLaserOn ? "Laser: ON" : "Laser: OFF";
        elLaserText.style.color = isLaserOn ? "#ffff55" : "#888";
    }

    // 3. 하단 UI (Lives 같은 중복 정보 빼고 설명만)
    if (infoUI) {
        infoUI.innerHTML = data.desc || "목표: 빛을 연결하여 센서를 작동시키세요.";
        infoUI.style.color = "#00ff00";
    }

    if(lives <= 0) {
        document.getElementById('game-over-screen').style.display = 'flex';
        controls.unlock();
        isLaserOn = false;
        updateLaserSystem(sceneParams, laserLine, false);
    }
}

function checkLaser() {
    updateLaserSystem(sceneParams, laserLine, isLaserOn);
    const allSensorsHit = sensors.length > 0 && sensors.every(s => s.userData.isHit);
    
    if (isLaserOn && allSensorsHit) {
        if (!isCleared) {
            isCleared = true; 
            isSuccess = true;
            if(failTimer) clearTimeout(failTimer); 
            if(infoUI) {
                infoUI.innerText = "SUCCESS! 벽이 무너집니다!";
                infoUI.style.color = "#00ff00";
            }
            
            roomGroup.children.forEach(wrapper => {
                if (!wrapper.name.startsWith("Wall")) return;
                const solid = wrapper.children.find(c => c.userData.type === 'solidWall');
                const bricks = wrapper.children.find(c => c.userData.type === 'brickGroup');
                if (solid) solid.visible = false; 
                if (bricks) {
                    bricks.visible = true; 
                    bricks.children.forEach(b => {
                        if (!b.userData.initialPos) b.userData.initialPos = b.position.clone();
                        b.position.copy(b.userData.initialPos);
                        b.rotation.set(0,0,0);
                        b.visible = true;
                    });
                }
            });

            setTimeout(() => {
                loadStage(currentStageIndex + 1);
            }, 5000);
        }
    } else {
        isSuccess = false;
    }
}

// --- 6. 애니메이션 ---
function updateWallTransparency() {
    if (currentMode === CameraMode.FIRST_PERSON) {
        roomGroup.traverse(c => { if(c.material) c.material.opacity = 1.0; });
        return;
    }
    const cx = activeCamera.position.x;
    const cz = activeCamera.position.z;
    const limit = HALF_MAP; 
    const fadeOpacity = 0.2;

    const setOpacity = (wallName, opacity) => {
        const wrapper = roomGroup.getObjectByName(wallName);
        if(wrapper) {
            wrapper.children.forEach(child => {
                if (!child.visible) return; 
                if (child.userData.type === 'solidWall') {
                    child.material.opacity = opacity;
                    child.material.depthWrite = (opacity > 0.5); 
                } else if (child.userData.type === 'brickGroup') {
                    child.children.forEach(brick => {
                        brick.material.opacity = opacity;
                        brick.material.depthWrite = (opacity > 0.5);
                    });
                }
            });
        }
    };
    setOpacity('Wall_Right', (cx > limit) ? fadeOpacity : 1.0);
    setOpacity('Wall_Left',  (cx < -limit) ? fadeOpacity : 1.0);
    setOpacity('Wall_Front', (cz > limit) ? fadeOpacity : 1.0);
    setOpacity('Wall_Back',  (cz < -limit) ? fadeOpacity : 1.0);
}

function animateCrumble() {
    if (!isCleared) return;
    roomGroup.traverse(child => {
        if (child.userData.isBrick && child.parent.visible) {
            child.position.add(child.userData.velocity);
            child.rotation.x += child.userData.rotVel.x;
            child.rotation.y += child.userData.rotVel.y;
            child.userData.velocity.y -= 0.035; 
            if (child.position.y < -50) child.visible = false;
        }
    });
    if (scene.background.r < 0.6) {
        const val = scene.background.r + 0.01;
        scene.background.setRGB(val, val, val);
    }
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    updateMovement(delta);
    
    updateLaserSystem(sceneParams, laserLine, isLaserOn);
    updateWallTransparency();
    animateCrumble();

    if (orbitControls.enabled) orbitControls.update();
    composer.render();
}

// --- 7. 카메라 모드 및 유틸리티 ---
function setCameraMode(mode) {
    if (currentMode === CameraMode.FIRST_PERSON) {
        controls.unlock();
        playerGroup.position.set(0, FLOOR_SURFACE_Y + EYE_LEVEL, 0);
        playerMesh.visible = true; 
    }
    currentMode = mode;
    orbitControls.enabled = true; 
    orbitControls.reset();
    
    let modeText = "";

    switch (mode) {
        case CameraMode.FIRST_PERSON: 
            activeCamera = perspCamera;
            orbitControls.enabled = false; 
            playerMesh.visible = false; 
            controls.lock(); 
            modeText = "1st PERSON";
            if(crosshair) crosshair.style.display = 'block';
            break;
        case CameraMode.PERSPECTIVE: 
            activeCamera = perspCamera;
            activeCamera.position.set(MAP_SIZE*1.5, MAP_SIZE*1.5, MAP_SIZE*1.5); 
            activeCamera.lookAt(0,0,0);
            modeText = "3D VIEW";
            if(crosshair) crosshair.style.display = 'none';
            playerMesh.visible = true;
            break;
        case CameraMode.TOP: 
            activeCamera = orthoCamera;
            activeCamera.position.set(0, 20, 0);
            activeCamera.lookAt(0, 0, 0);
            activeCamera.up.set(0, 0, -1); 
            modeText = "TOP VIEW";
            if(crosshair) crosshair.style.display = 'none';
            playerMesh.visible = true;
            break;
        case CameraMode.FRONT: 
            activeCamera = orthoCamera;
            activeCamera.position.set(0, 0, 20);
            activeCamera.lookAt(0, 0, 0);
            activeCamera.up.set(0, 1, 0);
            modeText = "FRONT VIEW";
            if(crosshair) crosshair.style.display = 'none';
            playerMesh.visible = true;
            break;
        case CameraMode.SIDE: 
            activeCamera = orthoCamera;
            activeCamera.position.set(20, 0, 0);
            activeCamera.lookAt(0, 0, 0);
            activeCamera.up.set(0, 1, 0);
            modeText = "SIDE VIEW";
            if(crosshair) crosshair.style.display = 'none';
            playerMesh.visible = true;
            break;
    }
    
    // 오쏘그래픽 뷰 업데이트
    if (activeCamera === orthoCamera) {
        activeCamera.updateProjectionMatrix();
    }
    
    renderScene.camera = activeCamera;
    if (elCameraText) elCameraText.innerText = modeText;
}

function updateMovement(delta) {
    if (!controls.isLocked) return;
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    direction.z = Number(moveState.forward) - Number(moveState.backward);
    direction.x = Number(moveState.right) - Number(moveState.left);
    direction.normalize();

    if (moveState.forward || moveState.backward) velocity.z -= direction.z * SENSITIVITY * delta;
    if (moveState.left || moveState.right) velocity.x -= direction.x * SENSITIVITY * delta;

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);
    
    playerGroup.position.y = FLOOR_SURFACE_Y + EYE_LEVEL;
    const boundaryLimit = HALF_MAP - 1.0; 
    if (playerGroup.position.x < -boundaryLimit) playerGroup.position.x = -boundaryLimit;
    if (playerGroup.position.x > boundaryLimit) playerGroup.position.x = boundaryLimit;
    if (playerGroup.position.z < -boundaryLimit) playerGroup.position.z = -boundaryLimit;
    if (playerGroup.position.z > boundaryLimit) playerGroup.position.z = boundaryLimit;
}

function highlightCube(cube, isSelected) {
    if (!cube) return;
    const outline = cube.getObjectByName('selectionOutline');
    if (outline) {
        outline.material.color.setHex(isSelected ? 0xffff00 : 0x555555);
        outline.material.linewidth = isSelected ? 2 : 1;
        outline.material.toneMapped = !isSelected;
    }
    if (isSelected) {
        guideLines.visible = true;
        guideLines.position.copy(cube.position);
    } else {
        guideLines.visible = false;
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

function resetMirrors() {
    for (let i = mirrors.length - 1; i >= 0; i--) {
        const mirror = mirrors[i];
        if (mirror.userData.draggable !== false) {
            scene.remove(mirror);
            mirrors.splice(i, 1);
        }
    }
    if (selectedCube && selectedCube.userData.draggable !== false) {
        if (typeof highlightCube === 'function') highlightCube(selectedCube, false);
        selectedCube = null;
        rotationGizmo.visible = false;
        guideLines.visible = false;
    }
    updateUI();
    updateLaserSystem(sceneParams, laserLine, isLaserOn);
}

// --- 이벤트 리스너 ---
window.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('btn-start');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const screen = document.getElementById('start-screen');
            if(screen) screen.style.display = 'none';
            loadStage(0);
        });
    }
});

window.addEventListener('keydown', (e) => {
    switch (e.code) {
        case 'Digit1': setCameraMode(CameraMode.PERSPECTIVE); break;
        case 'Digit2': setCameraMode(CameraMode.TOP); break;
        case 'Digit3': setCameraMode(CameraMode.FRONT); break;
        case 'Digit4': setCameraMode(CameraMode.SIDE); break;
        case 'KeyV': 
            if (currentMode === CameraMode.FIRST_PERSON) setCameraMode(CameraMode.PERSPECTIVE);
            else setCameraMode(CameraMode.FIRST_PERSON);
            break;
        case 'KeyR':
            if (confirm("초기화 하시겠습니까?")) { if (lives > 0) resetMirrors(); }
            break;
        case 'KeyW': moveState.forward = true; break;
        case 'KeyS': moveState.backward = true; break;
        case 'KeyA': moveState.left = true; break;
        case 'KeyD': moveState.right = true; break;
    }
});

window.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'KeyW': moveState.forward = false; break;
        case 'KeyS': moveState.backward = false; break;
        case 'KeyA': moveState.left = false; break;
        case 'KeyD': moveState.right = false; break;
    }
});

controls.addEventListener('unlock', () => {
    if (currentMode === CameraMode.FIRST_PERSON) setCameraMode(CameraMode.PERSPECTIVE);
});

window.addEventListener('pointerdown', (event) => {
    if (event.target.closest('#toolbox') || event.target.closest('#ui-layer') || event.target.closest('#status-panel')) return;

    if (currentMode === CameraMode.FIRST_PERSON) {
        mouse.set(0, 0);
    } else {
        mouse.x = (event.clientX / width) * 2 - 1;
        mouse.y = -(event.clientY / height) * 2 + 1;
    }
    
    mouseDownTime = Date.now();
    raycaster.setFromCamera(mouse, activeCamera);

    let hitGizmo = false;
    if (selectedCube && rotationGizmo.visible) {
        const gizmoHits = raycaster.intersectObjects(rotationGizmo.children);
        if (gizmoHits.length > 0) {
            activeAxis = gizmoHits[0].object.userData.axis;
            updateGizmoColors();
            if(orbitControls.enabled) orbitControls.enabled = false; 
            hitGizmo = true;
            return; 
        }
    }
    if (!hitGizmo) {
        activeAxis = null;
        updateGizmoColors();
        if (currentMode !== CameraMode.FIRST_PERSON) orbitControls.enabled = true;
    }

    if (source) {
        const sourceHits = raycaster.intersectObject(source);
        if (sourceHits.length > 0) {
            if (failTimer) clearTimeout(failTimer);
            isLaserOn = !isLaserOn;
            if (isLaserOn) {
                checkLaser();
                const hit = updateLaserSystem(sceneParams, laserLine, true);
                if (!hit) { 
                    lives--;
                    // 실패 메시지는 잠깐만 표시
                    const prevText = infoUI ? infoUI.innerText : "";
                    if(infoUI) {
                        infoUI.innerHTML = `<span style="color:orange">FAIL! 다시 시도하세요.</span>`;
                    }
                    failTimer = setTimeout(() => {
                        isLaserOn = false;
                        checkLaser();
                        updateUI(); // 원래 메시지로 복귀
                    }, 2000);
                }
            } else {
                checkLaser();
                updateUI();
            }
            return;
        }
    }

    const intersects = raycaster.intersectObjects(mirrors, true);
    if (intersects.length > 0) {
        let target = intersects[0].object;
        while(target && target.parent && !mirrors.includes(target)) { target = target.parent; }
        
        if (mirrors.includes(target)) {
            if (target.userData.draggable === false) {
                if (selectedCube) highlightCube(selectedCube, false);
                selectedCube = null;
                rotationGizmo.visible = false;
                guideLines.visible = false;
                return; 
            }
            isDragging = true; 
            if(orbitControls.enabled) orbitControls.enabled = false; 
            window.dragTarget = target; 
            
            if (selectedCube) highlightCube(selectedCube, false);
            selectedCube = target;
            highlightCube(selectedCube, true);
            rotationGizmo.visible = true;
            rotationGizmo.position.copy(selectedCube.position);
        }
    } else {
        isDragging = false;
    }
});

window.addEventListener('pointermove', (event) => {
    if (isDragging && window.dragTarget) {
        if (currentMode === CameraMode.FIRST_PERSON) {
            mouse.set(0, 0);
        } else {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        }
        raycaster.setFromCamera(mouse, activeCamera); 

        const intersects = raycaster.intersectObjects(surfaces);
        const hit = intersects.find(i => i.object.material.opacity > 0.5);

        if (hit) {
            const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).round();
            const targetPos = hit.point.clone().add(normal.multiplyScalar(0.5));
            const snap = (val) => Math.round(val);

            if (Math.abs(normal.x) < 0.1) targetPos.x = snap(targetPos.x);
            if (Math.abs(normal.y) < 0.1) targetPos.y = snap(targetPos.y);
            if (Math.abs(normal.z) < 0.1) targetPos.z = snap(targetPos.z);
            
            const limit = HALF_MAP - 0.5;
            targetPos.x = Math.max(-limit, Math.min(limit, targetPos.x));
            targetPos.y = Math.max(-limit, Math.min(limit, targetPos.y));
            targetPos.z = Math.max(-limit, Math.min(limit, targetPos.z));
            
            window.dragTarget.position.copy(targetPos);
            
            if (selectedCube === window.dragTarget) {
                rotationGizmo.position.copy(targetPos);
                guideLines.position.copy(targetPos);
            }
            if (isLaserOn) checkLaser();
        }
        return;
    }

    if (selectedCube && rotationGizmo.visible && !activeAxis) {
        if (currentMode === CameraMode.FIRST_PERSON) mouse.set(0, 0);
        else {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        }
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
    isDragging = false; 
    if (currentMode !== CameraMode.FIRST_PERSON) orbitControls.enabled = true;
    window.dragTarget = null;

    if (timeDiff < 200) {
        if (activeAxis) return; 
        
        if (currentMode === CameraMode.FIRST_PERSON) mouse.set(0, 0);
        else {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        }

        raycaster.setFromCamera(mouse, activeCamera);
        if (rotationGizmo.visible && raycaster.intersectObjects(rotationGizmo.children).length > 0) return;

        const intersects = raycaster.intersectObjects(mirrors, true);
        if (intersects.length === 0 && selectedCube) {
             highlightCube(selectedCube, false);
             selectedCube = null;
             rotationGizmo.visible = false;
             updateUI();
        }
    }
});

// 버튼 이벤트
if(btnAddMirror) btnAddMirror.addEventListener('click', () => {
    if (mirrors.filter(m => m.userData.draggable !== false).length >= STAGES[currentStageIndex].maxMirrors) return;
    const newCube = createMirrorCube(0, FLOOR_SURFACE_Y + 0.5, 0);
    scene.add(newCube); mirrors.push(newCube);
    if (selectedCube) highlightCube(selectedCube, false);
    selectedCube = newCube; highlightCube(selectedCube, true);
    rotationGizmo.visible = true; rotationGizmo.position.copy(selectedCube.position);
    updateUI();
});
if(btnAddTrapezoid) btnAddTrapezoid.addEventListener('click', () => {
    if (mirrors.filter(m => m.userData.draggable !== false).length >= STAGES[currentStageIndex].maxMirrors) return;
    const newCube = createTrapezoidMirrorCube(0, FLOOR_SURFACE_Y + 0.5, 0);
    scene.add(newCube); mirrors.push(newCube);
    if (selectedCube) highlightCube(selectedCube, false);
    selectedCube = newCube; highlightCube(selectedCube, true);
    rotationGizmo.visible = true; rotationGizmo.position.copy(selectedCube.position);
    updateUI();
});
if(btnAddHalf) btnAddHalf.addEventListener('click', () => {
    if (mirrors.filter(m => m.userData.draggable !== false).length >= STAGES[currentStageIndex].maxMirrors) return;
    const newCube = createHalfMirrorCube(0, FLOOR_SURFACE_Y + 0.5, 0);
    scene.add(newCube); mirrors.push(newCube);
    if (selectedCube) highlightCube(selectedCube, false);
    selectedCube = newCube; highlightCube(selectedCube, true);
    rotationGizmo.visible = true; rotationGizmo.position.copy(selectedCube.position);
    updateUI();
});

window.addEventListener('wheel', (event) => {
    if (selectedCube && selectedCube.userData.draggable !== false && activeAxis) {
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

window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const a = w / h;
    perspCamera.aspect = a; perspCamera.updateProjectionMatrix();
    orthoCamera.left = -frustumSize * a / 2;
    orthoCamera.right = frustumSize * a / 2;
    orthoCamera.top = frustumSize / 2;
    orthoCamera.bottom = -frustumSize / 2;
    orthoCamera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
});

// 시작
animate();