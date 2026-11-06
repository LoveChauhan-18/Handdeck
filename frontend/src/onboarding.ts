/**
 * HandDeck - In-VR 15-second Onboarding (Milestone 5)
 * Teaches: 1. Grab Card  2. Speak/Pinch Answer  3. Sort into Trays
 * Dismisses automatically after 15 seconds or on clicking "Got it!"
 */

import {
  BoxGeometry,
  CanvasTexture,
  Color,
  Euler,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { Entity, Hovered, Pressed, RayInteractable, World } from '@iwsdk/core';
import { sfx } from './audio.js';

export interface OnboardingManager {
  entity: Entity | null;
  group: Group | null;
  isVisible: boolean;
  timeLeft: number;
  update(delta: number): void;
  dismiss(): void;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function createOnboarding(world: World): OnboardingManager {
  const group = new Group();
  group.name = 'onboarding-panel';
  // Positioned directly in comfortable line of sight (seated center)
  group.position.set(0, 1.28, -0.42);
  group.rotation.set(-0.08, 0, 0);

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 680;
  const ctx = canvas.getContext('2d')!;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;

  const geo = new BoxGeometry(0.54, 0.36, 0.015);
  const faceMat = new MeshStandardMaterial({
    map: texture,
    roughness: 0.3,
    metalness: 0.1,
    emissive: new Color('#38bdf8'),
    emissiveIntensity: 0.12,
  });
  const edgeMat = new MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.5,
  });

  const mesh = new Mesh(geo, [
    edgeMat,
    edgeMat,
    edgeMat,
    edgeMat,
    faceMat, // +Z
    edgeMat,
  ]);
  group.add(mesh);

  // Dismiss button mesh (3D pinch-able button directly attached to onboarding)
  const btnCanvas = document.createElement('canvas');
  btnCanvas.width = 512;
  btnCanvas.height = 140;
  const btnCtx = btnCanvas.getContext('2d')!;
  const btnTex = new CanvasTexture(btnCanvas);
  btnTex.colorSpace = SRGBColorSpace;

  function renderBtn(isHover: boolean) {
    btnCtx.clearRect(0, 0, 512, 140);
    roundRect(btnCtx, 8, 8, 496, 124, 24);
    btnCtx.fillStyle = isHover ? '#0284c7' : '#0369a1';
    btnCtx.fill();
    btnCtx.lineWidth = 6;
    btnCtx.strokeStyle = '#38bdf8';
    btnCtx.stroke();

    btnCtx.fillStyle = '#ffffff';
    btnCtx.font = 'bold 44px system-ui, sans-serif';
    btnCtx.textAlign = 'center';
    btnCtx.textBaseline = 'middle';
    btnCtx.fillText('🚀 Got It! Let’s Study', 256, 70);
    btnTex.needsUpdate = true;
  }
  renderBtn(false);

  const btnGeo = new BoxGeometry(0.24, 0.065, 0.02);
  const btnFaceMat = new MeshStandardMaterial({
    map: btnTex,
    roughness: 0.3,
    emissive: new Color('#38bdf8'),
    emissiveIntensity: 0.25,
  });
  const btnMesh = new Mesh(btnGeo, [
    edgeMat,
    edgeMat,
    edgeMat,
    edgeMat,
    btnFaceMat,
    edgeMat,
  ]);
  btnMesh.position.set(0, -0.22, 0.02);
  group.add(btnMesh);

  const entity = world.createTransformEntity(group);
  const btnEntity = world.createTransformEntity(btnMesh);
  btnEntity.addComponent(RayInteractable);

  let timeLeft = 14.0;
  let isVisible = true;
  let wasPressed = false;

  function render(timeRemaining: number): void {
    ctx.clearRect(0, 0, 1024, 680);

    // Deep modern glass gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 680);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    roundRect(ctx, 10, 10, 1004, 660, 36);
    ctx.fill();

    ctx.lineWidth = 8;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    // Title banner
    roundRect(ctx, 40, 36, 944, 76, 24);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👋 Welcome to HandDeck VR Study Buddy!', 512, 74);

    // 3 Quick Steps columns
    const steps = [
      {
        num: '1',
        icon: '🤏',
        title: 'GRAB CARD',
        desc: 'Pinch any floating card & bring it to the Teacher orb in front.',
        color: '#38bdf8',
        x: 48,
      },
      {
        num: '2',
        icon: '🎙',
        title: 'ANSWER',
        desc: 'Speak your answer aloud or click [I knew it] / [Not sure] or [Hint].',
        color: '#a855f7',
        x: 360,
      },
      {
        num: '3',
        icon: '🗂',
        title: 'SORT TRAY',
        desc: 'Drop in KNOW (Right / Green) or REVISE (Left / Orange) tray.',
        color: '#22c55e',
        x: 672,
      },
    ];

    steps.forEach((s) => {
      roundRect(ctx, s.x, 140, 304, 390, 24);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = s.color;
      ctx.stroke();

      // Step Number Badge
      roundRect(ctx, s.x + 20, 160, 48, 48, 14);
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.fillStyle = '#020617';
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.fillText(s.num, s.x + 44, 184);

      // Icon
      ctx.font = '72px system-ui, sans-serif';
      ctx.fillText(s.icon, s.x + 152, 260);

      // Title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.fillText(s.title, s.x + 152, 340);

      // Desc
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '400 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const words = s.desc.split(' ');
      let line = '';
      let curY = 390;
      for (let w of words) {
        let test = line + w + ' ';
        if (ctx.measureText(test).width > 260 && line !== '') {
          ctx.fillText(line, s.x + 152, curY);
          line = w + ' ';
          curY += 32;
        } else {
          line = test;
        }
      }
      ctx.fillText(line, s.x + 152, curY);
    });

    // Countdown / Auto-start footer
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `⏱ Auto-starting in ${Math.max(1, Math.ceil(timeRemaining))}s • Or pinch the button below`,
      512,
      570
    );

    // Progress bar along bottom
    const pct = Math.max(0, timeRemaining / 14.0);
    roundRect(ctx, 60, 610, 904, 14, 7);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fill();

    roundRect(ctx, 60, 610, 904 * pct, 14, 7);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();

    texture.needsUpdate = true;
  }

  render(timeLeft);

  function dismiss(): void {
    if (!isVisible) return;
    isVisible = false;
    group.visible = false;
    sfx.playClick();
  }

  return {
    entity,
    group,
    get isVisible() {
      return isVisible;
    },
    timeLeft,
    update(delta: number) {
      if (!isVisible) return;

      timeLeft -= delta;
      render(timeLeft);

      const isPressed = btnEntity.hasComponent(Pressed);
      const isHovered = btnEntity.hasComponent(Hovered);

      btnFaceMat.emissiveIntensity = isPressed ? 0.8 : isHovered ? 0.45 : 0.2;
      renderBtn(isHovered);

      if (isPressed && !wasPressed) {
        dismiss();
      }
      wasPressed = isPressed;

      if (timeLeft <= 0) {
        dismiss();
      }
    },
    dismiss,
  };
}
