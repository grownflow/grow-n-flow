import X3DViewer from './X3DViewer';

/**
 * Grow Bed visualization component.
 * Displays the raft and net pots where plants grow.
 * Uses modular X3DViewer for easy asset swapping.
 */
export default function GrowBedSection() {
  return (
    <div className="grow-bed-section">
      <h2>Grow Bed</h2>
      <X3DViewer assetPath="grow-bed.x3d" />
    </div>
  );
}
