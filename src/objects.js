import * as THREE from 'three';

// --- 1. 룸 생성 (두께 추가) ---
export function createRoom(size) {
    const group = new THREE.Group();
    const halfSize = size / 2;
    const thickness = 1.0; // 벽 두께

    const wallMat = new THREE.MeshStandardMaterial({
        color: 0x111111, 
        side: THREE.DoubleSide,
        roughness: 0.95, 
        metalness: 0.05
    });

    // 1-1. 바닥 (Floor)
    // 크기: (가로+두께, 두께, 세로+두께)
    const floorGeo = new THREE.BoxGeometry(size + thickness * 2, thickness, size + thickness * 2);
    const floor = new THREE.Mesh(floorGeo, wallMat);
    // 위치: 바닥면이 y = -halfSize에 오도록, 두께의 절반만큼 더 내림
    floor.position.y = -halfSize - (thickness / 2);
    floor.userData = { isSurface: true, type: 'floor' };
    group.add(floor);

    // 1-2. 왼쪽 벽 (Left)
    // 크기: (두께, 높이+두께, 깊이)
    const leftGeo = new THREE.BoxGeometry(thickness, size + thickness, size + thickness);
    const leftWall = new THREE.Mesh(leftGeo, wallMat);
    // 위치: x좌표를 왼쪽으로 밀고, y좌표는 바닥 두께 감안하여 조정
    leftWall.position.x = -halfSize - (thickness / 2);
    leftWall.position.y = thickness / 2; // 바닥 위로 올라오게
    // 뒤쪽 벽과의 겹침 방지를 위해 z축 조정은 선택사항이나 여기선 겹치게 둠 (단순함 위해)
    leftWall.userData = { isSurface: true, type: 'wall' };
    group.add(leftWall);

    // 1-3. 뒤쪽 벽 (Back)
    // 크기: (가로+두께*2, 높이+두께, 두께)
    const backGeo = new THREE.BoxGeometry(size + thickness * 2, size + thickness, thickness);
    const backWall = new THREE.Mesh(backGeo, wallMat);
    backWall.position.z = -halfSize - (thickness / 2);
    backWall.position.y = thickness / 2;
    backWall.userData = { isSurface: true, type: 'wall' };
    group.add(backWall);

    return group;
}

// 2. 고정 큐브
export function createFixedCube(color, x, y, z, type) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ 
            color: color,
            emissive: 0x000000, 
            emissiveIntensity: 0.0,
            roughness: 0.5, 
            metalness: 0.1 
        })
    );
    mesh.position.set(x, y, z);
    mesh.userData = { type: type, isFixed: true }; 
    return mesh;
}

// --- 3. 반사 큐브 ---
export function createMirrorCube(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { type: 'mirror', draggable: true };

    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
        -0.5, 0.5, 0.5,   0.5, -0.5, 0.5,   -0.5, 0.5, -0.5, 
        0.5, -0.5, 0.5,   0.5, -0.5, -0.5,  -0.5, 0.5, -0.5, 
        -0.5, -0.5, 0.5,  0.5, -0.5, 0.5,   -0.5, -0.5, -0.5,
        0.5, -0.5, 0.5,   0.5, -0.5, -0.5,  -0.5, -0.5, -0.5,
        -0.5, -0.5, 0.5,  -0.5, -0.5, -0.5, -0.5, 0.5, 0.5,
        -0.5, -0.5, -0.5, -0.5, 0.5, -0.5,  -0.5, 0.5, 0.5,
        -0.5, -0.5, 0.5,  -0.5, 0.5, 0.5,   0.5, -0.5, 0.5,
        -0.5, -0.5, -0.5, 0.5, -0.5, -0.5,  -0.5, 0.5, -0.5
    ]);

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    geometry.addGroup(0, 6, 1);  
    geometry.addGroup(6, 24, 0); 

    const structMat = new THREE.MeshStandardMaterial({
        color: 0x222222, roughness: 0.8, metalness: 0.2
    });

    const mirrorMat = new THREE.MeshStandardMaterial({
        color: 0xaaccff, roughness: 0.1, metalness: 0.9,  
        emissive: 0x112233, emissiveIntensity: 0.1
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

// 4. 문
export function createDoor() {
    const group = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.2), new THREE.MeshStandardMaterial({ color: 0x050505 }));
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    group.add(frame, panel);
    group.position.set(2, -3, -4.9);
    group.userData = { panel: panel };
    return group;
}

// 5. 플레이어
export function createPlayer() {
    const p = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.4, 1, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x888888 })
    );
    p.position.set(0, -4, 0);
    return p;
}