<script lang="ts">
  import type { Snippet } from 'svelte';
  let { title, children }: { title: string; children: Snippet } = $props();
</script>

<section class="section">
  <h3 class="section-title">{title}</h3>
  <div class="card">
    {@render children()}
  </div>
</section>

<style>
  .section-title {
    margin: 0 4px 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--fg-secondary);
  }
  .card {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 4px 12px;
  }
</style>
