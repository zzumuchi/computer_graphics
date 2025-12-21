// src/stages.js

const FLOOR_Y = -7.5; // 바닥 높이

export const STAGES = [
    { 
        id: 1, 
        msg: "Stage 1: 빛의 시작",
        // 바닥 높이 + 0.5 (큐브 중심)
        sourcePos: [-7, FLOOR_Y + 0.5, 7], 
        sensorPos: [7, FLOOR_Y + 0.5, -7], 
        maxMirrors: 10,
        fixedElements: []
    },
    { 
        id: 2, 
        msg: "Stage 2: 빛의 분산 (Prism)",
        // [설계] 
        // 1. Source(0, 7)에서 위로 발사 
        // 2. (0, 5)에 분산 큐브 배치 -> 좌우 45도로 갈라짐 (목표: -6, -1 지점)
        // 3. (-6, -1)과 (6, -1)에 거울 배치 -> 다시 중앙(-7)으로 반사
        // 4. Sensor(0, -7)에 도달
        sourcePos: [0, FLOOR_Y + 0.5, 7], 
        sensorPos: [0, FLOOR_Y + 0.5, -7], 
        maxMirrors: 3, // 분산 큐브 1개 + 거울 2개 필요
        fixedElements: [] 
    },
    { 
        id: 3, 
        msg: "Stage 3: 4면의 감옥",
        sourcePos: [-7, FLOOR_Y + 0.5, -7], 
        sensorPos: [7, FLOOR_Y + 0.5, 7], 
        maxMirrors: 5,
        fixedElements: [
            // 레이저를 막는 중앙 장애물
            { type: 'obstacle', pos: [0, FLOOR_Y + 0.5, 0], color: 0x555555 },
        ]
    }
];