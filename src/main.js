import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createBrickRoom, createFixedCube, createMirrorCube, 
    createTrapezoidMirrorCube, createHalfMirrorCube, createDispersionCube, 
    createPlayer, createFixedDoubleMirror, createLaserSource, createLaserSensor, createColorSensor } from './objects.js';
import { createLaserLine, updateLaserSystem } from './laser.js';
import { STAGES } from './stages.js'; 

// --- UI 참조 ---
const elStageTransition = document.getElementById('stage-transition');
const elStNum = document.getElementById('st-stage-num');
const elStTitle = document.getElementById('st-title');
const elStDesc = document.getElementById('st-desc');

const infoUI = document.getElementById('info');
const crosshair = document.getElementById('crosshair');
const camStatusUI = document.getElementById('camera-text');
const btnAddMirror = document.getElementById('btn-add-mirror');
const btnAddTrapezoid = document.getElementById('btn-add-trapezoid');
const btnAddHalf = document.getElementById('btn-add-half');
const btnAddDispersion = document.getElementById('btn-add-dispersion');
const elLifeText = document.getElementById('life-text');
const elLaserText = document.getElementById('laser-text');

// --- 설정값 ---
let MAP_SIZE = 15; 
let HALF_MAP = MAP_SIZE / 2; 
let FLOOR_SURFACE_Y = -HALF_MAP; 
const EYE_LEVEL = 2.0; 

// --- 씬 설정 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const width = window.innerWidth;
const height = window.innerHeight;
const aspect = width / height;

const perspCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
perspCamera.position.set(25, 25, 25);
perspCamera.lookAt(0, 0, 0);

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

// --- 후처리 ---
const renderScene = new RenderPass(scene, activeCamera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.5, 0.4, 0.85);
const outputPass = new OutputPass();
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
composer.addPass(outputPass);

// --- 조명 ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 2.0); 
dirLight.position.set(20, 50, 20); 
dirLight.castShadow = true; 
const d = 50; 
dirLight.shadow.camera.left = -d; dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d; dirLight.shadow.camera.bottom = -d;
scene.add(dirLight);

// --- 룸 생성 ---
let roomGroup = createBrickRoom(MAP_SIZE);
scene.add(roomGroup);

const surfaces = [];
roomGroup.traverse(c => { if(c.isMesh && c.userData.isSurface) surfaces.push(c); });

const laserLine = createLaserLine();
scene.add(laserLine);

// --- 게임 변수 ---
let source = null;
let sensor = null; 
let mirrors = [];
const sceneParams = { source: null, sensor: null, mirrors };

let currentStageIndex = 0;
let isLaserOn = false;
let isSuccess = false;
let lives = 5;
let failTimer = null;
let isCleared = false; 

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedCube = null;     
let activeAxis = null;       
let hoveredAxis = null;      
let isDragging = false;      
let mouseDownTime = 0;       

// --- 가이드라인 ---
function createGuideLines() {
    const group = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    const length = 100;
    const geoX = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-length,0,0), new THREE.Vector3(length,0,0)]);
    group.add(new THREE.Line(geoX, mat));
    const geoY = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-length,0), new THREE.Vector3(0,length,0)]);
    group.add(new THREE.Line(geoY, mat));
    const geoZ = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,-length), new THREE.Vector3(0,0,length)]);
    group.add(new THREE.Line(geoZ, mat));
    group.visible = false;
    return group;
}
const guideLines = createGuideLines();
scene.add(guideLines);

// --- 기즈모 ---
function createAxisGizmo() {
    const gizmo = new THREE.Group();
    gizmo.visible = false;
    const radius = 1.3; const tube = 0.08;
    const mat = new THREE.MeshBasicMaterial({ color: 0xcccccc, toneMapped: true, transparent: true, opacity: 0.3 });
    const torusGeo = new THREE.TorusGeometry(radius, tube, 16, 64);
    const ringX = new THREE.Mesh(torusGeo, mat.clone()); ringX.rotation.y = Math.PI/2; ringX.userData={isGizmo:true, axis:'x'}; gizmo.add(ringX);
    const ringY = new THREE.Mesh(torusGeo, mat.clone()); ringY.rotation.x = Math.PI/2; ringY.userData={isGizmo:true, axis:'y'}; gizmo.add(ringY);
    const ringZ = new THREE.Mesh(torusGeo, mat.clone()); ringZ.userData={isGizmo:true, axis:'z'}; gizmo.add(ringZ);
    return gizmo;
}
const rotationGizmo = createAxisGizmo();
scene.add(rotationGizmo);

