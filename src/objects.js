import * as THREE from 'three';

// --- 1. 벽돌 룸 생성 ---
export function createBrickRoom(size) {
    const group = new THREE.Group();
    const halfSize = size / 2;
    const thickness = 1.0; 

    // 벽 재질
    const wallMat = new THREE.MeshStandardMaterial({
        color: 0x444444,      
        roughness: 0.2,       
        metalness: 0.1,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide 
    });

    // 1-1. 바닥
    const floorGeo = new THREE.BoxGeometry(size, thickness, size);
    const floor = new THREE.Mesh(floorGeo, wallMat.clone());
    floor.position.set(0, -halfSize - (thickness / 2), 0);
    floor.userData = { isSurface: true, type: 'floor' };
    group.add(floor);

    // [삭제됨] 그리드 생성 코드 제거

    // 1-2. 벽 생성 함수
    function createDoubleWall(name, x, y, z, width, height, depth) {
        const wrapper = new THREE.Group();
        wrapper.name = name;

        // A. 통짜 벽
        const solidGeo = new THREE.BoxGeometry(width, height, depth);
        const solidMesh = new THREE.Mesh(solidGeo, wallMat.clone());
        solidMesh.position.set(x, y, z);
        solidMesh.userData = { isSurface: true, type: 'solidWall' }; 
        wrapper.add(solidMesh);

        // B. 조각 벽
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
                    velocity: new THREE.Vector3((Math.random() - 0.5) * 0.3, Math.random() * -0.2, (Math.random() - 0.5) * 0.3),
                    rotVel: new THREE.Vector3(Math.random() * 0.1, Math.random() * 0.1, Math.random() * 0.1)
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

export function createFixedCube(color, x, y, z, type) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1), 
        new THREE.MeshStandardMaterial({ 
            color: color, emissive: 0x000000, 
            emissiveIntensity: 0.0, roughness: 0.5, metalness: 0.1 
        })
    );
    mesh.position.set(x, y, z); 
    mesh.userData = { type: type, isFixed: true }; 
    return mesh;
}

export function createFixedObstacle(x, y, z, w = 1, h = 1, d = 1, color = 0x444444) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ 
        color: color, 
        roughness: 0.9, 
        metalness: 0.1,
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
    mesh.add(edges);

    return mesh;
}

export function createLaserSource(x, y, z, dir) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // [중요] laser.js가 사용할 수 있도록 Vector3로 변환하여 저장
    // dir이 [1, 0, 0] 형태라면 new THREE.Vector3(...dir)로 변환해야 합니다.
    const directionVector = new THREE.Vector3(...dir).normalize();
    group.userData = { 
        type: 'source', 
        isFixed: true, 
        dir: directionVector // laser.js는 이 이름을 참조합니다.
    };

    // 1. 메인 본체 (어두운 회색)
    const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // 2. 발사구(렌즈) - Z축 앞면에 작은 사각형 추가
    const lensGeo = new THREE.BoxGeometry(0.6, 0.6, 0.1);
    const lensMat = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, 
        emissive: 0x000000, 
        emissiveIntensity: 1.0 
    });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    // 본체 표면에 살짝 튀어나오게 배치 (0.5 + 두께절반)
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

export function createLaserSensor(x, y, z, dir, targetColor = 0xffffff) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { type: 'sensor', isFixed: true, isHit: false, 
        dir: new THREE.Vector3(...dir).normalize(), targetColor: targetColor};

    // 1. 센서 본체
    const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // 2. 수광 렌즈 (Z축 앞면)
    const lensGeo = new THREE.BoxGeometry(0.7, 0.7, 0.05);
    const lensMat = new THREE.MeshStandardMaterial({ 
        color: 0x004400, // 대기 상태: 어두운 초록
        emissive: 0x000000 
    });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    const dirKey = dir.join(','); 
    switch (dirKey) {
        case "1,0,0":  lens.position.x = 0.5; lens.rotation.y = Math.PI/2; break;
        case "-1,0,0": lens.position.x = -0.5; lens.rotation.y = -Math.PI/2; break;
        case "0,1,0":  lens.position.y = 0.5; lens.rotation.x = -Math.PI/2; break;
        case "0,-1,0": lens.position.y = -0.5; lens.rotation.x = Math.PI/2; break;
        case "0,0,1":  lens.position.z = 0.5; break;
        case "0,0,-1": lens.position.z = -0.5; lens.rotation.y = Math.PI; break;
    }
    lens.name = "sensorLens";
    group.add(lens);

    return group;
}

