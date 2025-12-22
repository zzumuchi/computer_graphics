import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const maxBounces = 20; // 최대 반사 횟수

let laserGroup;
const meshPool = []; // 성능 최적화를 위한 메쉬 재사용 풀

// 1. 레이저 그룹 초기화
export function createLaserLine() {
    laserGroup = new THREE.Group();
    return laserGroup;
}

// 2. 레이저 업데이트 시스템
export function updateLaserSystem(sceneParams, laserGroupObject, isActive) {
    const { source, sensor, mirrors } = sceneParams;

    // 비활성 상태면 레이저 숨김
    if (!isActive || !source) {
        meshPool.forEach(mesh => { mesh.visible = false; });
        if(sensor) {
            sensor.userData.isHit = false;
            const lens = sensor.getObjectByName("sensorLens");
            if(lens) {
                lens.material.emissive.setHex(0x000000);
                lens.material.emissiveIntensity = 0.5;
            }
        }
        return false;
    }

    // 초기 레이저 설정
    const startOrigin = source.position.clone();
    let startDir = new THREE.Vector3(0, 0, -1);
    if (source.userData.dir) startDir = source.userData.dir.clone().normalize();
    
    // BFS 탐색을 위한 큐 (빛이 갈라질 수 있으므로)
    const rayQueue = [{ 
        origin: startOrigin, 
        dir: startDir, 
        color: new THREE.Color(1, 1, 1), // 기본 흰색
        depth: 0,
        ignoreObject: null 
    }];

    const segmentsToDraw = [];
    const hitColors = new Set(); // 센서에 닿은 빛의 색상 기록
    let hitSensor = false;

    // 상호작용 가능한 물체 목록 (센서 + 거울 + 장애물)
    let interactables = [];
    if (sensor) interactables.push(sensor);
    if (mirrors) interactables = interactables.concat(mirrors);

    // --- 레이저 추적 루프 ---
    while (rayQueue.length > 0) {
        const currentRay = rayQueue.shift();
        if (currentRay.depth > maxBounces) continue;

        raycaster.set(currentRay.origin, currentRay.dir);
        const intersects = raycaster.intersectObjects(interactables, true);

        // 유효한 충돌 찾기
        let hit = null;
        for (let i = 0; i < intersects.length; i++) {
            const check = intersects[i];
            // 자기 자신(출발지)과의 충돌 방지
            if (currentRay.ignoreObject && check.object === currentRay.ignoreObject) continue;
            // 레이저 통과 태그(ignoreLaser)가 있는 물체 무시
            if (check.object.userData.ignoreLaser) continue;
            
            hit = check;
            break; 
        }

        let endPoint;
        
        if (hit) {
            endPoint = hit.point;
            const object = hit.object;
            const parent = object.parent || object;

            // A. 센서 충돌
            if (parent.userData.type === 'sensor') {
                hitSensor = true;
                // [핵심] 센서에 닿은 색상 기록
                hitColors.add(currentRay.color.getHex());
                
                const lens = parent.getObjectByName("sensorLens");
                if (lens) {
                    lens.material.emissive.setHex(currentRay.color.getHex());
                    lens.material.emissiveIntensity = 2.0;
                }
                parent.userData.isHit = true;
            }
            // B. 분산 큐브 (Dispersion) - 빛 분기
            else if (object.userData.isDispersion) {
                // 흰색 빛만 분산시킴 (이미 색이 변한 빛은 통과하거나 흡수됨)
                if (currentRay.color.getHex() === 0xffffff) {
                    // 1. 빨강 (우측 45도)
                    const dir1 = currentRay.dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 4);
                    rayQueue.push({
                        origin: endPoint.clone(),
                        dir: dir1,
                        color: new THREE.Color(1, 0, 0),
                        depth: currentRay.depth + 1,
                        ignoreObject: object
                    });

                    // 2. 파랑 (좌측 45도)
                    const dir2 = currentRay.dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
                    rayQueue.push({
                        origin: endPoint.clone(),
                        dir: dir2,
                        color: new THREE.Color(0, 0, 1),
                        depth: currentRay.depth + 1,
                        ignoreObject: object
                    });
                }
            }
            // C. 거울/프리즘 반사
            else if (parent.userData.isPrism || object.userData.isPrism) {
                const normal = hit.face.normal.clone().transformDirection(object.matrixWorld).normalize();
                
                // 양면 거울 처리
                if (currentRay.dir.dot(normal) > 0) normal.negate();

                const reflectDir = currentRay.dir.clone().reflect(normal).normalize();
                const nextOrigin = endPoint.clone().add(normal.multiplyScalar(0.01));

                rayQueue.push({
                    origin: nextOrigin,
                    dir: reflectDir,
                    color: currentRay.color,
                    depth: currentRay.depth + 1,
                    ignoreObject: object
                });
            }
            // D. 일반 장애물 (멈춤)
        } else {
            // 허공으로 날아감
            endPoint = currentRay.origin.clone().add(currentRay.dir.clone().multiplyScalar(50));
        }

        // 그리기 리스트에 추가
        segmentsToDraw.push({
            start: currentRay.origin,
            end: endPoint,
            color: currentRay.color
        });
    }

    // --- 레이저 그리기 ---
    meshPool.forEach(mesh => mesh.visible = false);
    laserGroupObject.visible = true;

    for (let i = 0; i < segmentsToDraw.length; i++) {
        const segData = segmentsToDraw[i];
        let segment = meshPool[i];

        if (!segment) {
            const geometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
            geometry.rotateX(-Math.PI / 2);
            const material = new THREE.MeshBasicMaterial({ toneMapped: false });
            segment = new THREE.Mesh(geometry, material);
            segment.geometry.translate(0, 0, 0.5);
            meshPool.push(segment);
            laserGroupObject.add(segment);
        }

        segment.visible = true;
        segment.position.copy(segData.start);
        segment.lookAt(segData.end);
        segment.scale.z = segData.start.distanceTo(segData.end);
        segment.material.color.copy(segData.color);
    }

    // --- 승리 조건 판단 ---
    // 1. 흰색 빛이 닿았거나
    const hasWhite = hitColors.has(0xffffff);
    // 2. 빨강 AND 파랑 빛이 동시에 닿았을 때
    const hasRed = hitColors.has(0xff0000);
    const hasBlue = hitColors.has(0x0000ff);

    const isMissionComplete = hasWhite || (hasRed && hasBlue);

    if (isMissionComplete) {
        sensor.userData.isHit = true;
        return true;
    }
    
    return false;
}