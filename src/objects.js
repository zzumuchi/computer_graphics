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

    // 1-1. 바닥
    const floor = new THREE.Mesh(wallGeo, wallMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -halfSize;
    floor.userData = { isSurface: true, type: 'floor' };
    group.add(floor);

    // 1-2. 왼쪽 벽
    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.x = -halfSize;
    leftWall.userData = { isSurface: true, type: 'wall' };
    group.add(leftWall);

    // 1-3. 뒤쪽 벽
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

// --- 3. 반사 큐브 (수정됨: ignoreLaser 태그 추가) ---
export function createMirrorCube(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { type: 'mirror', draggable: true };

    // 3-1. 외부 투명 박스
    const outerGeo = new THREE.BoxGeometry(1, 1, 1);
    const outerMat = new THREE.MeshPhysicalMaterial({
        color: 0xaaccff,
        transparent: true,
        opacity: 0.3,
        roughness: 0.1,
        transmission: 0.8,
        thickness: 1.0,
        side: THREE.FrontSide, // 앞면만 렌더링
    });
    const outerBox = new THREE.Mesh(outerGeo, outerMat);
    
    // [핵심 수정] 레이저가 이 박스는 무시하고 통과하도록 태그 설정
    outerBox.userData = { ignoreLaser: true }; 
    
    group.add(outerBox);

    // 테두리 (Edges)
    const edgesGeo = new THREE.EdgesGeometry(outerGeo);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x88aaff, linewidth: 2 });
    const edges = new THREE.LineSegments(edgesGeo, edgesMat);
    edges.userData = { ignoreLaser: true }; // 테두리도 레이저 무시
    group.add(edges);


    // 3-2. 내부 반사면 (거울)
    const mirrorGeo = new THREE.PlaneGeometry(1.414, 1);
    const mirrorMat = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa,
        roughness: 0.0,
        metalness: 1.0,
        side: THREE.DoubleSide
    });
    const mirrorSurface = new THREE.Mesh(mirrorGeo, mirrorMat);
    
    mirrorSurface.rotation.x = Math.PI / 4; 
    mirrorSurface.userData = { isReflectiveSurface: true }; 
    
    group.add(mirrorSurface);

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