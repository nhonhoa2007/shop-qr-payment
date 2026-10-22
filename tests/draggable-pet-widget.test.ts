import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  clampCoordinates,
  isDragMovement,
} from '@client/components/assistant/draggable-pet-math';
import { transitionPetAnimation } from '@client/components/assistant/pet-animation';

describe('Clawd Chef response animation', () => {
  it('moves from idle through cooking and waving, then returns to idle', () => {
    assert.equal(transitionPetAnimation('idle', 'start'), 'cooking');
    assert.equal(transitionPetAnimation('cooking', 'success'), 'finished');
    assert.equal(transitionPetAnimation('finished', 'timeout'), 'idle');
  });

  it('does not celebrate failed responses or let an old timer interrupt a new request', () => {
    assert.equal(transitionPetAnimation('cooking', 'failure'), 'idle');
    assert.equal(transitionPetAnimation('finished', 'start'), 'cooking');
    assert.equal(transitionPetAnimation('cooking', 'timeout'), 'cooking');
  });
});

describe('DraggablePetWidget - Coordinate Clamping & Interaction Detection', () => {
  it('clamps coordinates strictly within viewport boundaries with margins', () => {
    const viewport = { width: 1000, height: 800 };
    const widgetSize = { width: 80, height: 90 };
    const margin = 12;

    // Inside bounds: unchanged
    assert.deepEqual(
      clampCoordinates({ x: 500, y: 400 }, viewport, widgetSize, margin),
      { x: 500, y: 400 }
    );

    // Negative / left overflow: clamped to margin
    assert.deepEqual(
      clampCoordinates({ x: -50, y: 400 }, viewport, widgetSize, margin),
      { x: 12, y: 400 }
    );

    // Right overflow: clamped to viewport - width - margin
    assert.deepEqual(
      clampCoordinates({ x: 1200, y: 400 }, viewport, widgetSize, margin),
      { x: 1000 - 80 - 12, y: 400 }
    );

    // Bottom overflow: clamped to viewport - height - margin
    assert.deepEqual(
      clampCoordinates({ x: 500, y: 900 }, viewport, widgetSize, margin),
      { x: 500, y: 800 - 90 - 12 }
    );
  });

  it('discriminates click from drag movement with 6px threshold', () => {
    assert.equal(isDragMovement({ x: 0, y: 0 }, { x: 3, y: 4 }), false); // hypot = 5 < 6
    assert.equal(isDragMovement({ x: 0, y: 0 }, { x: 6, y: 0 }), true); // hypot = 6 >= 6
    assert.equal(isDragMovement({ x: 10, y: 10 }, { x: 20, y: 20 }), true); // hypot = 14.14 >= 6
  });
});

describe('DraggablePetWidget - Component Architecture & Invariants', () => {
  const widgetPath = path.resolve(
    process.cwd(),
    'src/client/components/assistant/DraggablePetWidget.tsx'
  );

  it('ensures DraggablePetWidget.tsx exists and is defined', () => {
    assert.ok(fs.existsSync(widgetPath), 'DraggablePetWidget.tsx must exist');
    const source = fs.readFileSync(widgetPath, 'utf8');

    // Admin route gate
    assert.match(source, /\/admin/, 'Must check for /admin route to hide on admin pages');

    // LocalStorage position persistence
    assert.match(source, /clawd_pet_position/, 'Must use localStorage clawd_pet_position');

    // Spritesheet asset path
    assert.match(
      source,
      /\/assets\/pet\/clawd-chef\/spritesheet\.webp/,
      'Must load clawd-chef spritesheet asset'
    );

    // Mounts AssistantPanel
    assert.match(source, /AssistantPanel/, 'Must mount AssistantPanel');
  });
});
