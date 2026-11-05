/**
 * HandDeck - Seated WebXR Entry Point
 */

import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { PanelSystem } from './panel.js';
import { FlashcardSystem, setupFlashcards } from './cards.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world.registerSystem(PanelSystem);
  world.registerSystem(FlashcardSystem);
  setupFlashcards(world);
});
