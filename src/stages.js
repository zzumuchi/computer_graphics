// src/stages.js

const FLOOR_Y = -7.5; // 바닥 높이 (고정)

export const STAGES = [
    { 
        id: 1, 
        msg: "Stage 1: 빛의 시작",
        // [수정] 좌표를 정수로 변경 (6.5 -> 7, -6.5 -> -7)
        // 벽에 딱 붙으려면 15칸 맵(반지름 7.5)에서 중심은 7.0이어야 함
        sourcePos: [-7, FLOOR_Y + 0.5, 7], 
        sensorPos: [7, FLOOR_Y + 0.5, -7], 
        maxMirrors: 1 
    },
    { 
        id: 2, 
        msg: "Stage 2: 높이의 차이",
        // [수정] 정수 좌표 적용
        sourcePos: [-7, FLOOR_Y + 4.5, 0], 
        sensorPos: [7, FLOOR_Y + 0.5, 0], 
        maxMirrors: 3
    },
    { 
        id: 3, 
        msg: "Stage 3: 4면의 감옥",
        // [수정] 정수 좌표 적용
        sourcePos: [-7, FLOOR_Y + 0.5, -7], 
        sensorPos: [7, FLOOR_Y + 6.5, 7], 
        maxMirrors: 4 
    }
];