// --- 플레이어 및 컨트롤 ---
const playerMesh = createPlayer();
const controls = new PointerLockControls(perspCamera, document.body);
const playerGroup = controls.getObject(); 
playerMesh.position.set(0, -1.0, 0); 
playerGroup.add(playerMesh); 
scene.add(playerGroup);      

const orbitControls = new OrbitControls(activeCamera, renderer.domElement);
orbitControls.enableDamping = true; 

const moveState = { forward: false, backward: false, left: false, right: false };
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const clock = new THREE.Clock();
const SENSITIVITY = 150.0;
const CameraMode = { FIRST_PERSON: 0, PERSPECTIVE: 1, TOP: 2, FRONT: 3, SIDE: 4 };
let currentMode = CameraMode.PERSPECTIVE;

// --- 함수들 ---

function loadStage(index) {
    const data = STAGES[index];
    if (!data) {
        alert("모든 스테이지 클리어! 축하합니다!");
        location.reload();
        return;
    }
    currentStageIndex = index;

    if (elStNum) elStNum.innerText = `STAGE ${data.id}`;
    if (elStTitle) elStTitle.innerText = data.msg.split(':')[1] || data.msg;
    if (elStDesc) elStDesc.innerText = data.desc || "거울을 배치해 빛을 연결하세요.";
    
    if (elStageTransition) {
        elStageTransition.classList.add('active');
        setTimeout(() => elStageTransition.classList.remove('active'), 2500);
    }
    
    MAP_SIZE = data.mapSize || 15;
    HALF_MAP = MAP_SIZE / 2;
    FLOOR_SURFACE_Y = -HALF_MAP;
    
    if (roomGroup) scene.remove(roomGroup);
    roomGroup = createBrickRoom(MAP_SIZE);
    scene.add(roomGroup);

    surfaces.length = 0;
    roomGroup.traverse(c => { if(c.isMesh && c.userData.isSurface) surfaces.push(c); });

    const aspect = window.innerWidth / window.innerHeight;
    frustumSize = MAP_SIZE * 1.5; 
    orthoCamera.left = -frustumSize * aspect / 2; orthoCamera.right = frustumSize * aspect / 2;
    orthoCamera.top = frustumSize / 2; orthoCamera.bottom = -frustumSize / 2;
    orthoCamera.updateProjectionMatrix();

    if (source) scene.remove(source);
    if (sensor) scene.remove(sensor);
    mirrors.forEach(m => scene.remove(m));
    mirrors.length = 0;
    
    source = createLaserSource(data.sourcePos[0], data.sourcePos[1], data.sourcePos[2], data.sourceDir);
    scene.add(source);
    const sData = data.sensorData[0];
    sensor = createLaserSensor(sData.pos[0], sData.pos[1], sData.pos[2], sData.dir);
    scene.add(sensor);
    
    sceneParams.source = source;
    sceneParams.sensor = sensor;
    sceneParams.mirrors = mirrors;

    playerGroup.position.set(0, FLOOR_SURFACE_Y + EYE_LEVEL, 0);
    playerGroup.rotation.set(0, 0, 0);
    
    if (data.fixedElements) {
        data.fixedElements.forEach(el => {
            if (el.type === 'obstacle') {
                const size = el.size || [1,1,1];
                const obs = createFixedCube(el.color || 0x444444, el.pos[0], el.pos[1], el.pos[2], 'obstacle');
                obs.scale.set(size[0], size[1], size[2]);
                obs.userData.draggable = false;
                // [삭제됨] 움직이는 벽 속성 부여 코드 제거
                scene.add(obs); mirrors.push(obs); 
            } else if (el.type === 'fixedMirror') {
                const fm = createMirrorCube(...el.pos);
                fm.userData.draggable = false; fm.rotation.set(...el.rotation);
                scene.add(fm); mirrors.push(fm);
            } else if (el.type === 'doubleMirror') {
                const dm = createFixedDoubleMirror(el.pos[0], el.pos[1], el.pos[2], el.rotation || [0,0,0]);
                dm.userData.draggable = false;
                scene.add(dm); mirrors.push(dm);
            } else if (el.type === 'trianglemirror') {
                const tm = createMirrorCube(el.pos[0], el.pos[1], el.pos[2]);
                tm.userData.draggable = false;
                if(el.rotation) tm.rotation.set(...el.rotation);
                scene.add(tm); mirrors.push(tm);
            }
        });
    }

    isSuccess = false; isLaserOn = false; isCleared = false;
    scene.background = new THREE.Color(0x000000);

    if (selectedCube) highlightCube(selectedCube, false);
    selectedCube = null;
    activeAxis = null;
    guideLines.visible = false; rotationGizmo.visible = false;

    updateUI();
    setCameraMode(CameraMode.PERSPECTIVE);
}

