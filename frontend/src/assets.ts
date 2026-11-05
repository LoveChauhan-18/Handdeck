/**
 * HandDeck Asset Manifest
 */

import { AssetType, defineAssets } from '@iwsdk/core';
import { createStudioFloor } from './scene-assets/studio.scene-asset.js';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

const uikitml = (fileName: string, name: string) => ({
  url: publicAssetUrl(`ui/${fileName}`),
  type: AssetType.UIKitML,
  name,
});

export default defineAssets({
  'studio-floor': createStudioFloor(),
  'welcome-panel': uikitml('welcome.uikitml', 'Welcome Panel'),
});
