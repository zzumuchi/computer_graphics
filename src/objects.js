import * as THREE from 'three';

// --- 1. 룸 생성 ---
export function createRoom(size) {
    const group = new THREE.Group();
    const halfSize = size / 2;

    const wallMat = new THREE.MeshStandardMaterial({
        color: 0x555555, 
        side: THREE.DoubleSide,
        roughness: 0.9,
        metalness: 0.1
    });
    const wallGeo = new THREE.PlaneGeometry(size, size);

    // 바닥
    const floor = new THREE.Mesh(wallGeo, wallMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -halfSize;
    floor.userData = { isSurface: true, type: 'floor' };
    group.add(floor);

    // 왼쪽 벽
    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.x = -halfSize;
    leftWall.userData = { isSurface: true, type: 'wall' };
    group.add(leftWall);

    // 뒤쪽 벽
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.z = -halfSize;
    backWall.userData = { isSurface: true, type: 'wall' };
    group.add(backWall);

    return group;
}

// 2. 고정 큐브
export function createFixedCube(color, x, y, z) {
    return new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshLambertMaterial({ color: color, emissive: color, emissiveIntensity: 0.5 })
    ).translateX(x).translateY(y).translateZ(z);
}

// --- 3. 반사 큐브 (불투명 거울 적용) ---
export function createMirrorCube(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { type: 'mirror', draggable: true };

    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
        // 1. 빗면 (Mirror Surface)
        -0.5, 0.5, 0.5,   0.5, -0.5, 0.5,   -0.5, 0.5, -0.5, 
        0.5, -0.5, 0.5,   0.5, -0.5, -0.5,  -0.5, 0.5, -0.5, 

        // 2. 바닥면
        -0.5, -0.5, 0.5,  0.5, -0.5, 0.5,   -0.5, -0.5, -0.5,
        0.5, -0.5, 0.5,   0.5, -0.5, -0.5,  -0.5, -0.5, -0.5,

        // 3. 뒷면
        -0.5, -0.5, 0.5,  -0.5, -0.5, -0.5, -0.5, 0.5, 0.5,
        -0.5, -0.5, -0.5, -0.5, 0.5, -0.5,  -0.5, 0.5, 0.5,

        // 4. 옆면 1
        -0.5, -0.5, 0.5,  -0.5, 0.5, 0.5,   0.5, -0.5, 0.5,

        // 5. 옆면 2
        -0.5, -0.5, -0.5, 0.5, -0.5, -0.5,  -0.5, 0.5, -0.5
    ]);

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();

    geometry.addGroup(0, 6, 1);  // 빗면 -> Material 1
    geometry.addGroup(6, 24, 0); // 나머지 -> Material 0

    // [Material 0] 구조체: 불투명한 흰색
    const structMat = new THREE.MeshStandardMaterial({
        color: 0xdddddd, 
        roughness: 0.8,
        metalness: 0.1
    });

    // [Material 1] 반사면: 불투명하고 반짝이는 하늘색 거울
    // 투명도(transparent) 제거, metalness 높임
    const mirrorMat = new THREE.MeshStandardMaterial({
        color: 0xaaccff, // 약간 푸른빛이 도는 거울색
        roughness: 0.1,  // 매끈함
        metalness: 0.9,  // 금속성 (반사 느낌)
        emissive: 0x112233, // 약간의 자체 발광으로 어둠 속에서도 식별 가능
        emissiveIntensity: 0.2
    });

    const prismMesh = new THREE.Mesh(geometry, [structMat, mirrorMat]);
    prismMesh.userData = { isPrism: true };
    prismMesh.castShadow = true;
    prismMesh.receiveShadow = true;
    group.add(prismMesh);

    // 테두리
    const edgesGeo = new THREE.EdgesGeometry(geometry);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 1 });
    const edges = new THREE.LineSegments(edgesGeo, edgesMat);
    edges.userData = { ignoreLaser: true };
    group.add(edges);

    return group;
}

// 4. 문
export function createDoor() {
    const group = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.2), new THREE.MeshStandardMaterial({ color: 0x111 }));
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x555 }));
    group.add(frame, panel);
    group.position.set(2, -3, -4.9);
    group.userData = { panel: panel };
    return group;
}

// 5. 플레이어
export function createPlayer() {
    const p = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.4, 1, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0xaaaaaa })
    );
    p.position.set(0, -4, 0);
    return p;
}