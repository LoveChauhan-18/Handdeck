/**
 * HandDeck - Seated WebXR Entry Point (Milestone 4)
 */

import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { PanelSystem } from './panel.js';
import { FlashcardSystem, setupFlashcards, resetFlashcards } from './cards.js';
import {
  createTeacher,
  createZones,
  handleVoiceAnswer,
  requestHint,
  selectTopic,
  toggleMic,
  toggleMute,
} from './study-buddy.js';
import { voice } from './voice.js';
import { sfx } from './audio.js';

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

  // Unlock browser audio autoplay & Web Audio synthesizer on first user interaction
  const unlock = () => {
    voice.unlockAudio();
    sfx.unlock();
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
  document.getElementById('btn-hint')?.addEventListener('click', () => {
    requestHint();
  });

  // Topic Buttons in HUD
  document.getElementById('btn-topic-bio')?.addEventListener('click', () => {
    selectTopic('Biology');
  });
  document.getElementById('btn-topic-phys')?.addEventListener('click', () => {
    selectTopic('Physics');
  });
  document.getElementById('btn-topic-space')?.addEventListener('click', () => {
    selectTopic('Space');
  });
  document.getElementById('btn-topic-hist')?.addEventListener('click', () => {
    selectTopic('History');
  });
  document.getElementById('btn-topic-py')?.addEventListener('click', () => {
    selectTopic('Python');
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
    } else if (e.key === 'h' || e.key === 'H') {
      requestHint();
    } else if (e.key === '1') {
      handleVoiceAnswer('known');
    } else if (e.key === '2') {
      handleVoiceAnswer('unsure');
    }
  });
});
