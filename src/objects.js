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

// ... (이하 createFixedCube, createMirrorCube, createPlayer 등 기존 코드 유지) ...
export function createFixedCube(color, x, y, z, type) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: color, emissive: 0x000000, emissiveIntensity: 0.0, roughness: 0.5, metalness: 0.1 }));
    mesh.position.set(x, y, z); mesh.userData = { type: type, isFixed: true }; return mesh;
}
export function createMirrorCube(x, y, z) {
    const group = new THREE.Group(); group.position.set(x, y, z); group.userData = { type: 'mirror', draggable: true };
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([-0.5, 0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3)); geometry.computeVertexNormals(); geometry.addGroup(0, 6, 1); geometry.addGroup(6, 24, 0); 
    const structMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0.2 });
    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xaaccff, roughness: 0.1, metalness: 0.9, emissive: 0x112233, emissiveIntensity: 0.1 });
    const prismMesh = new THREE.Mesh(geometry, [structMat, mirrorMat]); prismMesh.userData = { isPrism: true }; prismMesh.castShadow = true; prismMesh.receiveShadow = true; group.add(prismMesh);
    const edgesGeo = new THREE.EdgesGeometry(geometry); const edgesMat = new THREE.LineBasicMaterial({ color: 0x555555, linewidth: 1 });
    const edges = new THREE.LineSegments(edgesGeo, edgesMat); edges.name = 'selectionOutline'; edges.userData = { ignoreLaser: true }; group.add(edges); return group;
}
export function createPlayer() {
    const group = new THREE.Group(); const bodyGeo = new THREE.CapsuleGeometry(0.4, 1, 4, 8); const bodyMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3 }); const body = new THREE.Mesh(bodyGeo, bodyMat); group.add(body);
    const visorGeo = new THREE.BoxGeometry(0.5, 0.2, 0.3); const visorMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 }); const visor = new THREE.Mesh(visorGeo, visorMat); visor.position.set(0, 0.5, -0.3); group.add(visor); return group;
}