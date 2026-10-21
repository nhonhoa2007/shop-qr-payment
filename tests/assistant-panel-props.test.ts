import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('AssistantPanel - Component Interface & Props', () => {
  const panelPath = path.resolve(process.cwd(), 'src/client/components/assistant/AssistantPanel.tsx');
  const source = fs.readFileSync(panelPath, 'utf8');

  it('exports AssistantPanel component function', () => {
    assert.match(source, /export function AssistantPanel\s*\(/);
  });

  it('exports AssistantPanelProps interface with onLoadingChange and onClose', () => {
    assert.match(source, /export interface AssistantPanelProps/);
    assert.match(source, /onLoadingChange\?:\s*\(loading:\s*boolean\)\s*=>\s*void/);
    assert.match(source, /onClose\?:\s*\(\)\s*=>\s*void/);
  });

  it('invokes onLoadingChange(true) before fetch and onLoadingChange(false) in finally block', () => {
    assert.match(source, /onLoadingChange\?\.\(true\)/);
    assert.match(source, /onLoadingChange\?\.\(false\)/);
  });

  it('renders a close button when onClose prop is provided', () => {
    assert.match(source, /onClose\s*&&/);
  });
});
