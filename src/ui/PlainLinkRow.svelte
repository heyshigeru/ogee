<script lang="ts">
  // Bare URL line with no card chrome. Used by X for plain-link presentation.
  // Chat platforms (Slack/Discord/Telegram) keep message chrome and render the
  // URL themselves when presentation is plain-link.
  let { url }: { url: string } = $props();
</script>

<p class="plain-link">{url}</p>

<style>
  /* Timeline-style blue URL; not --accent (popup chrome is monochrome). */
  .plain-link {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: oklch(0.667 0.161 245.54);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
