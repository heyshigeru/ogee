<script lang="ts">
  // Presentational shimmer placeholder shown while a preview resolves.
</script>

<div class="skeleton" aria-hidden="true">
  <div class="shimmer media"></div>
  <div class="body">
    <div class="shimmer line title"></div>
    <div class="shimmer line"></div>
    <div class="shimmer line short"></div>
  </div>
</div>

<style>
  .skeleton {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--border, oklch(0.879 0.013 228.946));
    border-radius: var(--card-radius, 16px);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
  }

  .media {
    aspect-ratio: 1.91 / 1;
    width: 100%;
  }

  .line {
    height: 12px;
    border-radius: 4px;
  }

  .line.title {
    height: 16px;
    width: 70%;
  }

  .line.short {
    width: 40%;
  }

  .shimmer {
    background: linear-gradient(
      90deg,
      var(--skeleton-base, oklch(0.94 0.008 236.564)) 25%,
      var(--skeleton-highlight, oklch(0.981 0.002 197.122)) 37%,
      var(--skeleton-base, oklch(0.94 0.008 236.564)) 63%
    );
    background-size: 400% 100%;
    animation: shimmer 1.4s ease infinite;
  }

  @keyframes shimmer {
    0% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0 50%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .shimmer {
      animation: none;
    }
  }
</style>
