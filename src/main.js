import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createBrickRoom, createFixedCube, createMirrorCube, createPlayer } from './objects.js'; 
import { createLaserLine, updateLaserSystem } from './laser.js';
import { STAGES } from './stages.js'; 

// --- 상수 설정 ---
const MAP_SIZE = 15; 
const HALF_MAP = MAP_SIZE / 2; 
const FLOOR_SURFACE_Y = -HALF_MAP; 
const EYE_LEVEL = 2.0; 

// --- 1. 씬 및 카메라 설정 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // 배경: 검은색

const width = window.innerWidth;
const height = window.innerHeight;
const aspect = width / height;

// 1-1. Perspective Camera
const perspCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
perspCamera.position.set(25, 25, 25);
perspCamera.lookAt(0, 0, 0);

// 1-2. Orthographic Camera
const frustumSize = 30; 
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

const d = 20; 
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
dirLight.shadow.bias = -0.0001; 
dirLight.shadow.mapSize.width = 2048; 
dirLight.shadow.mapSize.height = 2048;

scene.add(dirLight);
scene.add(dirLight.target); 

// --- 2. 룸 및 오브젝트 생성 ---
const roomGroup = createBrickRoom(MAP_SIZE);
scene.add(roomGroup);

// raycasting용 표면 수집
const surfaces = [];
roomGroup.traverse(c => { 
    if(c.isMesh && c.userData.isSurface) surfaces.push(c); 
});

const source = createFixedCube(0xff0000, 0,0,0, 'source');
const sensor = createFixedCube(0x00ff00, 0,0,0, 'sensor');
scene.add(source);
scene.add(sensor);

const laserLine = createLaserLine();
scene.add(laserLine);

// --- 3. 변수 초기화 ---
let mirrors = [];
const sceneParams = { source, sensor, mirrors };

let currentStageIndex = 0;
let isLaserOn = false;
let isSuccess = false;
let lives = 5;
let failTimer = null;
let isCleared = false; 

// UI 요소
const infoUI = document.getElementById('info');
const crosshair = document.getElementById('crosshair');
const camStatusUI = document.getElementById('camera-status');
const btnAddMirror = document.getElementById('btn-add-mirror');

// 컨트롤 관련
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedCube = null;     
let activeAxis = null;       
let isDragging = false;      
let mouseDownTime = 0;       

// --- [추가] 가이드라인 생성 함수 ---
function createGuideLines() {
    const group = new THREE.Group();
    // 밝은 노란색 선
    const mat = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 });
    const length = MAP_SIZE * 2; // 맵 전체를 가로지르도록 길게

    // X축 가이드
    const geoX = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-length, 0, 0), new THREE.Vector3(length, 0, 0)
    ]);
    group.add(new THREE.Line(geoX, mat));

    // Y축 가이드
    const geoY = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -length, 0), new THREE.Vector3(0, length, 0)
    ]);
    group.add(new THREE.Line(geoY, mat));

    // Z축 가이드
    const geoZ = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, -length), new THREE.Vector3(0, 0, length)
    ]);
    group.add(new THREE.Line(geoZ, mat));

    group.visible = false; // 초기엔 숨김
    return group;
}
const guideLines = createGuideLines();
scene.add(guideLines);

// --- 기즈모 생성 ---
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

// --- 4. 플레이어 및 컨트롤러 설정 ---
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
let currentMode = CameraMode.PERSPECTIVE;

// --- 5. 스테이지 로드 함수 ---

