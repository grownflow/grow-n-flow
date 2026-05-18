import React, { useEffect, useState } from 'react';
import X3DViewer from './X3DViewer';
import { PLANT_SLOTS } from '../config/plantSlots';

const FISH_ASSET_BY_TYPE = {
  tilapia: '3d/Redheadx.x3d',
  barramundi: '3d/Barramundi.x3d',
  catfish: '3d/Gigi.x3d',
};

const DEFAULT_FISH_ASSET = '3d/Redheadx.x3d';
const DEFAULT_FISH_SCALE = 0.3;
const DEFAULT_PLANT_ASSET = 'plants/lettuce1.glb';
const DEFAULT_PLANT_SCALE = 1;

export default function Renderer({ gameState, onPicked }) {
  const plants = gameState?.G?.plants || [];
  const fish = gameState?.G?.fish || [];

  // Stable slot map: slotIndex → { plant, visible }
  // Stable fish list: [{ fish, visible }, ...]
  // We never remove entries from either — dead entries are hidden via render="false".
  // X3DOM's MutationObserver watches the entire <scene>. Changing a geometric
  // attribute (translation, scale, rotation) on a <transform> that contains an
  // <inline> causes X3DOM to re-evaluate the subtree and reload ALL inline assets,
  // making every fish/plant disappear. The fix: keep all geometric attributes
  // constant after mount and use render="false" to hide dead entries — X3DOM skips
  // render="false" nodes during traversal without touching their loaded content.
  const [stablePlantMap, setStablePlantMap] = useState(() => new Map());
  const [stableFishList, setStableFishList] = useState([]);

  useEffect(() => {
    setStablePlantMap(prev => {
      const alivePlantIds = new Set(plants.map(p => p.id));
      let changed = false;
      const next = new Map(prev);

      for (const plant of plants) {
        const entry = next.get(plant.slotIndex);
        if (!entry || !entry.visible || entry.plant.id !== plant.id) {
          next.set(plant.slotIndex, { plant, visible: true });
          changed = true;
        }
      }

      for (const [slotIndex, entry] of next) {
        if (entry.visible && !alivePlantIds.has(entry.plant.id)) {
          next.set(slotIndex, { ...entry, visible: false });
          changed = true;
        }
      }

      // Return same reference when nothing changed to skip re-render
      return changed ? next : prev;
    });
  }, [plants]);

  useEffect(() => {
    setStableFishList(prev => {
      const aliveFishById = new Map(fish.map(f => [f.id, f]));
      let changed = false;

      const updated = prev.map(entry => {
        const alive = aliveFishById.get(entry.fish.id);
        if (alive) {
          if (!entry.visible || entry.fish !== alive) {
            changed = true;
            return { fish: alive, visible: true };
          }
          return entry;
        }
        if (entry.visible) {
          changed = true;
          return { ...entry, visible: false };
        }
        return entry;
      });

      const existingIds = new Set(prev.map(e => e.fish.id));
      const newFish = fish.filter(f => !existingIds.has(f.id));
      if (newFish.length > 0) changed = true;

      return changed
        ? [...updated, ...newFish.map(f => ({ fish: f, visible: true }))]
        : prev;
    });
  }, [fish]);

  return (
    <X3DViewer assetPath="MainSceneb.x3d" onPicked={onPicked}>
      {/* Viewpoints replicated from UI_1e.html */}
      <viewpoint
        id="Viewpoint1"
        position="-3.54576 5.43129 -2.46989"
        orientation="-0.30411 -0.91089 -0.27892 1.69392"
        znear="0.00101"
        zfar="100"
        centerofrotation="0.00000 0.00000 0.00000"
        fieldofview="0.78540"
        description="Initial View"
      />

      <viewpoint
        id="Viewpoint2"
        position="2.85809 4.59615 -1.13894"
        orientation="-1.00000 -0.00001 0.00042 1.56481"
        znear="0.00101"
        zfar="100"
        centerofrotation="2.24996 1.22788 -1.19661"
        fieldofview="0.78540"
        description="Fishtank"
      />

      <viewpoint
        id="Viewpoint3"
        position="-0.26839 2.28270 -2.46535"
        orientation="-0.28254 -0.91667 -0.28265 1.67145"
        znear="0.00095"
        zfar="100"
        centerofrotation="0.99383 1.41547 -2.44610"
        fieldofview="0.78540"
        description="Filter"
      />

      <viewpoint
        id="Viewpoint4"
        position="-0.99019 1.43330 -4.13265"
        orientation="-0.16197 -0.97435 -0.15620 1.59688"
        znear="0.00103"
        zfar="100"
        centerofrotation="1.02080 0.75860 -4.13044"
        fieldofview="0.78540"
        description="Bed 1"
      />

      <viewpoint
        id="Viewpoint5"
        position="1.24166 2.10569 -3.86287"
        orientation="-0.31341 -0.89629 -0.31374 1.72058"
        znear="0.00079"
        zfar="100"
        centerofrotation="2.88469 0.76053 -3.78615"
        fieldofview="0.78540"
        description="Bed 2"
      />

      <viewpoint
        id="Viewpoint6"
        position="3.57351 1.89030 -3.96650"
        orientation="-0.36387 -0.85155 -0.37744 1.70757"
        znear="0.00071"
        zfar="100"
        centerofrotation="4.80439 0.76068 -3.90324"
        fieldofview="0.78540"
        description="Bed 3"
      />
      <transform>
        {Array.from(stablePlantMap.values()).map(({ plant, visible }) => {
          const safeIndex = plant.slotIndex % PLANT_SLOTS.length;
          const slot = PLANT_SLOTS[safeIndex];

          const plantAsset = plant.renderAsset || DEFAULT_PLANT_ASSET;
          const plantScale = plant.renderScale || DEFAULT_PLANT_SCALE;

          return (
            <transform
              key={`slot_${plant.slotIndex}`}
              id={`Plant_${plant.id}`}
              data-pick-label={`Plant_${plant.id}`}
              translation={`${slot.x} ${slot.y} ${slot.z}`}
              scale={`${plantScale} ${plantScale} ${plantScale}`}
              render={visible ? "true" : "false"}
            >
              <inline url={`"${plantAsset}"`} />
            </transform>
          );
        })}
      </transform>

      {stableFishList.map(({ fish: f, visible }) => {
        const id = f.id;

        const baseX = f.renderPosition?.x ?? 2.8;
        const baseY = f.renderPosition?.y ?? 0.65;
        const baseZ = f.renderPosition?.z ?? -1.05;

        const normalScale = f.renderScale || DEFAULT_FISH_SCALE;
        const fishScale = `${normalScale} ${normalScale} ${normalScale}`;
        const assetPath = f.renderAsset || FISH_ASSET_BY_TYPE[f.type] || DEFAULT_FISH_ASSET;

        return (
          <transform key={`fishGroup_${id}`}>
            <transform
              def={`FishTransform_${id}`}
              id={`Fish_${id}`}
              data-pick-label={`Fish_${id}`}
              translation={`${baseX} ${baseY} ${baseZ}`}
              scale={fishScale}
              rotation="0 1 0 0"
              render={visible ? "true" : "false"}
            >
              <inline url={`"${assetPath}"`} />
            </transform>
          </transform>
        );
      })}

    </X3DViewer>
  );
}
