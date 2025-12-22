// src/stages.js

const FLOOR_Y = -7.5; // 바닥 높이 (15칸 맵 기준 -7.5)

export const STAGES = [
    { 
        id: 1, 
        msg: "Stage 1: 빛의 직진 (Tutorial)",
        desc: "아무것도 설치하지 않고 시작 버튼을 눌러보세요.",
        mapSize: 15,
        // 중앙 하단에서 출발
        sourcePos: [0, FLOOR_Y + 0.5, 7], 
        sourceDir: [0, 0, -1], // 북쪽(-z) 발사
        sensorData: [
            { pos: [0, FLOOR_Y + 0.5, -7], dir: [0, 0, 1] } // 남쪽(+z) 바라봄
        ],
        // 배치할 큐브 없음
        maxMirrors: { triangle: 0, trapezoid: 0, half: 0, dispersion: 0 },
        fixedElements: []
    },
    { 
        id: 2, 
        msg: "Stage 2: 90도 반사 (Tutorial)",
        desc: "삼각 거울을 설치하여 빛을 90도로 꺾으세요.",
        // 우측 하단 출발 -> 좌측 하단 거울 -> 좌측 상단 센서
        sourcePos: [7, FLOOR_Y + 0.5, 7], 
        sourceDir: [-1, 0, 0], // 서쪽(-x) 발사
        sensorData: [
            { pos: [-7, FLOOR_Y + 0.5, -7], dir: [0, 0, 1] } 
        ],
        // 삼각 거울 1개 제공
        maxMirrors: { triangle: 1, trapezoid: 0, half: 0, dispersion: 0 },
        fixedElements: []
    },
    
    { 
        id: 3, 
        msg: "Stage 3: 빛의 분산 (Prism)",
        desc: "분산 큐브로 빛을 나누고, 거울로 센서를 조준하세요.",
        // 중앙 하단에서 출발
        sourcePos: [0, FLOOR_Y + 0.5, 7], 
        sourceDir: [0, 0, -1], 
        sensorData: [
            { pos: [0, FLOOR_Y + 0.5, -7], dir: [0, 0, 1] } 
        ],
        // 분산 큐브 1개 + 삼각 거울 2개
        maxMirrors: { triangle: 0, trapezoid: 0, half: 2, dispersion: 1 },
        fixedElements: [
            // 중앙을 가로막는 장애물 (빛을 나누어서 피해가야 함)
            { type: 'obstacle', pos: [0, -5, 0], size: [2, 5, 8], color: 0x333333 }
        ]
    },
    
   { 
        id: 4, // (기존 Stage 1)
        msg: "Stage 4: 거울의 활용",
        desc: "반사 큐브를 조금 더 적극적으로 활용해 볼까요?",
        sourcePos: [-7, -3, 0], 
        sourceDir: [0, 0, -1],
        sensorData: [
            { pos: [7, -7, 0], dir: [0, 0, -1] }, // [주의] 기존 코드의 센서 방향 유지
        ],
        maxMirrors: { triangle: 3, trapezoid: 0, half: 0, dispersion: 0 },
    },
    { 
        id: 5, // (기존 Stage 2)
        msg: "Stage 5: 장애물과 이중 반사",
        desc: "사다리꼴 반사 큐브를 이용해보세요.",
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
    },
    { 
        id: 6, 
        msg: "Stage 6: 벽 안의 길",
        desc: "거대한 벽을 피해 이중 반사 거울을 활용하세요.",
        // 좌측 하단 출발 -> 우측으로 이동 -> 벽 피해 반사 -> 좌측 상단 도착
        sourcePos: [-7, FLOOR_Y + 0.5, 7], 
        sourceDir: [1, 0, 0], // 동쪽(+x) 발사
        sensorData: [
            { pos: [-7, FLOOR_Y + 0.5, -7], dir: [1, 0, 0] }
        ],
        // 사다리꼴 거울 4개 제공
        maxMirrors: { triangle: 0, trapezoid: 4, half: 0, dispersion: 0 },
        fixedElements: [
            // 레이저를 막는 고정 장애물 (검은색 큐브)
            { type: 'obstacle', pos: [2, -5, -4], size: [1, 5 ,7], color: 0x222222 },
            { type: 'obstacle', pos: [-3, -5, -1], size: [9, 5 ,1], color: 0x222222 },
            { type: 'trianglemirror', pos: [7,-7, -7], rotation: [0, -Math.PI/2, 0], // Y축 기준 45도 회전
                draggable: false },  { type: 'fixedmirror', pos: [7,-7, 7], rotation: [0, -Math.PI/2, 0], // Y축 기준 45도 회전
                draggable: false },          
                { type: 'trianglemirror', pos: [7,-7, -6], rotation: [0, -Math.PI/2, 0], // Y축 기준 45도 회전
                draggable: false },            { type: 'trianglemirror', pos: [7,-7, -5], rotation: [0, -Math.PI/2, 0], // Y축 기준 45도 회전
                draggable: false },            { type: 'trianglemirror', pos: [7,-7, -4], rotation: [0, -Math.PI/2, 0], // Y축 기준 45도 회전
                draggable: false },            { type: 'trianglemirror', pos: [7,-7, -3], rotation: [0, -Math.PI/2, 0], // Y축 기준 45도 회전
                draggable: false },            { type: 'trianglemirror', pos: [7,-7, -2], rotation: [0, -Math.PI/2, 0], // Y축 기준 45도 회전
                draggable: false },            { type: 'trianglemirror', pos: [7,-7, -1], rotation: [0, -Math.PI/2, 0], // Y축 기준 45도 회전
                draggable: false },            { type: 'trianglemirror', pos: [7,-7, 0], rotation: [0, -Math.PI/2, 0], // Y축 기준 45도 회전
                draggable: false },             { type: 'trianglemirror', pos: [7,-7, 6], rotation: [0, -Math.PI/2, 0], // Y축 기준 45도 회전
                draggable: false },            { type: 'trianglemirror', pos: [7,-7, 5], rotation: [0, -Math.PI/2, 0], // Y축 기준 45도 회전
                draggable: false },            { type: 'trianglemirror', pos: [7,-7, 4], rotation: [0, -Math.PI/2, 0], // Y축 기준 45도 회전
                draggable: false },            { type: 'trianglemirror', pos: [7,-7, 3], rotation: [0, -Math.PI/2, 0], // Y축 기준 45도 회전
                draggable: false },            { type: 'trianglemirror', pos: [7,-7, 2], rotation: [0, -Math.PI/2, 0], // Y축 기준 45도 회전
                draggable: false },            { type: 'trianglemirror', pos: [7,-7, 1], rotation: [0, -Math.PI/2, 0], // Y축 기준 45도 회전
                draggable: false },
 
        ]
    }
];