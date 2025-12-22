import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const maxBounces = 20; 

let laserGroup;
const meshPool = [];

export function createLaserLine() {
    laserGroup = new THREE.Group();
    return laserGroup;
}

export function updateLaserSystem(sceneParams, laserGroupObject, isActive) {
    const { source, sensor, mirrors } = sceneParams;

    if (!isActive || !source) {
        meshPool.forEach(mesh => { mesh.visible = false; });
        if(sensor) {
            sensor.userData.isHit = false;
            const lens = sensor.getObjectByName("sensorLens");
            if(lens) {
                lens.material.emissive.setHex(0x000000);
                lens.material.emissiveIntensity = 0.0;
            }
        }
        return false;
    }

    let startOrigin = source.position.clone();
    let startDir = new THREE.Vector3(0, 0, -1);
    if (source.userData.dir) startDir = source.userData.dir.clone().normalize();

    const rayQueue = [{ 
        origin: startOrigin, 
        dir: startDir, 
        color: new THREE.Color(1, 1, 1),
        depth: 0,
        ignoreObject: null 
    }];

    const segmentsToDraw = [];
    const hitColors = new Set();
    let hitSensor = false;

    const allInteractables = [];
    if (sensor) allInteractables.push(sensor);
    if (mirrors) allInteractables.push(...mirrors);

    while (rayQueue.length > 0) {
        const currentRay = rayQueue.shift();
        if (currentRay.depth > maxBounces) continue;

        raycaster.set(currentRay.origin, currentRay.dir);
        
        const intersects = raycaster.intersectObjects(allInteractables, true);
        
        // ignoreLaser 태그가 없는 가장 가까운 물체 찾기
        const hit = intersects.find(intersect => 
            !intersect.object.userData.ignoreLaser && 
            intersect.object !== currentRay.ignoreObject
        );

        if (hit) {
            const endPoint = hit.point;
            const obj = hit.object;
            const parent = obj.parent || obj;

            // 1. 센서 충돌
            if (parent.userData.type === 'sensor') {
                hitSensor = true;
                hitColors.add(currentRay.color.getHex());
                
                const lens = parent.getObjectByName("sensorLens");
                if (lens) {
                    lens.material.emissive.setHex(currentRay.color.getHex());
                    lens.material.emissiveIntensity = 1.0; 
                }
                parent.userData.isHit = true;
                
                segmentsToDraw.push({
                    start: currentRay.origin,
                    end: endPoint,
                    color: currentRay.color
                });
            }
            // 2. 분산 큐브 (Dispersion) - [핵심 로직]
            else if (obj.userData.isDispersion) {
                let rootGroup = obj;
                while(rootGroup.parent && rootGroup.parent.type !== 'Scene') {
                    if (mirrors.includes(rootGroup)) break;
                    rootGroup = rootGroup.parent;
                }

                // 큐브의 정중앙 좌표 (월드 좌표)
                const cubeCenter = new THREE.Vector3();
                obj.getWorldPosition(cubeCenter);

                // A. 표면까지의 광선 (Start -> Surface)
                segmentsToDraw.push({
                    start: currentRay.origin,
                    end: hit.point,
                    color: currentRay.color 
                });
                
                // B. [투과 효과] 표면에서 정중앙까지 흰색 광선 연장 (Surface -> Center)
                segmentsToDraw.push({
                    start: hit.point,
                    end: cubeCenter,
                    color: currentRay.color 
                });

                // C. 분산 (중앙에서 시작)
                if (currentRay.color.getHex() === 0xffffff) {
                    const axis = new THREE.Vector3(0, 1, 0); 
                    
                    // 빨강 (45도)
                    const dirRed = currentRay.dir.clone().applyAxisAngle(axis, Math.PI / 4).normalize();
                    rayQueue.push({
                        origin: cubeCenter.clone(), // 중앙에서 출발
                        dir: dirRed,
                        color: new THREE.Color(1, 0, 0),
                        depth: currentRay.depth + 1,
                        ignoreObject: rootGroup // 자기 자신 무시
                    });

                    // 파랑 (-45도)
                    const dirBlue = currentRay.dir.clone().applyAxisAngle(axis, -Math.PI / 4).normalize();
                    rayQueue.push({
                        origin: cubeCenter.clone(), // 중앙에서 출발
                        dir: dirBlue,
                        color: new THREE.Color(0, 0, 1),
                        depth: currentRay.depth + 1,
                        ignoreObject: rootGroup
                    });
                }
            }
            // 3. 반사체
            else if (parent.userData.isPrism || obj.userData.isPrism) {
                const normal = hit.face.normal.clone().transformDirection(obj.matrixWorld).normalize();
                if (currentRay.dir.dot(normal) > 0) normal.negate();

                const reflectDir = currentRay.dir.clone().reflect(normal).normalize();
                const nextOrigin = endPoint.clone().add(normal.multiplyScalar(0.01));

                segmentsToDraw.push({
                    start: currentRay.origin,
                    end: endPoint,
                    color: currentRay.color
                });

                rayQueue.push({
                    origin: nextOrigin,
                    dir: reflectDir,
                    color: currentRay.color,
                    depth: currentRay.depth + 1,
                    ignoreObject: obj 
                });
            }
            // 4. 일반 장애물
            else {
                segmentsToDraw.push({
                    start: currentRay.origin,
                    end: endPoint,
                    color: currentRay.color
                });
            }
        } else {
            // 허공
            const endPoint = currentRay.origin.clone().add(currentRay.dir.clone().multiplyScalar(50));
            segmentsToDraw.push({
                start: currentRay.origin,
                end: endPoint,
                color: currentRay.color
            });
        }
    }

    // --- 시각화 ---
    meshPool.forEach(mesh => { mesh.visible = false; });
    laserGroupObject.visible = true;

    for (let i = 0; i < segmentsToDraw.length; i++) {
        const segData = segmentsToDraw[i];
        let segment = meshPool[i];

        if (!segment) {
            const geometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8); 
            geometry.rotateX(-Math.PI / 2); 
            const material = new THREE.MeshBasicMaterial({ 
                toneMapped: false 
            });
            segment = new THREE.Mesh(geometry, material);
            segment.geometry.translate(0, 0, 0.5); 
            meshPool.push(segment);
            laserGroupObject.add(segment);
        }

        segment.visible = true;
        segment.position.copy(segData.start);
        segment.lookAt(segData.end);
        segment.scale.z = segData.start.distanceTo(segData.end);
        
        // 발광 효과 (색상 증폭)
        const intenseColor = segData.color.clone().multiplyScalar(10.0); 
        segment.material.color.copy(intenseColor);
    }

    const hasWhite = hitColors.has(0xffffff);
    const hasRed = hitColors.has(0xff0000);
    const hasBlue = hitColors.has(0x0000ff);
    
    const isMissionComplete = hasWhite || (hasRed && hasBlue);

    if (isMissionComplete) {
        if(sensor) {
            sensor.userData.isHit = true;
            return true;
        }
    }
    return false;
}