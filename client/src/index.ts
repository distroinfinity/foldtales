import { World } from '@iwsdk/core';
import { CONTRACT_VERSION } from '@tabletop/contracts/version';
import projectOptions from 'virtual:iwsdk-project';

World.create(document.getElementById('scene-container') as HTMLDivElement, projectOptions).then(() => {
  document.documentElement.dataset.contract = String(CONTRACT_VERSION);
});