function loadStage(index) {
    const data = STAGES[index];
    if (!data) {
        alert("모든 스테이지 클리어! 축하합니다!");
        location.reload();
        return;
    }
    currentStageIndex = index;
    mirrors.forEach(m => scene.remove(m));
    mirrors.length = 0;
    
    source.position.set(...data.sourcePos);
    sensor.position.set(...data.sensorPos);
    
    playerGroup.position.set(0, FLOOR_SURFACE_Y + EYE_LEVEL, 0);
    playerGroup.rotation.set(0, 0, 0);
    
    isSuccess = false;
    isLaserOn = false;
    isCleared = false;
    
    scene.background = new THREE.Color(0x000000);
    ambientLight.intensity = 0.3;

    roomGroup.children.forEach(wrapper => {
        if (!wrapper.name.startsWith("Wall")) return;
        const solid = wrapper.children.find(c => c.userData.type === 'solidWall');
        const bricks = wrapper.children.find(c => c.userData.type === 'brickGroup');
        if (solid) solid.visible = true; 
        if (bricks) {
            bricks.visible = false; 
            bricks.children.forEach(b => {
                if (b.userData.initialPos) {
                    b.position.copy(b.userData.initialPos);
                    b.rotation.set(0,0,0);
                    b.visible = true;
                }
            });
        }
    });

    // 선택 해제 및 가이드라인 숨김
    if (selectedCube) highlightCube(selectedCube, false);
    selectedCube = null;
    guideLines.visible = false;
    rotationGizmo.visible = false;

    updateUI();
    setCameraMode(CameraMode.PERSPECTIVE);
}

function updateUI() {
    if(!infoUI) return;
    const data = STAGES[currentStageIndex];
    const currentMirrors = mirrors.length;
    const remain = data.maxMirrors - currentMirrors;

    if (btnAddMirror) {
        btnAddMirror.disabled = (remain <= 0);
        btnAddMirror.innerText = remain > 0 
            ? `🪞 반사 큐브 추가 (${remain}개 남음)` 
            : `🚫 추가 불가`;
        btnAddMirror.style.opacity = remain > 0 ? 1 : 0.5;
    }

    if(lives <= 0) {
        infoUI.innerText = "GAME OVER (새로고침하세요)";
        infoUI.style.color = "red";
    } else {
        const laserStatus = isLaserOn ? "ON" : "OFF";
        infoUI.innerHTML = `${data.msg} <br> ❤️ Lives: ${lives} | Laser: ${laserStatus}`;
        infoUI.style.color = "white";
    }
}

