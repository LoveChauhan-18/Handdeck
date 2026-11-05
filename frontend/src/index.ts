/**
 * HandDeck - Seated WebXR Entry Point (Milestone 2)
 */

import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { PanelSystem } from './panel.js';
import { FlashcardSystem, setupFlashcards, resetFlashcards } from './cards.js';
import { createTeacher, createZones } from './study-buddy.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world.registerSystem(PanelSystem);
  world.registerSystem(FlashcardSystem);

  // Initialize 3D scene elements in seated space
  setupFlashcards(world);
  createTeacher(world);
  createZones(world);

  // Keyboard shortcut 'R' and HUD reset button listener for easy desktop testing
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    resetFlashcards();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
      resetFlashcards();
    }
  });
});
