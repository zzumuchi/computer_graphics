import * as THREE from 'three';

// 텍스처 로더
const textureLoader = new THREE.TextureLoader();
const stoneTexture = textureLoader.load("./src/assets/textures/stone.jpg");
const stoneBumpTexture = textureLoader.load("./src/assets/textures/stone-bump.jpg");

stoneTexture.minFilter = THREE.LinearFilter;
stoneTexture.magFilter = THREE.LinearFilter;
stoneTexture.anisotropy = 4;
stoneBumpTexture.minFilter = THREE.LinearFilter;
stoneBumpTexture.magFilter = THREE.LinearFilter;

// --- 1. 벽돌 룸 ---
export function createBrickRoom(size) {
    const group = new THREE.Group();
    const halfSize = size / 2;
    const thickness = 1.0; 

    const wallMat = new THREE.MeshStandardMaterial({
        map: stoneTexture, bumpMap: stoneBumpTexture, bumpScale: 2.0,
        color: 0x444444, roughness: 0.8, metalness: 0.1,
        transparent: true, opacity: 1.0, side: THREE.DoubleSide 
    });

    const floorGeo = new THREE.BoxGeometry(size, thickness, size);
    const floor = new THREE.Mesh(floorGeo, wallMat.clone());
    floor.position.set(0, -halfSize - (thickness / 2) + 0.1, 0);
    floor.userData = { isSurface: true, type: 'floor' };
    group.add(floor);

    function createDoubleWall(name, x, y, z, width, height, depth) {
        const wrapper = new THREE.Group();
        wrapper.name = name;
        const solidGeo = new THREE.BoxGeometry(width, height, depth);
        const solidMesh = new THREE.Mesh(solidGeo, wallMat.clone());
        solidMesh.position.set(x, y, z);
        solidMesh.userData = { isSurface: true, type: 'solidWall' }; 
        wrapper.add(solidMesh);

        const brickGroup = new THREE.Group();
        brickGroup.visible = false; 
        brickGroup.userData = { type: 'brickGroup' }; 
        const brickSize = 1.0; 
        const brickGeo = new THREE.BoxGeometry(brickSize, brickSize, brickSize);
        const isXWall = (width < 2); 
        const cols = isXWall ? depth : width;  
        const rows = height;                   
        const startH = isXWall ? (z - depth/2 + 0.5) : (x - width/2 + 0.5);
        const startV = y - height/2 + 0.5;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const mat = wallMat.clone(); 
                const mesh = new THREE.Mesh(brickGeo, mat);
                const hPos = startH + c;
                const vPos = startV + r;
                if (isXWall) mesh.position.set(x, vPos, hPos);
                else mesh.position.set(hPos, vPos, z);
                mesh.userData = { 
                    isBrick: true, 
                    velocity: new THREE.Vector3((Math.random()-0.5)*0.3, Math.random()*-0.2, (Math.random()-0.5)*0.3),
                    rotVel: new THREE.Vector3(Math.random()*0.1, Math.random()*0.1, Math.random()*0.1)
                };
                brickGroup.add(mesh);
            }
        }
        wrapper.add(brickGroup);
        return wrapper;
    }
    group.add(createDoubleWall('Wall_Left', -halfSize - 0.5, 0, 0, thickness, size, size));
    group.add(createDoubleWall('Wall_Right', halfSize + 0.5, 0, 0, thickness, size, size));
    group.add(createDoubleWall('Wall_Back', 0, 0, -halfSize - 0.5, size, size, thickness));
    group.add(createDoubleWall('Wall_Front', 0, 0, halfSize + 0.5, size, size, thickness));
    return group;
}

