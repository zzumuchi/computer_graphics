import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const maxReflections = 10;

// 1. 레이저 라인 생성
export function createLaserLine() {
    const material = new THREE.LineBasicMaterial({ 
        color: 0xffffff, 
        linewidth: 4,
        fog: true
    });
    const geometry = new THREE.BufferGeometry();
    return new THREE.Line(geometry, material);
}

// 2. 레이저 업데이트 로직 (수정됨: 무시 태그 처리)
export function updateLaserSystem(sceneParams, laserLine) {
    const { source, sensor, mirrors, door } = sceneParams;

    let rayOrigin = source.position.clone();
    // 광원 큐브의 회전값에 따라 발사 방향 결정
    let rayDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(source.quaternion).normalize();

    const points = [];
    points.push(rayOrigin.clone());

    let hitSensor = false;
    const interactables = [sensor, ...mirrors];

    for (let i = 0; i < maxReflections; i++) {
        raycaster.set(rayOrigin, rayDirection);

        // 모든 충돌체를 거리순으로 가져옴
        const intersects = raycaster.intersectObjects(interactables, true);
        
        // [핵심 수정] ignoreLaser 태그가 없는 유효한 충돌체 중 가장 가까운 것 찾기
        // (투명 박스나 테두리 선은 건너뜀)
        const hit = intersects.find(intersect => !intersect.object.userData.ignoreLaser);

        if (hit) {
            points.push(hit.point);

            // Case A: 센서 도달
            if (hit.object === sensor) {
                hitSensor = true;
                break;
            }

            // Case B: 반사면 도달
            if (hit.object.userData.isReflectiveSurface) {
                const incomingVec = rayDirection.clone();
                const normalVec = hit.face.normal.clone();
                normalVec.transformDirection(hit.object.matrixWorld).normalize();

                const reflectedVec = incomingVec.reflect(normalVec).normalize();

                // 표면에서 살짝 띄워서 다음 레이저 시작 (Self-intersection 방지)
                rayOrigin = hit.point.clone().add(reflectedVec.clone().multiplyScalar(0.001));
                rayDirection = reflectedVec;
            } 
            // Case C: 그 외 (막히는 물체)
            else {
                break; 
            }

        } else {
            // 허공으로 날아감 (벽에 닿지 않는 경우 멀리 그림)
            points.push(rayOrigin.clone().add(rayDirection.multiplyScalar(50)));
            break;
        }
    }

    laserLine.geometry.setFromPoints(points);
    handleDoorState(hitSensor, sensor, door);
}

function handleDoorState(isSuccess, sensor, doorGroup) {
    const doorPanel = doorGroup.userData.panel;
    const infoText = document.getElementById('info');

    if (isSuccess) {
        sensor.material.emissive.setHex(0x00ff00);
        if (doorPanel.position.y < 3) {
            doorPanel.position.y += 0.05;
            if(infoText) {
                infoText.innerText = "SUCCESS! 탈출구가 열렸습니다!";
                infoText.style.color = "#00ff00";
            }
        }
    } else {
        sensor.material.emissive.setHex(0x000000);
        if (doorPanel.position.y > 0) {
            doorPanel.position.y -= 0.05;
            if(infoText) {
                infoText.innerText = "↔️ MOVE MODE: R키로 회전 전환";
                infoText.style.color = "white";
            }
        }
    }
}