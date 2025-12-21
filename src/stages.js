// src/stages.js

const FLOOR_Y = -7.5; // 바닥 높이

export const STAGES = [
    { 
        id: 1, 
        msg: "Stage 1: 빛의 시작",
        sourcePos: [-7, FLOOR_Y + 0.5, 7], 
        sensorPos: [7, FLOOR_Y + 0.5, -7], 
        maxMirrors: 10,
        fixedElements: []
    },
    { 
        id: 2, 
        msg: "Stage 2: 빛의 분산 (Prism)",
        sourcePos: [0, FLOOR_Y + 0.5, 7], 
        sensorPos: [0, FLOOR_Y + 0.5, -7], 
        maxMirrors: 3, 
        fixedElements: [
            // [추가됨] 중앙을 가로막는 장애물
            // 이제 흰색 빛이 직진해서 센서에 닿을 수 없으므로,
            // 반드시 분산 큐브로 빛을 갈라 장애물 옆으로 지나가게 해야 합니다.
            { type: 'obstacle', pos: [0, FLOOR_Y + 0.5, 0], color: 0x555555 }
        ]
    },
    { 
        id: 3, 
        msg: "Stage 3: 4면의 감옥",
        sourcePos: [-7, FLOOR_Y + 0.5, -7], 
        sensorPos: [7, FLOOR_Y + 0.5, 7], 
        maxMirrors: 5,
        fixedElements: [
            { type: 'obstacle', pos: [0, FLOOR_Y + 0.5, 0], color: 0x222222 },
        ]
    }
];