export function createFixedObstacle(x, y, z, w = 1, h = 1, d = 1, color = 0x444444) {
    const geo = new THREE.BoxGeometry(w, h, d);
    
    // 텍스처 로더 초기화 (한 번만 생성)
    if (!createFixedObstacle.textureLoader) {
        createFixedObstacle.textureLoader = new THREE.TextureLoader();
        
        // 텍스처 로드 및 설정 (한 번만 로드)
        createFixedObstacle.stoneTexture = createFixedObstacle.textureLoader.load("./src/assets/textures/stone.jpg");
        createFixedObstacle.stoneTexture.minFilter = THREE.LinearFilter;
        createFixedObstacle.stoneTexture.magFilter = THREE.LinearFilter;
        createFixedObstacle.stoneTexture.anisotropy = 4;
        
        createFixedObstacle.bumpTexture = createFixedObstacle.textureLoader.load("./src/assets/textures/stone-bump.jpg");
        createFixedObstacle.bumpTexture.minFilter = THREE.LinearFilter;
        createFixedObstacle.bumpTexture.magFilter = THREE.LinearFilter;
    }
    
    // 텍스처를 사용하되, color로 색감 조정
    const mat = new THREE.MeshStandardMaterial({ 
        map: createFixedObstacle.stoneTexture,
        bumpMap: createFixedObstacle.bumpTexture,
        bumpScale: 2.0,
        color: color, // 색상으로 텍스처 톤 조정
        metalness: 0.2,
        roughness: 0.85,
        transparent: true,
        opacity: 1.0
    });
    
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    
    // 레이저 시스템이 이 물체를 장애물로 인식하게 설정
    mesh.userData = { 
        type: 'obstacle', 
        draggable: false, // 고정 오브젝트
        isSurface: false  // 레이저를 막는 벽 역할
    };
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // 에지 라인 추가 (크기에 맞게 자동 조정)
    const edgesGeo = new THREE.EdgesGeometry(geo);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x222222 });
    const edges = new THREE.LineSegments(edgesGeo, edgesMat);
    edges.name = 'obstacleEdges'; // obstacle edges 식별용 이름
    mesh.add(edges);

    return mesh;
}
// --- 3. Source ---
export function createLaserSource(x, y, z, dir) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const directionVector = new THREE.Vector3(...dir).normalize();
    group.userData = { type: 'source', isFixed: true, dir: directionVector };

    const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 0.2, 
        roughness: 0.2, metalness: 0.8, flatShading: true
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.name = 'sourceBody';
    group.add(body);
    
    const lensGeo = new THREE.BoxGeometry(0.6, 0.6, 0.1);
    const lensMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.name = 'sourceLens';
    const dirKey = dir.join(','); 
    switch (dirKey) {
        case "1,0,0":  lens.position.x = 0.5; lens.rotation.y = Math.PI/2; break;
        case "-1,0,0": lens.position.x = -0.5; lens.rotation.y = -Math.PI/2; break;
        case "0,1,0":  lens.position.y = 0.5; lens.rotation.x = -Math.PI/2; break;
        case "0,-1,0": lens.position.y = -0.5; lens.rotation.x = Math.PI/2; break;
        case "0,0,1":  lens.position.z = 0.5; break;
        case "0,0,-1": lens.position.z = -0.5; lens.rotation.y = Math.PI; break;
    }
    group.add(lens);
    return group;
}

// --- 4. Sensor ---
export function createLaserSensor(x, y, z, dir, targetColor = 0xffffff) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { type: 'sensor', isFixed: true, isHit: false, dir: new THREE.Vector3(...dir).normalize(), targetColor: targetColor};

    const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: 0x00aa00, roughness: 0.4, metalness: 0.3, flatShading: true
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    const lensGeo = new THREE.BoxGeometry(0.7, 0.7, 0.05);
    const lensMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000 });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.name = "sensorLens";
    const dirKey = dir.join(','); 
    switch (dirKey) {
        case "1,0,0":  lens.position.x = 0.5; lens.rotation.y = Math.PI/2; break;
        case "-1,0,0": lens.position.x = -0.5; lens.rotation.y = -Math.PI/2; break;
        case "0,1,0":  lens.position.y = 0.5; lens.rotation.x = -Math.PI/2; break;
        case "0,-1,0": lens.position.y = -0.5; lens.rotation.x = Math.PI/2; break;
        case "0,0,1":  lens.position.z = 0.5; break;
        case "0,0,-1": lens.position.z = -0.5; lens.rotation.y = Math.PI; break;
    }
    group.add(lens);
    return group;
}

// --- 큐브 오브젝트들 ---

export function createMirrorCube(x, y, z) {
    const group = new THREE.Group(); 
    group.position.set(x, y, z); 
    group.userData = { type: 'mirror', mirrorType: 'triangle', draggable: true };
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
        -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 
        -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5,
        -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
        -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3)); 
    geometry.computeVertexNormals(); 
    geometry.addGroup(0, 6, 1); geometry.addGroup(6, 18, 0); 

    const structMat = new THREE.MeshStandardMaterial({ 
        map: stoneTexture, bumpMap: stoneBumpTexture, bumpScale: 1.0,
        color: 0x555555, roughness: 0.9, side: THREE.DoubleSide 
    });
    const mirrorMat = new THREE.MeshStandardMaterial({ 
        color: 0xaaccff, roughness: 0.05, metalness: 1.0, 
        emissive: 0x112233, emissiveIntensity: 0.2, 
        side: THREE.FrontSide, flatShading: true
    });
    const prismMesh = new THREE.Mesh(geometry, [structMat, mirrorMat]); 
    prismMesh.userData = { isPrism: true }; 
    prismMesh.castShadow = true; prismMesh.receiveShadow = true; 
    group.add(prismMesh);

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x555555, linewidth: 1 })); 
    edges.name = 'selectionOutline'; edges.userData = { ignoreLaser: true }; 
    group.add(edges); 
    return group;
}

