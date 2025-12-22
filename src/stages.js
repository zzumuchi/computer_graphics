// src/stages.js

const FLOOR_Y = -7.5; // 바닥 높이 (15칸 맵 기준 -7.5)

export const STAGES = [
    { 
        id: 1, 
        msg: "Stage 1: 빛의 직진 (Tutorial)",
        // [목표] 아무것도 설치하지 않고 시작 버튼 클릭
        // 중앙 하단(7)에서 출발 -> 중앙 상단(-7) 도착
        sourcePos: [0, FLOOR_Y + 0.5, 7], 
        sourceDir: [0, 0, -1], // 북쪽(위, -z)으로 발사
        sensorData: [
            { pos: [0, FLOOR_Y + 0.5, -7], dir: [0, 0, 1] } // 남쪽(아래, +z)을 바라봄
        ],
        // 배치할 큐브 없음
        maxMirrors: { triangle: 0, trapezoid: 0, half: 0, dispersion: 0 },
        fixedElements: []
    },
    { 
        id: 2, 
        msg: "Stage 2: 90도 반사 (Tutorial)",
        // [목표] 좌측 하단(-7, 7)에 삼각 거울 1개 배치
        // 경로: 우측 하단(7, 7) 출발 -> 좌측으로 이동 -> 거울 반사 -> 좌측 상단(-7, -7) 도착
        sourcePos: [7, FLOOR_Y + 0.5, 7], 
        sourceDir: [-1, 0, 0], // 서쪽(왼쪽)으로 발사
        sensorData: [
            { pos: [-7, FLOOR_Y + 0.5, -7], dir: [0, 0, 1] } // 남쪽(아래)을 바라봄 (빛이 아래에서 올라오므로)
        ],
        // 삼각 거울 1개만 제공
        maxMirrors: { triangle: 1, trapezoid: 0, half: 0, dispersion: 0 },
        fixedElements: []
    },
    { 
        id: 3, // (기존 Stage 1)
        msg: "Stage 3: 빛의 시작 (높이차)",
        // 높이 차이가 있는 기존 로직 유지 (y: -3)
        sourcePos: [-7, -3, 0], 
        sourceDir: [0, 0, -1],
        sensorData: [
            { pos: [7, -7, 0], dir: [0, 0, -1] }, // [주의] 기존 코드의 센서 방향 유지
        ],
        maxMirrors: { triangle: 3, trapezoid: 0, half: 0, dispersion: 0 },
    },
    { 
        id: 4, // (기존 Stage 2)
        msg: "Stage 4: 장애물과 이중 반사",
        sourcePos: [-7, -7, 7], 
        sourceDir: [1, 0, 0],
        sensorData: [
            { pos: [-7, -7, -7], dir: [1, 0, 0] },
        ],
        maxMirrors: { triangle: 0, trapezoid: 4, half: 0, dispersion: 0 },
        fixedElements: [
            // 레이저를 막는 거대한 고정 장애물
            { type: 'obstacle', pos: [-3, 0, 0], size: [9, 15 ,1], color: 0x222222 },
            // 미리 배치된 이중 거울 (움직일 수 없음)
            { type: 'doubleMirror', pos: [4, -7, 0], 
                rotation: [0, 0, 0], 
                draggable: false }
        ]
    }
];