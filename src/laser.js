// [laser.js]

import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const maxBounces = 10; 

let laserGroup;
const meshPool = []; 

export function createLaserLine() {
    laserGroup = new THREE.Group();
    return laserGroup;
}

export function updateLaserSystem(sceneParams, laserGroupObject, isActive) {
    const { source, sensor, mirrors } = sceneParams;

    if (!isActive) {
        meshPool.forEach(mesh => { mesh.visible = false; });
        sensor.material.emissiveIntensity = 0.0;
        sensor.material.color.setHex(0x00ff00);
        return false;
    }

    const startOrigin = source.position.clone();
    const startDir = new THREE.Vector3(0, 0, -1).applyQuaternion(source.quaternion).normalize();
    
    // 레이저 추적 큐
    const rayQueue = [{ 
        origin: startOrigin, 
        dir: startDir, 
        color: new THREE.Color(1, 1, 1),
        depth: 0,
        ignoreObject: null 
    }];

    const segmentsToDraw = [];
    
    // [핵심 수정 1] 센서에 닿은 색상들을 저장할 Set (중복 제거)
    const hitColors = new Set();
    let hitSensor = false;

    const allInteractables = [sensor, ...mirrors];

    while (rayQueue.length > 0) {
        const currentRay = rayQueue.shift();
        if (currentRay.depth >= maxBounces) continue;

        const interactables = currentRay.ignoreObject 
            ? allInteractables.filter(obj => obj !== currentRay.ignoreObject) 
            : allInteractables;

        raycaster.set(currentRay.origin, currentRay.dir);
        const intersects = raycaster.intersectObjects(interactables, true);
        const hit = intersects.find(intersect => !intersect.object.userData.ignoreLaser);

        let endPoint;
        
        if (hit) {
            endPoint = hit.point;
            
            // 1. 센서 충돌
            if (hit.object === sensor) {
                hitSensor = true;
                // [핵심 수정] 닿은 빛의 색상 Hex 값을 저장
                hitColors.add(currentRay.color.getHex());
            }
            // 2. 분산 큐브 (Dispersion)
            else if (hit.object.userData.isDispersion) {
                let rootGroup = hit.object;
                while(rootGroup.parent && rootGroup.parent.type !== 'Scene') {
                    if (mirrors.includes(rootGroup)) break;
                    rootGroup = rootGroup.parent;
                }

                const passThroughDist = 1.0; 
                const exitPoint = hit.point.clone().add(currentRay.dir.clone().multiplyScalar(passThroughDist));

                // A. 입사광 (흰색)
                segmentsToDraw.push({
                    start: currentRay.origin,
                    end: hit.point,
                    color: currentRay.color 
                });
                // B. 내부 관통광 (흰색)
                segmentsToDraw.push({
                    start: hit.point,
                    end: exitPoint,
                    color: currentRay.color 
                });

                // C. 분산광 생성
                const axis = new THREE.Vector3(0, 1, 0); 
                
                // Red Beam
                const dirRed = currentRay.dir.clone().applyAxisAngle(axis, Math.PI / 4).normalize();
                rayQueue.push({
                    origin: exitPoint.clone(), 
                    dir: dirRed,
                    color: new THREE.Color(1, 0, 0),
                    depth: currentRay.depth + 1,
                    ignoreObject: rootGroup 
                });

                // Blue Beam
                const dirBlue = currentRay.dir.clone().applyAxisAngle(axis, -Math.PI / 4).normalize();
                rayQueue.push({
                    origin: exitPoint.clone(),
                    dir: dirBlue,
                    color: new THREE.Color(0, 0, 1),
                    depth: currentRay.depth + 1,
                    ignoreObject: rootGroup 
                });

                continue; 
            }
            // 3. 반사 큐브
            else if (hit.object.userData.isPrism || hit.object.userData.type === 'mirror') {
                const incoming = currentRay.dir.clone();
                const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
                const reflected = incoming.reflect(normal).normalize();

                rayQueue.push({
                    origin: hit.point.clone().add(normal.multiplyScalar(0.01)),
                    dir: reflected,
                    color: currentRay.color, 
                    depth: currentRay.depth + 1,
                    ignoreObject: null 
                });
            }
        } else {
            endPoint = currentRay.origin.clone().add(currentRay.dir.multiplyScalar(50));
        }

        segmentsToDraw.push({
            start: currentRay.origin,
            end: endPoint,
            color: currentRay.color
        });
    }

    // --- 시각화 ---
    meshPool.forEach(mesh => { mesh.visible = false; });

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

        const intenseColor = segData.color.clone().multiplyScalar(10.0);
        segment.material.color.copy(intenseColor);
    }

    // --- [핵심 수정 2] 성공 판정 로직 ---
    // 1. 흰색 빛(기본)이 들어왔는가? (분산 큐브 없는 스테이지용)
    const hasWhite = hitColors.has(0xffffff);
    // 2. 빨강 AND 파랑 빛이 모두 들어왔는가? (분산 큐브 스테이지용)
    const hasRed = hitColors.has(0xff0000);
    const hasBlue = hitColors.has(0x0000ff);
    
    // 최종 성공 조건: 흰색이거나 OR (빨강과 파랑이 모두 있을 때)
    const isMissionComplete = hasWhite || (hasRed && hasBlue);

    if (isMissionComplete) {
        // 성공: 밝은 연두색 (센서 활성화)
        sensor.material.color.setHex(0x55ff55);
        sensor.material.emissive.setHex(0x55ff55);
        sensor.material.emissiveIntensity = 2.0;
        return true;
    } else if (hitSensor) {
        // 부분 성공 (하나만 닿음): 닿은 빛의 색깔을 보여줌 (힌트)
        // 예: 빨강만 닿으면 센서가 빨개짐
        const lastColor = Array.from(hitColors).pop();
        sensor.material.color.setHex(lastColor);
        sensor.material.emissive.setHex(lastColor);
        sensor.material.emissiveIntensity = 1.0;
        return false; // 아직 클리어 아님
    } else {
        // 실패: 기본 초록 (꺼짐)
        sensor.material.color.setHex(0x00ff00);
        sensor.material.emissive.setHex(0x000000);
        sensor.material.emissiveIntensity = 0.0;
        return false;
    }
}