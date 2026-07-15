<script lang="ts">
  import type { PlatformId } from '../core/types';
  import { PLATFORM_ICON_PATHS } from './platform-icons';

  // A platform's brand glyph (Simple Icons). Decorative: the label text beside it
  // names the platform, so the svg is aria-hidden. Inherits color via currentColor.
  let { id, size = 14 }: { id: PlatformId; size?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="currentColor"
  aria-hidden="true"
  focusable="false"
>
  <path d={PLATFORM_ICON_PATHS[id]} />
</svg>
