import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Storefront Layout Integration: Draggable AI Pet Mascot', () => {
  it('ensures spritesheet asset is present in public assets', () => {
    const assetPath = path.resolve(process.cwd(), 'public/assets/pet/clawd-chef/spritesheet.webp');
    assert.ok(fs.existsSync(assetPath), 'Clawd Chef spritesheet must exist in public/assets');
    const stats = fs.statSync(assetPath);
    assert.ok(stats.size > 1000, 'Spritesheet file must not be empty');
  });

  it('ensures layout.tsx mounts DraggablePetWidget', () => {
    const layoutContent = fs.readFileSync(path.resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8');
    assert.ok(
      layoutContent.includes('DraggablePetWidget'),
      'Root layout must import and render DraggablePetWidget'
    );
  });
});