export function createTrapezoidMirrorCube(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { type: 'mirror', mirrorType: 'trapezoid', draggable: true };
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
        -0.5, -0.5, 0.5, 0.207, -0.5, 0.5, -0.5, -0.5, -0.5, 0.207, -0.5, -0.5,
        -0.5, 0.5, 0.5, -0.207, 0.5, 0.5, -0.5, 0.5, -0.5, -0.207, 0.5, -0.5,
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    const indices = [2,6,7, 2,7,3, 0,1,5, 0,5,4, 0,4,6, 0,6,2, 0,2,3, 0,3,1, 4,5,7, 4,7,6, 1,3,7, 1,7,5];
    geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.addGroup(0, 30, 0); geometry.addGroup(30, 6, 1);
    
    const structMat = new THREE.MeshStandardMaterial({ 
        map: stoneTexture, bumpMap: stoneBumpTexture, bumpScale: 1.0,
        color: 0x555555, roughness: 0.9, side: THREE.DoubleSide 
    });
    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, roughness: 0.05, metalness: 1.0, emissive: 0x002222, emissiveIntensity: 0.2, side: THREE.DoubleSide });
    
    const mesh = new THREE.Mesh(geometry, [structMat, mirrorMat]);
    mesh.userData = { isPrism: true }; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x555555 }));
    edges.name = 'selectionOutline'; edges.userData = { ignoreLaser: true }; group.add(edges);
    return group;
}

export function createHalfMirrorCube(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { type: 'mirror', mirrorType: 'half', draggable: true };
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
        -0.5,0.5,0.0, 0.5,0.5,0.0, -0.5,-0.5,0.0, 0.5,-0.5,0.0, -0.5,0.5,-0.5, 0.5,0.5,-0.5, -0.5,-0.5,-0.5, 0.5,-0.5,-0.5,
        -0.5,0.5,0.0, -0.5,0.5,-0.5, -0.5,-0.5,0.0, -0.5,-0.5,-0.5, 0.5,0.5,0.0, 0.5,0.5,-0.5, 0.5,-0.5,0.0, 0.5,-0.5,-0.5,
        -0.5,0.5,0.0, 0.5,0.5,0.0, -0.5,0.5,-0.5, 0.5,0.5,-0.5, -0.5,-0.5,0.0, 0.5,-0.5,0.0, -0.5,-0.5,-0.5, 0.5,-0.5,-0.5,
    ]);
    const indices = [0,2,1, 2,3,1, 4,5,6, 5,7,6, 8,10,9, 10,11,9, 12,13,14, 13,15,14, 16,17,18, 17,19,18, 20,22,21, 22,23,21];
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.clearGroups(); geometry.addGroup(0, 6, 1); geometry.addGroup(6, 30, 0);
    
    const structMat = new THREE.MeshStandardMaterial({ 
        map: stoneTexture, bumpMap: stoneBumpTexture, bumpScale: 1.0,
        color: 0x555555, roughness: 0.9, side: THREE.DoubleSide 
    });
    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, roughness: 0.0, metalness: 1.0, emissive: 0x222222, emissiveIntensity: 0.2, side: THREE.DoubleSide });
    
    const mesh = new THREE.Mesh(geometry, [structMat, mirrorMat]);
    mesh.userData = { isPrism: true }; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x777777 }));
    edges.name = 'selectionOutline'; edges.userData = { ignoreLaser: true }; group.add(edges);
    return group;
}