function updateGizmoVisuals() {
    rotationGizmo.children.forEach(ring => {
        if (activeAxis && ring.userData.axis === activeAxis) {
            ring.material.opacity = 1.0; ring.scale.setScalar(1.1);
        } else if (hoveredAxis && ring.userData.axis === hoveredAxis) {
            ring.material.opacity = 0.6; ring.scale.setScalar(1.05);
        } else {
            ring.material.opacity = 0.15; ring.scale.setScalar(1.0);
        }
    });
}

function highlightCube(cube, isSelected) {
    if(!cube) return;
    const outline = cube.getObjectByName('selectionOutline');
    if(outline) { 
        outline.material.color.setHex(isSelected ? 0xffffff : 0x555555); 
        outline.material.linewidth = isSelected ? 2 : 1; 
        outline.material.toneMapped = !isSelected;
        outline.visible = true; 
    }
    guideLines.visible = isSelected; 
    if(isSelected) guideLines.position.copy(cube.position);
}

function updateUI() {
    if(!infoUI) return;
    const data = STAGES[currentStageIndex];
    
    const currentCounts = { triangle: 0, trapezoid: 0, half: 0, dispersion: 0 };
    mirrors.forEach(m => {
        if (m.userData.draggable !== false) {
            const type = m.userData.mirrorType;
            if (type && currentCounts.hasOwnProperty(type)) currentCounts[type]++;
        }
    });

    let limits = data.maxMirrors;
    if (typeof limits === 'number') limits = { triangle: limits, trapezoid: limits, half: limits, dispersion: 0 };
    else if (!limits) limits = { triangle: 0, trapezoid: 0, half: 0, dispersion: 0 };

    const updateBtn = (btn, type, label) => {
        if (!btn) return;
        const max = limits[type] || 0;
        const remain = max - currentCounts[type];
        if (max > 0) {
            btn.disabled = (remain <= 0);
            btn.style.opacity = (remain > 0) ? 1 : 0.5;
            btn.innerText = (remain > 0) ? `${label} (${remain})` : `${label} (0)`;
            btn.style.cursor = (remain > 0) ? "pointer" : "not-allowed";
        } else {
            btn.disabled = true; btn.style.opacity = 0.3; btn.style.cursor = "not-allowed";
            btn.innerText = `${label} (X)`;
        }
    };

    updateBtn(btnAddMirror, 'triangle', '📐 삼각 거울');
    updateBtn(btnAddTrapezoid, 'trapezoid', '📐 사다리꼴');
    updateBtn(btnAddHalf, 'half', '▮ 직육면체');
    updateBtn(btnAddDispersion, 'dispersion', '💎 분산 큐브');

    if(elLifeText) elLifeText.innerText = `Lives: ${lives}`;
    if(elLaserText) {
        elLaserText.innerText = isLaserOn ? "Laser: ON" : "Laser: OFF";
        elLaserText.style.color = isLaserOn ? "#ffff00" : "#888";
    }

    if(lives <= 0) {
        document.getElementById('game-over-screen').style.display = 'flex';
        controls.unlock();
        isLaserOn = false;
        updateLaserSystem(sceneParams, laserLine, false);
    } else {
        infoUI.innerHTML = data.desc || data.msg;
        infoUI.style.color = "white";
    }
}

function checkLaser() {
    const hit = updateLaserSystem(sceneParams, laserLine, isLaserOn);
    if (isLaserOn && hit) {
        if (!isCleared) {
            isCleared = true; isSuccess = true;
            if(failTimer) clearTimeout(failTimer); 
            if(infoUI) { infoUI.innerText = "SUCCESS! 벽이 무너집니다!"; infoUI.style.color = "#00ff00"; }
            roomGroup.children.forEach(wrapper => {
                if (!wrapper.name.startsWith("Wall")) return;
                const solid = wrapper.children.find(c => c.userData.type === 'solidWall');
                const bricks = wrapper.children.find(c => c.userData.type === 'brickGroup');
                if (solid) solid.visible = false; if (bricks) bricks.visible = true; 
            });
            setTimeout(() => { loadStage(currentStageIndex + 1); }, 5000);
        }
    } else isSuccess = false;
}

