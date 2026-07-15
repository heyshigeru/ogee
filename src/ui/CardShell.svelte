<script lang="ts">
  import type { PlatformId } from '../core/types';
  import PlatformIcon from './PlatformIcon.svelte';

  let {
    label,
    id,
    index = 0,
    children,
  }: {
    label: string;
    id: PlatformId;
    index?: number;
    children?: import('svelte').Snippet;
  } = $props();
</script>

<!-- index drives a small staggered entrance; capped so a full 8-card list never
     feels slow. The eyebrow label is a brand glyph + name, intentionally low-weight
     and neutral so it identifies the (calibrated) card below without competing. -->
<section
  class="card-shell"
  aria-label={label}
  style="animation-delay: {Math.min(index, 7) * 30}ms"
>
  <h3 class="label">
    <span class="mark"><PlatformIcon {id} /></span>
    <span>{label}</span>
  </h3>
  {@render children?.()}
</section>

<style>
  .card-shell {
    display: flex;
    flex-direction: column;
    gap: 16px;
    animation: card-enter 0.3s cubic-bezier(0.2, 0, 0, 1) both;
  }

  .label {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 12px;
    font-weight: 500;
    color: var(--fg-primary);
  }

  /* Icon stays muted while the name reads strong — the same balance the edit
     rows use, so the solid glyph doesn't overpower the small label text. */
  .mark {
    display: inline-flex;
    color: var(--fg-secondary);
  }

  @keyframes card-enter {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .card-shell {
      animation: none;
    }
  }
</style>
