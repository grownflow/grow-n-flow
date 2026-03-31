const BED_LAYOUTS = [
  {
    name: 'bed1',
    originX: 0.73,
    originZ: -5.7,
    y: 0.2621,
    cols: 4,
    rows: 9,
    xStep: 0.19,
    zStep: 0.215,
  },
  {
    name: 'bed2',
    originX: 2.55,
    originZ: -5.8,
    y: 0.2621,
    cols: 4,
    rows: 15,
    xStep: 0.19,
    zStep: 0.215,
  },
  {
    name: 'bed3',
    originX: 4.4,
    originZ: -5.7,
    y: 0.2621,
    cols: 4,
    rows: 11,
    xStep: 0.19,
    zStep: 0.215,
  },
];

let plantSlots = [];

for (const bed of BED_LAYOUTS) {
  for (let row = 0; row < bed.rows; row++) {
    const z = Number((bed.originZ + (row * bed.zStep)).toFixed(4));

    for (let col = 0; col < bed.cols; col++) {
      const x = Number((bed.originX + (col * bed.xStep)).toFixed(4));
      plantSlots.push({ x, y: bed.y, z });
    }
  }
}

export const PLANT_SLOTS = plantSlots;

export const PLANT_SLOT_COUNT = PLANT_SLOTS.length;