<script lang="ts">
  import { onMount } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import type { PageMetadata, PlatformId } from '../../core/types';
  import { getPlatformMap, getPlatforms } from '../../platforms/registry';
  import { resolveImage } from '../../core/fallback';
  import { copyImageUrl, downloadImage } from '../../lib/image-actions';
  import { extractFromActiveTab } from '../../lib/extraction';
  import Header from '../../ui/Header.svelte';
  import CardShell from '../../ui/CardShell.svelte';
  import EmptyState from '../../ui/EmptyState.svelte';
  import SkeletonCard from '../../ui/SkeletonCard.svelte';
  import EditView from '../../ui/EditView.svelte';
  import { createPlatformOrderState } from './platform-order-state.svelte';

  type LoadState = 'injecting' | 'loaded' | 'blocked' | 'error';

  // Registry snapshot for storage APIs (settings stays registry-free).
  const registered: PlatformId[] = getPlatforms().map((p) => p.id);
  const byId = getPlatformMap();
  const pos = createPlatformOrderState(registered);

  let loadState = $state<LoadState>('injecting');
  let meta = $state<PageMetadata | undefined>(undefined);
  let showEdit = $state(false);
  let bodyEl = $state<HTMLDivElement>();
  let isScrolled = $state(false);

  function handleScroll(e: Event) {
    const target = e.currentTarget as HTMLDivElement;
    isScrolled = target.scrollTop > 0;
  }

  // Views fade + scale up + sharpen as they swap (a "materialize"), rather than
  // sliding. The leaving view is pinned with position:absolute (out: true) so it
  // dissolves *over* the arriving one instead of stacking below it and shoving the
  // popup height around; the arriving view stays in flow and defines the content
  // height. Symmetric both directions. Reduced motion collapses it to an instant cut.
  const viewMotionDuration =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : 350;

  // opacity 0→1, scale 0.98→1, blur 4px→0 — Svelte has no built-in blur transition.
  // `out` overlays the leaving view (absolute, top-anchored) so its exit can't disturb
  // layout; the gutter lives on `.view`, so inset 0 lands it exactly where it sat.
  function materialize(
    _node: Element,
    { duration, out = false }: { duration: number; out?: boolean },
  ) {
    return {
      duration,
      easing: cubicOut,
      css: (t: number) =>
        `${out ? 'position: absolute; top: 0; left: 0; right: 0; ' : ''}opacity: ${t}; transform: scale(${0.98 + 0.02 * t}); filter: blur(${4 - 4 * t}px);`,
    };
  }

  // Pin the scroll to the top on every view swap. .body keeps its scroll offset across
  // the swap, and the out-animating (taller) leaving view holds that offset valid for
  // the full duration — so without this the short arriving view sits scrolled out of
  // sight (blank) until the leaving view is removed and the browser clamps scroll back.
  $effect(() => {
    void showEdit;
    if (bodyEl) bodyEl.scrollTop = 0;
  });

  // Enabled platforms sequenced by order (enabledIds is already that subsequence),
  // mapped to definitions.
  const cards = $derived(
    pos.enabledIds
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined),
  );

  // Number of skeleton placeholders to show while injecting — one per enabled
  // platform that is actually registered. Falls back to the enabled count so the
  // shimmer reflects the user's configured list even before the registry is read.
  const skeletonCount = $derived(
    Math.max(1, cards.length || pos.enabledIds.length),
  );

  // The primary resolved image drives the header Copy/Download buttons. resolveImage
  // already skips unsafe URLs (e.g. a `javascript:` og:image), so an unusable image
  // leaves this undefined and the buttons disabled rather than enabled-but-inert.
  const primaryImageUrl = $derived(meta ? resolveImage(meta)?.url : undefined);
  const hasImage = $derived(
    loadState === 'loaded' && primaryImageUrl !== undefined,
  );

  onMount(() => {
    // Fetch user preferences in parallel
    pos.load();

    // Fetch page metadata in parallel
    extractFromActiveTab().then((result) => {
      if (result.status === 'loaded') meta = result.meta;
      loadState = result.status;
    });
  });

  function onCopy(): Promise<void> {
    if (primaryImageUrl === undefined) return Promise.resolve();
    return copyImageUrl(primaryImageUrl);
  }

  function onDownload() {
    if (primaryImageUrl !== undefined && meta)
      downloadImage(primaryImageUrl, meta.pageUrl);
  }
</script>

