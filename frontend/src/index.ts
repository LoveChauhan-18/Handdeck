/**
 * HandDeck - Seated WebXR Entry Point (Milestone 3)
 */

import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { PanelSystem } from './panel.js';
import { FlashcardSystem, setupFlashcards, resetFlashcards } from './cards.js';
import {
  createTeacher,
  createZones,
  handleVoiceAnswer,
  toggleMic,
  toggleMute,
} from './study-buddy.js';
import { voice } from './voice.js';

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

  // Unlock browser audio autoplay on first user interaction
  const unlock = () => {
    voice.unlockAudio();
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('click', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  // Hook 2D HUD buttons for easy desktop testing
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    resetFlashcards();
  });
  document.getElementById('btn-mute')?.addEventListener('click', () => {
    toggleMute();
  });
  document.getElementById('btn-mic')?.addEventListener('click', () => {
    toggleMic();
  });
  document.getElementById('btn-knew')?.addEventListener('click', () => {
    handleVoiceAnswer('known');
  });
  document.getElementById('btn-not-sure')?.addEventListener('click', () => {
    handleVoiceAnswer('unsure');
  });

  // Convenient keyboard shortcuts for desktop Chrome
  window.addEventListener('keydown', (e) => {
    // Avoid interfering if user is focused on an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.key === 'r' || e.key === 'R') {
      resetFlashcards();
    } else if (e.key === 'm' || e.key === 'M') {
      toggleMute();
    } else if (e.key === 'v' || e.key === 'V' || e.code === 'Space') {
      toggleMic();
    } else if (e.key === '1') {
      handleVoiceAnswer('known');
    } else if (e.key === '2') {
      handleVoiceAnswer('unsure');
    }
  });
});
