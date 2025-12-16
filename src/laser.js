import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const maxReflections = 10;

// 1. 레이저 라인
export function createLaserLine() {
    const material = new THREE.LineBasicMaterial({ 
        color: 0xffffff, 
        linewidth: 4,
        fog: true
    });
    const geometry = new THREE.BufferGeometry();
    return new THREE.Line(geometry, material);
}

// 2. 레이저 업데이트
export function updateLaserSystem(sceneParams, laserLine) {
    const { source, sensor, mirrors, door } = sceneParams;

    let rayOrigin = source.position.clone();
    let rayDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(source.quaternion).normalize();

    const points = [];
    points.push(rayOrigin.clone());

    let hitSensor = false;
    const interactables = [sensor, ...mirrors];

    for (let i = 0; i < maxReflections; i++) {
        raycaster.set(rayOrigin, rayDirection);
        // 내부 자식 메쉬까지 체크
        const intersects = raycaster.intersectObjects(interactables, true);
        
        // 테두리 등 무시 태그가 없는 유효 충돌체 찾기
        const hit = intersects.find(intersect => !intersect.object.userData.ignoreLaser);

        if (hit) {
            points.push(hit.point); // 충돌 지점까지 그리기

            // Case A: 센서 도달
            if (hit.object === sensor) {
                hitSensor = true;
                break;
            }

            // Case B: 반사 큐브 도달
            if (hit.object.userData.isPrism) {
                // materialIndex 1 = 반사면(유리)
                if (hit.face.materialIndex === 1) {
                    const incomingVec = rayDirection.clone();
                    const normalVec = hit.face.normal.clone();
                    normalVec.transformDirection(hit.object.matrixWorld).normalize();

                    const reflectedVec = incomingVec.reflect(normalVec).normalize();

                    // 반사된 빛이 큐브 내부로 인식되지 않도록 법선 방향으로 띄움
                    rayOrigin = hit.point.clone().add(normalVec.multiplyScalar(0.05));
                    rayDirection = reflectedVec;
                    
                    // continue를 통해 루프 계속 (반사)
                } else {
                    // materialIndex 0 = 구조면 -> 레이저 막힘
                    break; 
                }
            } 
            // Case C: 기타 장애물 -> 레이저 막힘
            else {
                break; 
            }

        } else {
            // 허공으로 발사
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
                infoText.innerText = "↔️ MOVE MODE: 화살표를 눌러 회전";
                infoText.style.color = "white";
            }
        }
    }
}