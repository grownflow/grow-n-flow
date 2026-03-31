import React from 'react';
import X3DViewer from './X3DViewer';
import { PLANT_SLOTS } from '../config/plantSlots';

const FISH_ASSET_BY_TYPE = {
  tilapia: '3d/Redheadx.x3d',
  barramundi: '3d/Barramundi.x3d',
  catfish: '3d/Gigi.x3d',
};

const DEFAULT_FISH_ASSET = '3d/Redheadx.x3d';
const DEFAULT_FISH_SCALE = 0.3;
const SLOT_PLANT_ASSET = 'plants/lettuce1.glb';
const SLOT_PLANT_SCALE = 1;

export default function Renderer({ gameState }) {
  const plants = gameState?.G?.plants || [];
  const fish = gameState?.G?.fish || [];

  return (
    <X3DViewer assetPath="MainSceneb.x3d">
      
      <transform>
        {plants.map((plant, mapIndex) => {
          const slotCount = PLANT_SLOTS.length;
          const safeIndex = (plant.slotIndex !== undefined)
            ? (plant.slotIndex % slotCount)
            : (mapIndex % slotCount);
          const slot = PLANT_SLOTS[safeIndex];
          const plantScale = `${SLOT_PLANT_SCALE} ${SLOT_PLANT_SCALE} ${SLOT_PLANT_SCALE}`;

          return (
            <transform key={plant.id} translation={`${slot.x} ${slot.y} ${slot.z}`}>
              <transform scale={plantScale}>
                  <inline url={`"${SLOT_PLANT_ASSET}"`} />
              </transform>
            </transform>
          );
        })}
      </transform>

      {fish.map((f, i) => {
        const id = f.id;

        const baseX = f.renderPosition?.x ?? 2.8;
        const baseY = f.renderPosition?.y ?? 0.65;
        const baseZ = f.renderPosition?.z ?? -1.05;

        const scaleValue = f.renderScale || DEFAULT_FISH_SCALE;
        const fishScale = `${scaleValue} ${scaleValue} ${scaleValue}`;
        const assetPath = f.renderAsset || FISH_ASSET_BY_TYPE[f.type] || DEFAULT_FISH_ASSET;

        return (
          <transform key={`fishGroup_${id}`}>
            <transform
              def={`FishTransform_${id}`}
              translation={`${baseX} ${baseY} ${baseZ}`}
              scale={fishScale}
              rotation="0 1 0 0"
            >
              <inline url={`"${assetPath}"`} />
            </transform>
          </transform>
        );
      })}

    </X3DViewer>
  );
}