<div class="popup">
  <Header
    {hasImage}
    {onCopy}
    {onDownload}
    editOpen={showEdit}
    onOpenEdit={() => (showEdit = !showEdit)}
    scrolled={isScrolled}
    onReset={pos.reset}
    canReset={pos.isModified}
  />

  <div class="body" bind:this={bodyEl} onscroll={handleScroll}>
    {#if showEdit}
      <div
        class="view"
        in:materialize={{ duration: viewMotionDuration }}
        out:materialize={{ duration: viewMotionDuration, out: true }}
      >
        <EditView
          order={pos.order}
          enabledIds={pos.enabledIds}
          ready={pos.ready}
          onToggle={pos.toggle}
          onReorder={pos.reorder}
        />
      </div>
    {:else}
      <div
        class="view"
        in:materialize={{ duration: viewMotionDuration }}
        out:materialize={{ duration: viewMotionDuration, out: true }}
      >
        {#if loadState === 'injecting'}
          <div class="cards">
            {#each Array.from({ length: skeletonCount }) as _, i (i)}
              <SkeletonCard />
            {/each}
          </div>
        {:else if loadState === 'loaded' && meta}
          {#if cards.length === 0}
            <EmptyState
              icon="pencil"
              message="No platforms enabled"
              hint="Use the Settings button to choose what to preview."
            />
          {:else}
            <div class="cards">
              {#each cards as p, i (p.id)}
                {@const Card = p.Component}
                {@const card = p.resolve(meta)}
                <CardShell label={p.name} id={p.id} index={i}>
                  <Card {card} />
                </CardShell>
              {/each}
            </div>
          {/if}
        {:else if loadState === 'blocked'}
          <EmptyState
            icon="eye-off"
            message="Can't preview this page"
            hint="Open OGee on a regular web page to see its link previews."
          />
        {:else}
          <EmptyState
            icon="alert-circle"
            message="Something went wrong"
            hint="We couldn't load the link previews for this page."
            role="alert"
          />
        {/if}
      </div>
    {/if}
  </div>

  <div class="blur-container" aria-hidden="true">
    <div class="blur-layer"></div>
    <div class="blur-bg"></div>
  </div>
</div>

<style>
  .popup {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 480px;
    /* Max- (not fixed) height: the popup sizes to its content so short views (the
       empty state, a few cards) don't sit in a tall box, while tall ones cap at
       600 and scroll. Chrome auto-sizes the popup to this in-flow column. */
    max-height: 600px;
    background: var(--bg-primary);
    color: var(--fg-primary);
    font-family: var(--font-sans);
  }

  .body {
    flex: 1;
    /* Positioning context for a leaving view pinned absolute during its dissolve. */
    position: relative;
    overflow-y: auto;
    /* Scroll stays functional, but the bar is hidden: a tall leaving view briefly
       overflows the short arriving box mid-dissolve, and a flickering scrollbar
       reserving/releasing its gutter is what made the swap judder. */
    scrollbar-width: none;
  }

  .body::-webkit-scrollbar {
    display: none;
  }

  /* The gutter rides on each swap-able view (not .body) so an absolutely-pinned
     leaving view lands exactly where it sat in flow — no jump as it dissolves out. */
  .view {
    padding: 64px 16px 16px; /* 48px header height + 16px standard padding */
  }

  .blur-container {
    pointer-events: none;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 64px;
    z-index: 10;
    overflow: hidden;
    /* Custom cubic ease-out mask for smooth progressive blur */
    --header-mask: linear-gradient(
      to bottom,
      oklch(0 0 0 / 0.96) 0%,
      oklch(0 0 0 / 0.64) 12.5%,
      oklch(0 0 0 / 0.48) 25%,
      oklch(0 0 0 / 0.24) 37.5%,
      oklch(0 0 0 / 0.12) 50%,
      oklch(0 0 0 / 0.06) 62.5%,
      oklch(0 0 0 / 0.02) 75%,
      oklch(0 0 0 / 0.004) 87.5%,
      transparent 100%
    );
  }

  .blur-layer {
    position: absolute;
    inset: 0;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    mask-image: var(--header-mask);
    -webkit-mask-image: var(--header-mask);
  }

  .blur-bg {
    position: absolute;
    inset: 0;
    background: var(--bg-primary);
    mask-image: var(--header-mask);
    -webkit-mask-image: var(--header-mask);
  }

  .cards {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }
</style>