export function createFixedDoubleMirror(x, y, z, rotation = [0,0,0]) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.set(rotation[0], rotation[1], rotation[2]);
    group.userData = { type: 'doubleMirror', draggable: false };
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
        -0.5,0.5,0.0, 0.5,0.5,0.0, -0.5,-0.5,0.0, 0.5,-0.5,0.0, -0.5,0.5,0.1, -0.5,0.5,-0.1, -0.5,-0.5,0.1, -0.5,-0.5,-0.1,
         0.5,0.5,0.1, 0.5,0.5,-0.1, 0.5,-0.5,0.1, 0.5,-0.5,-0.1, -0.5,0.5,0.1, 0.5,0.5,0.1, -0.5,0.5,-0.1, 0.5,0.5,-0.1,
        -0.5,-0.5,0.1, 0.5,-0.5,0.1, -0.5,-0.5,-0.1, 0.5,-0.5,-0.1,
    ]);
    const indices = [0,2,1, 2,3,1, 4,5,6, 5,7,6, 8,10,9, 10,11,9, 12,13,14, 13,15,14, 16,17,18, 17,19,18];
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.clearGroups(); geometry.addGroup(0, 6, 1); geometry.addGroup(6, 24, 0);
    const structMat = new THREE.MeshStandardMaterial({ 
        map: stoneTexture, bumpMap: stoneBumpTexture, bumpScale: 1.0,
        color: 0x555555, roughness: 0.9, side: THREE.DoubleSide 
    });
    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xaaccff, roughness: 0.0, metalness: 1.0, emissive: 0x222222, emissiveIntensity: 0.2, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, [structMat, mirrorMat]);
    mesh.userData = { isPrism: true }; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x777777 }));
    edges.name = 'selectionOutline'; edges.userData = { ignoreLaser: true }; group.add(edges);
    return group;
}

export function createPlayer() {
    const group = new THREE.Group(); 
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1, 4, 8), new THREE.MeshStandardMaterial({ color: 0x888888 })); 
    group.add(body);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 })); 
    visor.position.set(0, 0.5, -0.3); group.add(visor); 
    return group;
}

export function createColorSensor(x, y, z, dir, targetColor) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { type: 'sensor', isFixed: true, isHit: false, dir: new THREE.Vector3(...dir).normalize(), targetColor: targetColor };
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    group.add(body);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.05), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x000000 }));
    lens.name = "sensorLens";
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.02), new THREE.MeshStandardMaterial({ color: targetColor, transparent: true, opacity: 0.5 }));
    const dirKey = dir.join(','); 
    switch (dirKey) {
        case "1,0,0":  lens.position.x = 0.5; frame.position.x = 0.49; lens.rotation.y = Math.PI/2; break;
        case "-1,0,0": lens.position.x = -0.5; frame.position.x = -0.49; lens.rotation.y = -Math.PI/2; break;
        case "0,1,0":  lens.position.y = 0.5; frame.position.y = 0.49; lens.rotation.x = -Math.PI/2; break;
        case "0,-1,0": lens.position.y = -0.5; frame.position.y = -0.49; lens.rotation.x = Math.PI/2; break;
        case "0,0,1":  lens.position.z = 0.5; frame.position.z = 0.49; break;
        case "0,0,-1": lens.position.z = -0.5; frame.position.z = -0.49; lens.rotation.y = Math.PI; break;
    }
    group.add(lens, frame);
    return group;
}

// [분산 큐브 - 최종 수정: 삼각기둥 + HitBox 설정]
export function createDispersionCube(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { type: 'mirror', mirrorType: 'dispersion', draggable: true };

    // 삼각기둥 형태
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); 
    shape.lineTo(-0.5, 0.5); 
    shape.lineTo(0.5, 0.5); 
    shape.lineTo(0, 0); 

    const extrudeSettings = { steps: 1, depth: 0.6, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center(); 

    const material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, transmission: 0.9, opacity: 1, metalness: 0, roughness: 0,
        ior: 1.5, thickness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.2
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2; 
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData = { isDispersion: true }; 
    group.add(mesh);

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x00ffff }));
    edges.rotation.x = Math.PI / 2;
    edges.userData = { ignoreLaser: true }; 
    group.add(edges);

    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0x777777 }));
    outline.name = 'selectionOutline'; outline.userData = { ignoreLaser: true }; 
    group.add(outline);

    // [중요] HitBox에 ignoreLaser: true 추가하여 레이저가 관통하게 함
    const hitBox = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshBasicMaterial({ visible: false }));
    hitBox.userData = { ignoreLaser: true }; 
    group.add(hitBox);

    return group;
}

export function createFixedCube(color, x, y, z, type) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({ 
        color: color, emissive: color, emissiveIntensity: 0.3, roughness: 0.3, metalness: 0.7, toneMapped: true, flatShading: true
    }));
    mesh.position.set(x, y, z); 
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
    edges.name = 'fixedCubeEdges';
    // mesh.add(edges);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData = { type: type, isFixed: true }; 
    return mesh;
}