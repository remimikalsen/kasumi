// src/lib/levels.js

export const levels = [
    {
        groundHeight: 27,
        dog: { x: 100, y: 50, width: 50, height: 50, collisionTolerance: 10 },
        platforms: [
            { x: 200, y: 70, width: 150, height: 40, platformAdjustment: 10 },
            { x: 600, y: 100, width: 150, height: 40, platformAdjustment: 10 },
            { x: 1000, y: 150, width: 150, height: 40, platformAdjustment: 10 },
            // Add more platforms as needed
        ],
        holes: [
            { x: 450, width: 50 },
            { x: 850, width: 50 },
            // Add more holes as needed
        ],
        spikes: [
            { x: 210, y: 70, width: 69, height: 60 },
            { x: 600, y: 100, width: 69, height: 60  },
            // Add more spikes as needed
        ],
        bones: [
            { x: 300, y: 70, width: 40, height: 20 },
            { x: 700, y: 100, width: 40, height: 20 },
            { x: 1100, y: 150, width: 40, height: 20 },
            // Add more bones as needed
        ],
        goal: { x: 1200, y: 50, width: 90, height: 90 }
    },
    {
        groundHeight: 27,
        dog: { x: 200, y: 50, width: 50, height: 50, collisionTolerance: 10 },
        platforms: [
            { x: 200, y: 100, width: 150, height: 40, platformAdjustment: 10 },
            { x: 800, y: 150, width: 150, height: 40, platformAdjustment: 10 },
            { x: 1400, y: 150, width: 150, height: 40, platformAdjustment: 10 },
            // Add more platforms as needed
        ],
        holes: [],
        spikes: [
            { x: 400, y: 0, width: 69, height: 60 },
            { x: 900, y: 150, width: 69, height: 60 },
            { x: 1100, y: 0, width: 69, height: 60 },
            { x: 1700, y: 0, width: 69, height: 60 },
            // Add more spikes as needed
        ],
        bones: [
            { x: 350, y: 0, width: 40, height: 20 },
            { x: 800, y: 150, width: 40, height: 20 },
            { x: 1000, y: 0, width: 40, height: 20 },
            { x: 1450, y: 150, width: 40, height: 20 },
            // Add more bones as needed
        ],
        goal: { x: 1800, y: 50, width: 50, height: 50 }
    },
    {
        groundHeight: 27,
        dog: { x: 100, y: 50, width: 50, height: 50, collisionTolerance: 10 },
        platforms: [
            { x: 200, y: 100, width: 150, height: 40, platformAdjustment: 10 },
            { x: 250, y: 200, width: 150, height: 40, platformAdjustment: 10 },
            { x: 300, y: 300, width: 150, height: 40, platformAdjustment: 10 },
            { x: 500, y: 100, width: 150, height: 40, platformAdjustment: 10 },
            { x: 600, y: 200, width: 150, height: 40, platformAdjustment: 10 },
            { x: 700, y: 100, width: 150, height: 40, platformAdjustment: 10 },
            { x: 1000, y: 70, width: 150, height: 40, platformAdjustment: 10 },
            { x: 1800, y: 100, width: 150, height: 40, platformAdjustment: 10 },
            // Add more platforms as needed
        ],
        holes: [
            { x: 1400, width: 150 },
            // Add more holes as needed],
        ],
        spikes: [
            { x: 290, y: 100, width: 69, height: 60 },
            { x: 350, y: 200, width: 69, height: 60 },
            { x: 530, y: 100, width: 69, height: 60 },
            { x: 700, y: 200, width: 69, height: 60 },
            { x: 800, y: 100, width: 69, height: 60 },
            { x: 1000, y: 70, width: 69, height: 60 },
            { x: 1640, y: 0, width: 69, height: 60 },
            // Add more spikes as needed
        ],
        bones: [
            { x: 210, y: 100, width: 40, height: 20 },
            { x: 280, y: 200, width: 40, height: 20 },
            { x: 400, y: 300, width: 40, height: 20 },
            { x: 600, y: 200, width: 40, height: 20 },
            { x: 700, y: 100, width: 40, height: 20 },
            { x: 1100, y: 70, width: 40, height: 20 },
            // Add more bones as needed
        ],
        goal: { x: 2000, y: 50, width: 50, height: 50 }
    }
];