function checkLaser() {
    const hit = updateLaserSystem(sceneParams, laserLine, isLaserOn);
    if (isLaserOn && hit) {
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

// --- 6. 애니메이션 로직 ---

function updateWallTransparency() {
    if (currentMode === CameraMode.FIRST_PERSON) {
        roomGroup.traverse(c => {
            if(c.material) c.material.opacity = 1.0;
        });
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
            child.userData.velocity.y -= 0.01; 
            if (child.position.y < -30) {
                child.visible = false;
            }
        }
    });
    if (scene.background.r < 0.6) {
        const val = scene.background.r + 0.005;
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

// --- 7. 유틸리티 및 이벤트 ---

function setCameraMode(mode) {
    if (currentMode === CameraMode.FIRST_PERSON) {
        controls.unlock();
        playerGroup.position.set(0, FLOOR_SURFACE_Y + EYE_LEVEL, 0);
        playerMesh.visible = true; 
    }
    currentMode = mode;
    orbitControls.enabled = true; 
    orbitControls.reset();
    
    if (mode === CameraMode.FIRST_PERSON) {
        crosshair.style.display = 'block';
    } else {
        crosshair.style.display = 'none';
    }

    switch (mode) {
        case CameraMode.FIRST_PERSON: 
            activeCamera = perspCamera;
            orbitControls.enabled = false; 
            playerMesh.visible = false; 
            controls.lock(); 
            camStatusUI.innerText = "MODE: FIRST PERSON (WASD Move)";
            break;
        case CameraMode.PERSPECTIVE: 
            activeCamera = perspCamera;
            activeCamera.position.set(25, 25, 25); 
            activeCamera.lookAt(0,0,0);
            camStatusUI.innerText = "MODE: 3D PERSPECTIVE";
            playerMesh.visible = true;
            break;
        case CameraMode.TOP: 
            activeCamera = orthoCamera;
            activeCamera.position.set(0, 20, 0);
            activeCamera.lookAt(0, 0, 0);
            activeCamera.up.set(0, 0, -1);
            camStatusUI.innerText = "MODE: TOP VIEW";
            playerMesh.visible = true;
            break;
        case CameraMode.FRONT: 
            activeCamera = orthoCamera;
            activeCamera.position.set(0, 0, 20);
            activeCamera.lookAt(0, 0, 0);
            activeCamera.up.set(0, 1, 0);
            camStatusUI.innerText = "MODE: FRONT VIEW";
            playerMesh.visible = true;
            break;
        case CameraMode.SIDE: 
            activeCamera = orthoCamera;
            activeCamera.position.set(20, 0, 0);
            activeCamera.lookAt(0, 0, 0);
            activeCamera.up.set(0, 1, 0);
            camStatusUI.innerText = "MODE: SIDE VIEW";
            playerMesh.visible = true;
            break;
    }
    renderScene.camera = activeCamera;
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
    
    // [추가] 가이드라인 표시 제어
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

// 이벤트 리스너들
document.getElementById('btn-start').addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none';
    loadStage(0);
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
    if (currentMode === CameraMode.FIRST_PERSON) {
        setCameraMode(CameraMode.PERSPECTIVE);
    }
});

window.addEventListener('pointerdown', (event) => {
    if (event.target.closest('#toolbox') || event.target.closest('#ui-layer') || event.target.closest('#btn-camera')) return;

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

    // recursive: true 추가됨
    const intersects = raycaster.intersectObjects(mirrors, true);

    if (intersects.length > 0) {
        let target = intersects[0].object;
        while(target.parent && !mirrors.includes(target)) { target = target.parent; }
        
        if (mirrors.includes(target)) {
            isDragging = true; 
            if(orbitControls.enabled) orbitControls.enabled = false; 
            window.dragTarget = target; 
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
            
            const limit = 7.0; 
            targetPos.x = Math.max(-limit, Math.min(limit, targetPos.x));
            targetPos.y = Math.max(-limit, Math.min(limit, targetPos.y));
            targetPos.z = Math.max(-limit, Math.min(limit, targetPos.z));
            
            window.dragTarget.position.copy(targetPos);
            
            // [추가] 드래그 중에도 기즈모와 가이드라인 따라오게 함
            if (selectedCube === window.dragTarget) {
                rotationGizmo.position.copy(targetPos);
                guideLines.position.copy(targetPos);
            }
            if (isLaserOn) checkLaser();
        }
        return;
    }

    if (selectedCube && rotationGizmo.visible && !activeAxis) {
        if (currentMode === CameraMode.FIRST_PERSON) {
            mouse.set(0, 0);
        } else {
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
    
    const releasedCube = window.dragTarget; 
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

        if (releasedCube) {
            if (selectedCube) highlightCube(selectedCube, false);
            selectedCube = releasedCube; 
            highlightCube(selectedCube, true);
            rotationGizmo.visible = true; 
            rotationGizmo.position.copy(selectedCube.position);
            activeAxis = null; 
            updateGizmoColors();
        } else {
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

btnAddMirror.addEventListener('click', () => {
    if (mirrors.length >= STAGES[currentStageIndex].maxMirrors) {
        alert("더 이상 큐브를 추가할 수 없습니다.");
        return;
    }
    const newCube = createMirrorCube(0, FLOOR_SURFACE_Y + 0.5, 0);
    scene.add(newCube); mirrors.push(newCube);
    if (selectedCube) {
        highlightCube(selectedCube, false);
        selectedCube = null;
    }
    selectedCube = newCube;
    highlightCube(selectedCube, true);
    rotationGizmo.visible = true;
    rotationGizmo.position.copy(selectedCube.position);
    activeAxis = null;
    
    updateGizmoColors();
    updateUI();
});

window.addEventListener('wheel', (event) => {
    // 큐브가 선택되어 있고 + 기즈모 축이 활성화(클릭)된 상태일 때만 회전
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

window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const a = w / h;

    perspCamera.aspect = a;
    perspCamera.updateProjectionMatrix();

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