const dummy = new THREE.Object3D();
function animateCrumble() {
    if (!isCleared) return;
    roomGroup.traverse(child => {
        if (child.userData.isBrick && child.parent.visible) {
             child.position.add(child.userData.velocity);
             child.rotation.x += child.userData.rotVel.x;
             child.rotation.y += child.userData.rotVel.y;
             child.userData.velocity.y -= 0.035;
             if (child.position.y < -30) child.visible = false;
        }
    });
    if (scene.background.r < 0.6) {
        const val = scene.background.r + 0.01;
        scene.background.setRGB(val, val, val);
    }
}

// [삭제됨] animateStage4Wall 함수 삭제됨

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (controls.isLocked) {
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
        const limit = HALF_MAP - 1.0;
        playerGroup.position.x = Math.max(-limit, Math.min(limit, playerGroup.position.x));
        playerGroup.position.z = Math.max(-limit, Math.min(limit, playerGroup.position.z));
    }
    
    updateLaserSystem(sceneParams, laserLine, isLaserOn);
    if (currentMode !== CameraMode.FIRST_PERSON) {
        const cx = activeCamera.position.x; const cz = activeCamera.position.z; const limit = HALF_MAP; const fade = 0.2;
        const setOpacity = (name, val) => {
            const w = roomGroup.getObjectByName(name);
            if(w) w.children.forEach(c => { if(c.material) c.material.opacity = val; });
        };
        setOpacity('Wall_Right', (cx > limit) ? fade : 1.0);
        setOpacity('Wall_Left', (cx < -limit) ? fade : 1.0);
        setOpacity('Wall_Front', (cz > limit) ? fade : 1.0);
        setOpacity('Wall_Back', (cz < -limit) ? fade : 1.0);
    } else roomGroup.traverse(c => { if(c.material) c.material.opacity = 1.0; });

    animateCrumble();
    // [삭제됨] animateStage4Wall() 호출 삭제됨
    if (orbitControls.enabled) orbitControls.update();
    composer.render();
}

window.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('btn-start');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            document.getElementById('start-screen').style.display = 'none';
            loadStage(0);
        });
    }
});

// [핵심] 생성 및 드래그 함수
function spawnAndDrag(createFn, type) {
    const limit = STAGES[currentStageIndex].maxMirrors[type] || 0;
    const current = mirrors.filter(m => m.userData.draggable && m.userData.mirrorType === type).length;
    
    if (current >= limit) {
        alert("더 이상 큐브를 추가할 수 없습니다.");
        return;
    }

    const newCube = createFn(0, FLOOR_SURFACE_Y + 0.5, 0);
    newCube.userData.mirrorType = type;
    scene.add(newCube);
    mirrors.push(newCube);

    if (selectedCube) highlightCube(selectedCube, false);
    selectedCube = newCube;
    highlightCube(selectedCube, true);
    
    rotationGizmo.visible = true;
    rotationGizmo.position.copy(selectedCube.position);
    activeAxis = null;
    
    isDragging = true;
    orbitControls.enabled = false;
    window.dragTarget = newCube;
    
    updateGizmoVisuals();
    updateUI();
}

btnAddMirror.addEventListener('click', () => {
    spawnAndDrag(createMirrorCube, 'triangle');
});

btnAddTrapezoid.addEventListener('click', () => {
    spawnAndDrag(createTrapezoidMirrorCube, 'trapezoid');
});

btnAddHalf.addEventListener('click', () => {
    spawnAndDrag(createHalfMirrorCube, 'half');
});

if (btnAddDispersion) {
    btnAddDispersion.addEventListener('click', () => {
        spawnAndDrag(createDispersionCube, 'dispersion');
    });
}