export function createColorSensor(x, y, z, dir, targetColor) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { type: 'sensor', isFixed: true, isHit: false,
        dir: new THREE.Vector3(...dir).normalize(), targetColor: targetColor };

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), bodyMat);
    group.add(body);

    // 수광 렌즈 - 테두리에 타겟 색상을 표시하여 구분함
    const lensMat = new THREE.MeshStandardMaterial({ 
        color: 0x111111, // 대기 상태 (꺼짐)
        emissive: 0x000000 
    });
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.05), lensMat);
    lens.name = "sensorLens";
    
    // 타겟 색상 가이드 (테두리)
    const frameGeo = new THREE.BoxGeometry(0.8, 0.8, 0.02);
    const frameMat = new THREE.MeshStandardMaterial({ color: targetColor, transparent: true, opacity: 0.5 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    
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

// 삼각 거울, 90도 반사.
export function createMirrorCube(x, y, z) {
    const group = new THREE.Group(); 
    group.position.set(x, y, z); 
    group.userData = { type: 'mirror', mirrorType: 'triangle', draggable: true };
    
    const geometry = new THREE.BufferGeometry();
    // 6개의 면을 구성하는 12개의 삼각형 (모든 면을 닫아 레이저 통과 방지)
    // 모든 면을 닫기 위한 정점 배열 (총 5개 면)
    const vertices = new Float32Array([
        // 1. 빗면 (Mirror - 사각형, materialIndex 1)
        -0.5, 0.5, -0.5,   -0.5, -0.5, 0.5,   0.5, -0.5, 0.5, 
         0.5, -0.5, 0.5,   0.5, 0.5, -0.5,  -0.5, 0.5, -0.5, 

        // 2. 밑면 (Bottom - 사각형, materialIndex 0)
        -0.5, -0.5, 0.5,  0.5, -0.5, -0.5,  -0.5, -0.5, -0.5,
        -0.5, -0.5, 0.5,  0.5, -0.5, 0.5,   0.5, -0.5, -0.5,

        // 3. 뒷면 (Back - 사각형, materialIndex 0)
        -0.5, -0.5, -0.5, 0.5, -0.5, -0.5,  -0.5, 0.5, -0.5,
         0.5, -0.5, -0.5, 0.5, 0.5, -0.5,   -0.5, 0.5, -0.5,

        // 4. 왼쪽 삼각 옆면 (Triangle Side 1, materialIndex 0)
        -0.5, -0.5, 0.5,  -0.5, 0.5, -0.5,  -0.5, -0.5, -0.5,

        // 5. 오른쪽 삼각 옆면 (Triangle Side 2, materialIndex 0)
         0.5, -0.5, 0.5,   0.5, -0.5, -0.5,  0.5, 0.5, -0.5
    ]);
    
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3)); 
    geometry.computeVertexNormals(); 
    geometry.addGroup(0, 6, 1); 
    geometry.addGroup(6, 18, 0); 

    const structMat = new THREE.MeshStandardMaterial({ 
        color: 0x333333, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide
    });
    const mirrorMat = new THREE.MeshStandardMaterial({ 
        color: 0xaaccff, roughness: 0.05, metalness: 1.0, 
        emissive: 0x112233, emissiveIntensity: 0.2, side: THREE.DoubleSide
    });
    const prismMesh = new THREE.Mesh(geometry, [structMat, mirrorMat]); 
    prismMesh.userData = { isPrism: true }; 
    prismMesh.castShadow = true; 
    prismMesh.receiveShadow = true; 
    group.add(prismMesh);

    const edgesGeo = new THREE.EdgesGeometry(geometry); 
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x555555, linewidth: 1 });
    const edges = new THREE.LineSegments(edgesGeo, edgesMat); 
    edges.name = 'selectionOutline'; 
    edges.userData = { ignoreLaser: true }; 
    group.add(edges); 
    
    return group;
}

