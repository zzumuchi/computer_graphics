import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const maxReflections = 10; 

let laserGroup;
const meshPool = [];

// 1. 레이저 초기화
export function createLaserLine() {
    laserGroup = new THREE.Group();
    return laserGroup;
}

// 2. 레이저 업데이트
export function updateLaserSystem(sceneParams, laserGroupObject, isActive) {
    const { source, sensor, mirrors, door } = sceneParams;

    // [핵심] 비활성 상태면 레이저를 숨기고 종료
    if (!isActive) {
        meshPool.forEach(mesh => { mesh.visible = false; });
        sensor.material.emissiveIntensity = 0.0; // 센서 끔
        sensor.material.color.setHex(0x00ff00); // 기본 색 복구
        return false;
    }

    let rayOrigin = source.position.clone();
    let rayDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(source.quaternion).normalize();

    const points = [];
    points.push(rayOrigin.clone());

    let hitSensor = false;
    const interactables = [sensor, ...mirrors];

    for (let i = 0; i < maxReflections; i++) {
        raycaster.set(rayOrigin, rayDirection);
        const intersects = raycaster.intersectObjects(interactables, true);
        
        const hit = intersects.find(intersect => !intersect.object.userData.ignoreLaser);

        if (hit) {
            points.push(hit.point);

            if (hit.object === sensor) {
                hitSensor = true;
                break;
            }

            if (hit.object.userData.isPrism) {
                if (hit.face.materialIndex === 1) { 
                    const incomingVec = rayDirection.clone();
                    const normalVec = hit.face.normal.clone();
                    normalVec.transformDirection(hit.object.matrixWorld).normalize();

                    const reflectedVec = incomingVec.reflect(normalVec).normalize();
                    rayOrigin = hit.point.clone().add(normalVec.multiplyScalar(0.05));
                    rayDirection = reflectedVec;
                } else {
                    break; 
                }
            } else {
                break; 
            }
        } else {
            points.push(rayOrigin.clone().add(rayDirection.multiplyScalar(50)));
            break;
        }
    }

    // --- 시각화 (원기둥) ---
    meshPool.forEach(mesh => { mesh.visible = false; });

    for (let i = 0; i < points.length - 1; i++) {
        const start = points[i];
        const end = points[i+1];
        const distance = start.distanceTo(end);

        let segment = meshPool[i];
        if (!segment) {
            const geometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8); 
            geometry.rotateX(-Math.PI / 2); 
            
            const material = new THREE.MeshBasicMaterial({ 
                color: 0xffffff,
                toneMapped: false 
            });
            
            segment = new THREE.Mesh(geometry, material);
            segment.geometry.translate(0, 0, 0.5); 
            
            meshPool.push(segment);
            laserGroupObject.add(segment);
        }

        segment.visible = true;
        segment.position.copy(start);
        segment.lookAt(end);
        segment.scale.z = distance; 
    }

    // --- 센서 반응 ---
    if (hitSensor) {
        // 성공 시: 밝은 연두색 + 강한 발광 (Bloom 효과 발생)
        sensor.material.color.setHex(0x55ff55); 
        sensor.material.emissive.setHex(0x55ff55);
        sensor.material.emissiveIntensity = 2.0; 
    } else {
        // 실패 시: 기본 초록 + 발광 없음
        sensor.material.color.setHex(0x00ff00);
        sensor.material.emissive.setHex(0x000000);
        sensor.material.emissiveIntensity = 0.0;
    }
    
    return hitSensor;
}