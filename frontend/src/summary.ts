/**
 * HandDeck - End of Session Summary Panel (Milestone 5)
 * Displays a celebratory 3D results breakdown when all cards are sorted:
 * - Cards Known vs Cards to Revise
 * - Mastery Percentage
 * - Restart / Next Topic action buttons
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

export interface CardResult {
  title: string;
  category: string;
  status: 'know' | 'revise';
}

export interface SummaryPanel {
  group: Group;
  show(results: CardResult[], topic: string, onRestart: () => void): void;
  hide(): void;
  update(delta: number): void;
  isVisible: boolean;
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

export function createSummaryPanel(world: World): SummaryPanel {
  const group = new Group();
  group.name = 'summary-panel';
  group.position.set(0, 1.28, -0.40);
  group.rotation.set(-0.06, 0, 0);
  group.visible = false;

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 700;
  const ctx = canvas.getContext('2d')!;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;

  const geo = new BoxGeometry(0.56, 0.38, 0.015);
  const faceMat = new MeshStandardMaterial({
    map: texture,
    roughness: 0.3,
    metalness: 0.1,
    emissive: new Color('#22c55e'),
    emissiveIntensity: 0.1,
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

  // 3D Restart Button
  const btnCanvas = document.createElement('canvas');
  btnCanvas.width = 512;
  btnCanvas.height = 140;
  const btnCtx = btnCanvas.getContext('2d')!;
  const btnTex = new CanvasTexture(btnCanvas);
  btnTex.colorSpace = SRGBColorSpace;

  function renderRestartBtn(isHover: boolean) {
    btnCtx.clearRect(0, 0, 512, 140);
    roundRect(btnCtx, 8, 8, 496, 124, 24);
    btnCtx.fillStyle = isHover ? '#15803d' : '#166534';
    btnCtx.fill();
    btnCtx.lineWidth = 6;
    btnCtx.strokeStyle = '#4ade80';
    btnCtx.stroke();

    btnCtx.fillStyle = '#ffffff';
    btnCtx.font = 'bold 44px system-ui, sans-serif';
    btnCtx.textAlign = 'center';
    btnCtx.textBaseline = 'middle';
    btnCtx.fillText('🔄 Study Again (Reset)', 256, 70);
    btnTex.needsUpdate = true;
  }
  renderRestartBtn(false);

  const btnGeo = new BoxGeometry(0.24, 0.065, 0.02);
  const btnFaceMat = new MeshStandardMaterial({
    map: btnTex,
    roughness: 0.3,
    emissive: new Color('#22c55e'),
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
  btnMesh.position.set(0, -0.23, 0.02);
  group.add(btnMesh);

  world.createTransformEntity(group);
  const btnEntity = world.createTransformEntity(btnMesh);
  btnEntity.addComponent(RayInteractable);

  let isVisible = false;
  let wasPressed = false;
  let restartCallback: (() => void) | null = null;

  function render(results: CardResult[], topic: string): void {
    ctx.clearRect(0, 0, 1024, 700);

    const grad = ctx.createLinearGradient(0, 0, 0, 700);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    roundRect(ctx, 10, 10, 1004, 680, 36);
    ctx.fill();

    const knownCount = results.filter((r) => r.status === 'know').length;
    const reviseCount = results.filter((r) => r.status === 'revise').length;
    const total = results.length || 5;
    const masteryPct = Math.round((knownCount / total) * 100);

    ctx.lineWidth = 8;
    ctx.strokeStyle = masteryPct >= 60 ? '#22c55e' : '#f97316';
    ctx.stroke();

    // Top Header Banner
    roundRect(ctx, 40, 36, 944, 76, 24);
    ctx.fillStyle = 'rgba(34, 197, 94, 0.16)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#22c55e';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🎉 Session Complete • ${topic.toUpperCase()}`, 512, 74);

    // Score Badges Row
    // Known Card Badge
    roundRect(ctx, 50, 136, 280, 120, 24);
    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#22c55e';
    ctx.stroke();

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText(`${knownCount}`, 190, 180);
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText('✓ MASTERED', 190, 224);

    // Revise Card Badge
    roundRect(ctx, 372, 136, 280, 120, 24);
    ctx.fillStyle = 'rgba(249, 115, 22, 0.15)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#f97316';
    ctx.stroke();

    ctx.fillStyle = '#fb923c';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText(`${reviseCount}`, 512, 180);
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText('↺ TO REVISE', 512, 224);

    // Mastery Rate Badge
    roundRect(ctx, 694, 136, 280, 120, 24);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText(`${masteryPct}%`, 834, 180);
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText('MASTERY RATE', 834, 224);

    // Breakdown list container
    roundRect(ctx, 50, 280, 924, 280, 24);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('DETAILED BREAKDOWN BY CARD:', 75, 315);

    results.forEach((r, idx) => {
      const rowY = 355 + idx * 42;
      const isK = r.status === 'know';

      roundRect(ctx, 75, rowY - 20, 874, 34, 8);
      ctx.fillStyle = isK ? 'rgba(34, 197, 94, 0.08)' : 'rgba(249, 115, 22, 0.08)';
      ctx.fill();

      ctx.fillStyle = isK ? '#4ade80' : '#fb923c';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(isK ? '✓ KNOWN' : '↺ REVISE', 95, rowY);

      ctx.fillStyle = '#ffffff';
      ctx.font = '500 22px system-ui, sans-serif';
      ctx.fillText(`Card #${idx + 1}: ${r.title} (${r.category})`, 250, rowY);
    });

    // Subtitle instructions
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 22px system-ui, sans-serif';
    ctx.fillText('Pinch [Study Again] below or pinch any Topic Chip above to change topics.', 512, 600);

    texture.needsUpdate = true;
  }

  return {
    group,
    get isVisible() {
      return isVisible;
    },
    show(results: CardResult[], topic: string, onRestart: () => void) {
      isVisible = true;
      group.visible = true;
      restartCallback = onRestart;
      render(results, topic);
      sfx.playCorrect();
    },
    hide() {
      isVisible = false;
      group.visible = false;
    },
    update(delta: number) {
      if (!isVisible) return;

      const isPressed = btnEntity.hasComponent(Pressed);
      const isHovered = btnEntity.hasComponent(Hovered);

      btnFaceMat.emissiveIntensity = isPressed ? 0.8 : isHovered ? 0.45 : 0.25;
      renderRestartBtn(isHovered);

      if (isPressed && !wasPressed) {
        sfx.playClick();
        if (restartCallback) restartCallback();
      }
      wasPressed = isPressed;
    },
  };
}