// 사다리꼴 거울, 45도 또는 135도로 반사.
export function createTrapezoidMirrorCube(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { type: 'mirror', mirrorType: 'trapezoid', draggable: true };

    const geometry = new THREE.BufferGeometry();
    
    // 도면 수치 반영 (0.707, 0.293)
    // 큐브 중심(0,0,0)을 기준으로 -0.5 ~ 0.5 범위 내에서 좌표 설정
    const xLeft = -0.5;
    const xRightShort = -0.5 + 0.293; // 윗변 끝점
    const xRightLong = -0.5 + 0.707;  // 아랫변 끝점
    
    const vertices = new Float32Array([
        // --- 1. 밑면 (y = -0.5, 사다리꼴) ---
        xLeft,      -0.5,  0.5,  // 0: 앞-왼-하
        xRightLong, -0.5,  0.5,  // 1: 앞-오-하 (긴 변)
        xLeft,      -0.5, -0.5,  // 2: 뒤-왼-하
        xRightLong, -0.5, -0.5,  // 3: 뒤-오-하 (긴 변)

        // --- 2. 윗면 (y = 0.5, 사다리꼴) ---
        xLeft,       0.5,  0.5,  // 4: 앞-왼-상
        xRightShort,  0.5,  0.5,  // 5: 앞-오-상 (짧은 변)
        xLeft,       0.5, -0.5,  // 6: 뒤-왼-상
        xRightShort,  0.5, -0.5,  // 7: 뒤-오-상 (짧은 변)
    ]);

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    // 인덱스 정의 (삼각형 단위로 면 구성)
    const indices = [
        // 뒷면 (평면)
        2, 6, 7,  2, 7, 3,
        // 앞면 (평면)
        0, 1, 5,  0, 5, 4,
        // 왼쪽면 (직각면)
        0, 4, 6,  0, 6, 2,
        // 밑면 (사다리꼴)
        0, 2, 3,  0, 3, 1,
        // 윗면 (사다리꼴)
        4, 5, 7,  4, 7, 6,
        // 빗면 (거울면 - 중요!)
        1, 3, 7,  1, 7, 5 
    ];

    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // 재질 그룹 설정
    // 0~29 인덱스: 일반 구조물 (5개 면)
    // 30~35 인덱스: 거울면 (빗면)
    geometry.addGroup(0, 30, 0); 
    geometry.addGroup(30, 6, 1);

    const structMat = new THREE.MeshStandardMaterial({ 
        color: 0x333333, 
        roughness: 0.7, 
        metalness: 0.2 
    });
    
    const mirrorMat = new THREE.MeshStandardMaterial({ 
        color: 0x00ffff, // 하늘색 빛 (도면의 분광 느낌)
        roughness: 0.05, 
        metalness: 1.0,
        emissive: 0x002222,
        emissiveIntensity: 0.2
    });

    const mesh = new THREE.Mesh(geometry, [structMat, mirrorMat]);
    mesh.userData = { isPrism: true }; // laser.js에서 반사 로직을 타기 위함
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // 선택 효과용 테두리 (Edges)
    const edgesGeo = new THREE.EdgesGeometry(geometry);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x555555 });
    const edges = new THREE.LineSegments(edgesGeo, edgesMat);
    edges.name = 'selectionOutline';
    edges.userData = { ignoreLaser: true };
    group.add(edges);

    return group;
}

// 직육면체 거울 큐브 생성 (0.5 x 1 x 1), 넓은 면(Z축 앞면)이 거울면.
export function createHalfMirrorCube(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { type: 'mirror', mirrorType: 'half', draggable: true };

    const geometry = new THREE.BufferGeometry();
    
    // 1x1x0.5 크기의 정점 정의 (Z축 두께 0.5)
    const vertices = new Float32Array([
        // 0-3: 정면 (Mirror)
        -0.5,  0.5,  0.0,   0.5,  0.5,  0.0,  -0.5, -0.5,  0.0,   0.5, -0.5,  0.0,
        // 4-7: 후면
        -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,  -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,
        // 8-11: 좌면
        -0.5,  0.5,  0.0,  -0.5,  0.5, -0.5,  -0.5, -0.5,  0.0,  -0.5, -0.5, -0.5,
        // 12-15: 우면
         0.5,  0.5,  0.0,   0.5,  0.5, -0.5,   0.5, -0.5,  0.0,   0.5, -0.5, -0.5,
        // 16-19: 상면
        -0.5,  0.5,  0.0,   0.5,  0.5,  0.0,  -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,
        // 20-23: 하면
        -0.5, -0.5,  0.0,   0.5, -0.5,  0.0,  -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,
    ]);

    const indices = [
        0, 2, 1,  2, 3, 1,       // 정면 (Indices 0-5)
        4, 5, 6,  5, 7, 6,       // 후면
        8, 10, 9,  10, 11, 9,    // 좌면
        12, 13, 14,  13, 15, 14, // 우면
        16, 17, 18,  17, 19, 18, // 상면
        20, 22, 21,  22, 23, 21  // 하면
    ];

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // [중요] 그룹 설정: 정면(인덱스 0-5)만 재질 1번(거울), 나머지는 0번(구조물)
    geometry.clearGroups();
    geometry.addGroup(0, 6, 1);    // 정면 -> 거울 재질
    geometry.addGroup(6, 30, 0);   // 나머지 5개 면 -> 구조물 재질

    const structMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
    const mirrorMat = new THREE.MeshStandardMaterial({ 
        color: 0x00ff00, 
        roughness: 0.0, 
        metalness: 1.0,
        emissive: 0x222222,
        emissiveIntensity: 0.2
    });

    const mesh = new THREE.Mesh(geometry, [structMat, mirrorMat]);
    mesh.userData = { isPrism: true }; // laser.js 반사 로직 활성화
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // 선택 효과용 테두리
    const edgesGeo = new THREE.EdgesGeometry(geometry);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x777777 });
    const edges = new THREE.LineSegments(edgesGeo, edgesMat);
    edges.name = 'selectionOutline';
    edges.userData = { ignoreLaser: true };
    group.add(edges);

    return group;
}

