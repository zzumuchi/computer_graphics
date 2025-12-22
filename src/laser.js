import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const maxReflections = 20; 

let laserGroup;
const meshPool = [];

// 1. 레이저 초기화
export function createLaserLine() {
    laserGroup = new THREE.Group();
    return laserGroup;
}

// 2. 레이저 업데이트
export function updateLaserSystem(sceneParams, laserLine, isActive) {
    const { source, sensors, mirrors } = sceneParams;

    // [핵심] 비활성 상태면 레이저를 숨기고 종료
    if (!source || !isActive) {
        laserLine.visible = false;
        // 모든 센서의 충돌 판정 초기화
        if (sensors) sensors.forEach(s => s.userData.isHit = false);
        return false;
    }

    let rayOrigin = source.position.clone();
    let rayDirection = source.userData.dir ? source.userData.dir.clone().normalize() : new THREE.Vector3(0, 0, 1);
    let currentColor = 0xffffff;
    const points = [];
    points.push(rayOrigin.clone());

    let hitAllSensors = false;
    const interactables = sensors.concat(mirrors).filter(obj => obj && obj instanceof THREE.Object3D);

    for (let i = 0; i < maxReflections; i++) {
        raycaster.set(rayOrigin, rayDirection);
        const intersects = raycaster.intersectObjects(interactables, true);
        
        const hit = intersects.find(intersect => !intersect.object.userData.ignoreLaser);

        if (hit) {
            points.push(hit.point.clone());
            const obj = hit.object;
            const parent = obj.parent || obj;

            // 2. 센서 충돌 판정 (방향 + 색상)
            if (parent.userData.type === 'sensor') {
                const sensorData = parent.userData;
                const sensorDir = sensorData.dir; // objects.js에서 설정한 수광면 방향
                
                // 내적을 이용한 입사각 판정 (45도 대응을 위해 0.5 이상 체크)
                const dot = sensorDir.dot(rayDirection.clone().negate());
                
                const isColorMatch = (currentColor === sensorData.targetColor);

                // [참고] 조원분의 색상 로직이 있다면: (currentLaserColor === parent.userData.targetColor)
                if (dot > 0.5 && isColorMatch) {
                    parent.userData.isHit = true;
                    // 시각적 피드백: 센서 렌즈를 레이저 색상으로 발광
                    const lens = parent.getObjectByName("sensorLens");
                    if (lens) {
                        lens.material.emissive.setHex(currentColor);
                        lens.material.emissiveIntensity = 2.0;
                    }
                } else {
                    // 조건이 맞지 않으면 hit 해제
                    sensorData.isHit = false;
                    const lens = parent.getObjectByName("sensorLens");
                    if (lens) {
                        lens.material.emissive.setHex(0x000000);
                    }
                }
                break; // 센서에 맞으면 레이저는 멈춤
            }

            // 3. 거울 반사 로직 (materialIndex 1이 거울면)
            if (obj.userData.isPrism && hit.face.materialIndex === 1) {
                const normal = hit.face.normal.clone().transformDirection(obj.matrixWorld).normalize();
                
                /**
                 * [양면 거울 핵심 로직]
                 * 레이저 방향과 법선이 같은 방향을 보고 있다면 (내적이 양수),
                 * 레이저가 거울의 '뒷면'에 맞은 것이므로 법선을 반전시켜야 합니다.
                 */
                if (rayDirection.dot(normal) > 0) {
                    normal.negate();
                }
                rayDirection.reflect(normal).normalize();
                rayOrigin = hit.point.clone().add(normal.multiplyScalar(0.01));
                continue;
            }

            // 그 외(구조물 등)에 맞으면 멈춤
            break; 
        } else {
            // 아무것도 안 맞으면 맵 끝까지 발사
            const endPoint = rayOrigin.clone().add(rayDirection.clone().multiplyScalar(50));
            points.push(endPoint);
            break;
        }
    }

    // --- 시각화 (원기둥) ---
    meshPool.forEach(mesh => { mesh.visible = false; });
    laserLine.visible = true;

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
            laserLine.add(segment);
        }

        segment.visible = true;
        segment.position.copy(start);
        segment.lookAt(end);
        segment.scale.z = distance; 
    }

    // --- 3. 승리 판정 리턴 ---
    // [수정] 모든 센서가 활성화되었는지 확인
    hitAllSensors = sensors.length > 0 && sensors.every(s => s.userData.isHit);
    return hitAllSensors;
}