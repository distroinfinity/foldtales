import { World } from '@iwsdk/core';
import { CONTRACT_VERSION } from '@tabletop/contracts/version';
import projectOptions from 'virtual:iwsdk-project';
import { loadPuppet, type StageConfig } from './puppet/puppet.ts';
import { startPlacement } from './stage/placement-runtime.ts';

async function loadStage(world: World): Promise<void> {
  const response = await fetch('./stage.json');
  if (!response.ok) throw new Error(`stage.json answered ${response.status}`);
  const stage = (await response.json()) as StageConfig;
  const puppet = await loadPuppet(`./art/${stage.cast}`, stage);
  puppet.root.visible = false;
  world.scene.add(puppet.root);
  world.onXRFrame((_frame, _delta, time) => puppet.update(time));
  startPlacement(world, puppet.root, () => undefined);
}

World.create(document.getElementById('scene-container') as HTMLDivElement, projectOptions).then((world) => {
  document.documentElement.dataset.contract = String(CONTRACT_VERSION);
  loadStage(world).catch((cause: unknown) => console.error('the stage did not load', cause));
});