export function createFixedDoubleMirror(x, y, z, rotation = [0,0,0]) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.set(rotation[0], rotation[1], rotation[2]);
    group.userData = { type: 'doubleMirror', draggable: false };

    const geometry = new THREE.BufferGeometry();
    
    const vertices = new Float32Array([
        // 0-3: 정면 (Mirror)
        -0.5,  0.5,  0.0,   0.5,  0.5,  0.0,  -0.5, -0.5,  0.0,   0.5, -0.5,  0.0,
        // 4-7: 좌면
        -0.5,  0.5,  0.1,  -0.5,  0.5, -0.1,  -0.5, -0.5,  0.1,  -0.5, -0.5, -0.1,
        // 8-11: 우면
         0.5,  0.5,  0.1,   0.5,  0.5, -0.1,   0.5, -0.5,  0.1,   0.5, -0.5, -0.1,
        // 12-15: 상면
        -0.5,  0.5,  0.1,   0.5,  0.5,  0.1,  -0.5,  0.5, -0.1,   0.5,  0.5, -0.1,
        // 16-19: 하면
        -0.5, -0.5,  0.1,   0.5, -0.5,  0.1,  -0.5, -0.5, -0.1,   0.5, -0.5, -0.1,
    ]);

    const indices = [
        0, 2, 1,  2, 3, 1,       // 정면 (Indices 0-5)
        4, 5, 6,  5, 7, 6,       // 좌면
        8, 10, 9,  10, 11, 9,    // 우면
        12, 13, 14,  13, 15, 14, // 상면
        16, 17, 18,  17, 19, 18 // 하면
    ];

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // [중요] 그룹 설정: 정면(인덱스 0-5)만 재질 1번(거울), 나머지는 0번(구조물)
    geometry.clearGroups();
    geometry.addGroup(0, 6, 1);    // 정면 -> 거울 재질
    geometry.addGroup(6, 24, 0);   // 나머지 5개 면 -> 구조물 재질

    const structMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
    const mirrorMat = new THREE.MeshStandardMaterial({ 
        color: 0xaaccff, 
        roughness: 0.0, 
        metalness: 1.0,
        emissive: 0x222222,
        emissiveIntensity: 0.2,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, [structMat, mirrorMat]);
    mesh.userData = { isPrism: true }; // laser.js 반사 로직 활성화
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // 선택 효과용 테두리
    const edgesGeo = new THREE.EdgesGeometry(geometry);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x777777 });
    const edges = new THREE.LineSegments(edgesGeo, edgesMat);
    edges.name = 'selectionOutline';
    edges.userData = { ignoreLaser: true };
    group.add(edges);

    return group;
}

export function createPlayer() {
    const group = new THREE.Group(); 
    
    const bodyGeo = new THREE.CapsuleGeometry(0.4, 1, 4, 8); 
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3 }); 
    const body = new THREE.Mesh(bodyGeo, bodyMat); 
    group.add(body);
    
    const visorGeo = new THREE.BoxGeometry(0.5, 0.2, 0.3); 
    const visorMat = new THREE.MeshStandardMaterial({ 
        color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 
    }); 
    const visor = new THREE.Mesh(visorGeo, visorMat); 
    visor.position.set(0, 0.5, -0.3); 
    group.add(visor); 
    return group;
}