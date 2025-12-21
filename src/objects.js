import * as THREE from 'three';

// --- 1. 벽돌 룸 생성 ---
// [objects.js] 의 createBrickRoom 함수

// [objects.js] createBrickRoom 함수

export function createBrickRoom(size) {
    const group = new THREE.Group();
    const halfSize = size / 2;
    
    // [수정] 벽 두께를 1.0 -> 0.6으로 줄임 (벽돌 깊이와 일치)
    const thickness = 0.6; 

    const wallMat = new THREE.MeshStandardMaterial({
        color: 0x444444,      
        roughness: 0.2,       
        metalness: 0.1,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide 
    });

    // 바닥
    const floorGeo = new THREE.BoxGeometry(size, thickness, size);
    const floor = new THREE.Mesh(floorGeo, wallMat.clone());
    floor.position.set(0, -halfSize - (thickness / 2), 0);
    floor.userData = { isSurface: true, type: 'floor' };
    group.add(floor);

    // 벽 생성 함수
    function createDoubleWall(name, x, y, z, width, height, depth) {
        const wrapper = new THREE.Group();
        wrapper.name = name;

        // A. 통짜 벽
        const solidGeo = new THREE.BoxGeometry(width, height, depth);
        const solidMesh = new THREE.Mesh(solidGeo, wallMat.clone());
        solidMesh.position.set(x, y, z);
        solidMesh.userData = { isSurface: true, type: 'solidWall' }; 
        wrapper.add(solidMesh);

        // B. 조각 벽 (직육면체 벽돌)
        const brickGroup = new THREE.Group();
        brickGroup.visible = false; 
        brickGroup.userData = { type: 'brickGroup' }; 

        const isXWall = (width < 2); // 두께가 얇은 쪽이 X축(좌우 벽)인가?

        // [수정] 벽돌 사이즈 계산 로직 최적화
        // 목표: (길이 1.2) x (높이 0.6) x (두께 0.6)
        const targetLength = 1.2;
        const targetHeight = 0.6;
        
        // 1. 벽돌의 '두께' 방향 크기 (벽의 두께와 일치시킴)
        // XWall이면 width가 두께, 아니면 depth가 두께
        const tW = isXWall ? width : (width / Math.ceil(width / targetLength));
        const tH = targetHeight;
        const tD = isXWall ? (depth / Math.ceil(depth / targetLength)) : depth;

        // 실제 지오메트리 생성
        const brickGeo = new THREE.BoxGeometry(tW, tH, tD);
        
        const cols = isXWall ? Math.ceil(depth / tD) : Math.ceil(width / tW);
        const rows = Math.ceil(height / tH);

        // 시작점 계산 (중앙 정렬)
        const startH = isXWall ? (z - depth/2 + tD/2) : (x - width/2 + tW/2);
        const startV = y - height/2 + tH/2;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const mat = wallMat.clone();
                const mesh = new THREE.Mesh(brickGeo, mat);
                
                const hPos = startH + c * (isXWall ? tD : tW);
                const vPos = startV + r * tH;

                if (isXWall) mesh.position.set(x, vPos, hPos);
                else mesh.position.set(hPos, vPos, z);

                // 속도 계산 (랜덤 낙하)
                mesh.userData = { 
                    isBrick: true, 
                    velocity: new THREE.Vector3(
                        (Math.random() - 0.5) * 0.2, 
                        Math.random() * -0.2,        
                        (Math.random() - 0.5) * 0.2  
                    ),
                    rotVel: new THREE.Vector3(
                        Math.random() * 0.1, 
                        Math.random() * 0.1, 
                        Math.random() * 0.1
                    )
                };
                brickGroup.add(mesh);
            }
        }
        wrapper.add(brickGroup);
        return wrapper;
    }

    // 벽 배치 (두께가 thickness로 변경됨)
    group.add(createDoubleWall('Wall_Left', -halfSize - thickness/2, 0, 0, thickness, size, size));
    group.add(createDoubleWall('Wall_Right', halfSize + thickness/2, 0, 0, thickness, size, size));
    group.add(createDoubleWall('Wall_Back', 0, 0, -halfSize - thickness/2, size, size, thickness));
    group.add(createDoubleWall('Wall_Front', 0, 0, halfSize + thickness/2, size, size, thickness));

    return group;
}

// ... (이하 createFixedCube, createMirrorCube, createPlayer 등 기존 코드 유지) ...
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

export function createMirrorCube(x, y, z) {
    const group = new THREE.Group(); 
    group.position.set(x, y, z); 
    group.userData = { type: 'mirror', draggable: true };
    
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
    group.userData = { type: 'mirror', draggable: true };

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
    group.userData = { type: 'mirror', draggable: true };

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

// 분산 큐브 (Prism): 빛을 받으면 Red/Blue 45도 갈래로 나눔
export function createDispersionCube(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { type: 'dispersion', draggable: true };

    // 1. 큐브 형태 (조금 작게 설정하여 내부 코어 느낌)
    const geometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    
    // 프리즘 느낌의 재질 (반투명 화이트)
    const material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 0.9,  // 유리처럼 투명하게
        opacity: 1,
        metalness: 0,
        roughness: 0,
        ior: 1.5,
        thickness: 0.5,
        emissive: 0xffffff,
        emissiveIntensity: 0.2
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { isDispersion: true }; // Raycaster 식별용
    group.add(mesh);

    // 2. 외곽 프레임 (Dispersion임을 명확히 함)
    const frameGeo = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(frameGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    const frame = new THREE.LineSegments(edges, lineMat);
    frame.userData = { ignoreLaser: true };
    group.add(frame);

    // 3. 선택용 투명 박스 (클릭 판정 범위 확보)
    const hitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    hitBox.userData = { isDispersion: true }; // 레이저 충돌체
    group.add(hitBox);

    // 선택 효과용 테두리
    const selEdges = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xaaaaaa }));
    selEdges.name = 'selectionOutline';
    selEdges.userData = { ignoreLaser: true };
    group.add(selEdges);

    return group;
}