window.addEventListener('keydown', (e) => {
    switch (e.code) {
        case 'Digit1': setCameraMode(CameraMode.PERSPECTIVE); break;
        case 'Digit2': setCameraMode(CameraMode.TOP); break;
        case 'Digit3': setCameraMode(CameraMode.FRONT); break;
        case 'Digit4': setCameraMode(CameraMode.SIDE); break;
        case 'KeyV': setCameraMode(currentMode === CameraMode.FIRST_PERSON ? CameraMode.PERSPECTIVE : CameraMode.FIRST_PERSON); break;
        case 'KeyR': if (confirm("초기화?")) { if (lives > 0) {
            for (let i = mirrors.length - 1; i >= 0; i--) {
                if (mirrors[i].userData.draggable !== false) { scene.remove(mirrors[i]); mirrors.splice(i, 1); }
            }
            if(selectedCube) { highlightCube(selectedCube, false); selectedCube = null; rotationGizmo.visible=false; activeAxis=null; }
            updateGizmoVisuals(); updateUI(); updateLaserSystem(sceneParams, laserLine, isLaserOn);
        }} break;
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
controls.addEventListener('unlock', () => { if (currentMode === CameraMode.FIRST_PERSON) setCameraMode(CameraMode.PERSPECTIVE); });

window.addEventListener('pointerdown', (event) => {
    if (event.target.closest('#toolbox') || event.target.closest('#ui-layer') || event.target.closest('#status-panel')) return;
    
    if (window.dragTarget) return; 

    if (currentMode === CameraMode.FIRST_PERSON) mouse.set(0, 0);
    else { mouse.x = (event.clientX / width)*2-1; mouse.y = -(event.clientY / height)*2+1; }
    mouseDownTime = Date.now(); raycaster.setFromCamera(mouse, activeCamera);

    if (selectedCube && rotationGizmo.visible) {
        const hits = raycaster.intersectObjects(rotationGizmo.children);
        if (hits.length > 0) { 
            activeAxis = hits[0].object.userData.axis; 
            updateGizmoVisuals(); 
            orbitControls.enabled = false; 
            return; 
        }
    }
    
    activeAxis = null;
    updateGizmoVisuals();
    if (currentMode !== CameraMode.FIRST_PERSON) orbitControls.enabled = true;

    if (source) {
        const hits = raycaster.intersectObject(source, true);
        if (hits.length > 0) {
            if (failTimer) clearTimeout(failTimer);
            isLaserOn = !isLaserOn;
            if (isLaserOn) {
                checkLaser();
                if (!updateLaserSystem(sceneParams, laserLine, true)) {
                    lives--;
                    if(elLifeText) elLifeText.innerText = `Lives: ${lives}`;
                    if(infoUI) infoUI.innerHTML = `<span style="color:orange">FAIL!</span>`;
                    failTimer = setTimeout(() => { isLaserOn = false; checkLaser(); updateUI(); }, 2000);
                }
            } else { checkLaser(); updateUI(); }
            return;
        }
    }

    const intersects = raycaster.intersectObjects(mirrors, true);
    if (intersects.length > 0) {
        let target = intersects[0].object;
        while(target.parent && !mirrors.includes(target)) target = target.parent;
        if (mirrors.includes(target)) {
            if (target.userData.draggable === false) { 
                if(selectedCube) { highlightCube(selectedCube, false); selectedCube=null; rotationGizmo.visible=false; updateUI(); }
                return; 
            }
            isDragging = true; orbitControls.enabled = false; window.dragTarget = target;
            if(selectedCube) highlightCube(selectedCube, false);
            selectedCube = target; highlightCube(selectedCube, true);
            rotationGizmo.visible = true; rotationGizmo.position.copy(selectedCube.position);
            updateUI();
        }
    } else isDragging = false;
});

window.addEventListener('pointermove', (event) => {
    if (currentMode === CameraMode.FIRST_PERSON) mouse.set(0, 0);
    else { mouse.x = (event.clientX / width)*2-1; mouse.y = -(event.clientY / height)*2+1; }
    raycaster.setFromCamera(mouse, activeCamera);

    if (isDragging && window.dragTarget) {
        const intersects = raycaster.intersectObjects(surfaces);
        const hit = intersects.find(i => i.object.material.opacity > 0.5);
        if (hit) {
            const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).round();
            const targetPos = hit.point.clone().add(normal.multiplyScalar(0.5));
            const snap = (v) => Math.round(v);
            if(Math.abs(normal.x)<0.1) targetPos.x = snap(targetPos.x);
            if(Math.abs(normal.y)<0.1) targetPos.y = snap(targetPos.y);
            if(Math.abs(normal.z)<0.1) targetPos.z = snap(targetPos.z);
            const limit = 7.0; 
            targetPos.x = Math.max(-limit, Math.min(limit, targetPos.x));
            targetPos.y = Math.max(-limit, Math.min(limit, targetPos.y));
            targetPos.z = Math.max(-limit, Math.min(limit, targetPos.z));
            window.dragTarget.position.copy(targetPos);
            if(selectedCube === window.dragTarget) { 
                rotationGizmo.position.copy(targetPos); 
                guideLines.position.copy(targetPos); 
            }
            if(isLaserOn) checkLaser();
        }
        return;
    }

    if (selectedCube && rotationGizmo.visible && !activeAxis) {
        const hits = raycaster.intersectObjects(rotationGizmo.children);
        if (hits.length > 0) {
            hoveredAxis = hits[0].object.userData.axis;
        } else {
            hoveredAxis = null;
        }
        updateGizmoVisuals();
    }
});

window.addEventListener('pointerup', (event) => {
    isDragging = false; if(currentMode!==CameraMode.FIRST_PERSON) orbitControls.enabled=true; window.dragTarget=null;
    if(Date.now()-mouseDownTime < 200) {
        if(activeAxis) return;
        if(currentMode===CameraMode.FIRST_PERSON) mouse.set(0,0);
        else { mouse.x=(event.clientX/width)*2-1; mouse.y=-(event.clientY/height)*2+1; }
        raycaster.setFromCamera(mouse, activeCamera);
        if(rotationGizmo.visible && raycaster.intersectObjects(rotationGizmo.children).length>0) return;
        
        if(raycaster.intersectObjects(mirrors,true).length===0 && selectedCube) {
            highlightCube(selectedCube,false); selectedCube=null; rotationGizmo.visible=false; activeAxis=null; updateGizmoVisuals(); updateUI();
        }
    }
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

function setCameraMode(mode) {
    if (currentMode === CameraMode.FIRST_PERSON) { controls.unlock(); playerGroup.position.set(0, FLOOR_SURFACE_Y + EYE_LEVEL, 0); playerMesh.visible = true; }
    currentMode = mode; orbitControls.enabled = true; orbitControls.reset();
    
    if(mode === CameraMode.TOP || mode === CameraMode.FRONT || mode === CameraMode.SIDE) orbitControls.enableRotate = false;
    else orbitControls.enableRotate = true;

    if(mode===CameraMode.FIRST_PERSON) { crosshair.style.display='block'; } else { crosshair.style.display='none'; }
    
    switch (mode) {
        case CameraMode.FIRST_PERSON: activeCamera=perspCamera; orbitControls.enabled=false; playerMesh.visible=false; controls.lock(); if(camStatusUI) camStatusUI.innerText="1st PERSON"; break;
        case CameraMode.PERSPECTIVE: activeCamera=perspCamera; activeCamera.position.set(25,25,25); activeCamera.lookAt(0,0,0); if(camStatusUI) camStatusUI.innerText="3D VIEW"; playerMesh.visible=true; break;
        case CameraMode.TOP: activeCamera=orthoCamera; activeCamera.position.set(0,20,0); activeCamera.lookAt(0,0,0); activeCamera.up.set(0,0,-1); if(camStatusUI) camStatusUI.innerText="TOP VIEW"; break;
        case CameraMode.FRONT: activeCamera=orthoCamera; activeCamera.position.set(0,0,20); activeCamera.lookAt(0,0,0); activeCamera.up.set(0,1,0); if(camStatusUI) camStatusUI.innerText="FRONT VIEW"; break;
        case CameraMode.SIDE: activeCamera=orthoCamera; activeCamera.position.set(20,0,0); activeCamera.lookAt(0,0,0); activeCamera.up.set(0,1,0); if(camStatusUI) camStatusUI.innerText="SIDE VIEW"; break;
    }
    
    orbitControls.object = activeCamera;
    if(activeCamera===orthoCamera) activeCamera.updateProjectionMatrix();
    renderScene.camera=activeCamera;
}

window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const a = w / h;
    perspCamera.aspect = a; perspCamera.updateProjectionMatrix();
    orthoCamera.left = -frustumSize * a / 2; orthoCamera.right = frustumSize * a / 2;
    orthoCamera.top = frustumSize / 2; orthoCamera.bottom = -frustumSize / 2;
    orthoCamera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
});

animate();