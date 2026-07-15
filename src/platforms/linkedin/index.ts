import { register } from '../registry';
import { resolve } from './resolve';
import LinkedInCard from './LinkedInCard.svelte';

// Self-registration is this module's only import side effect. The registry's
// import.meta.glob auto-discovers this file — no shared file is edited to add
// LinkedIn (ADR P1-D4 / P1-D5).
register({
  id: 'linkedin',
  name: 'LinkedIn',
  resolve,
  Component: LinkedInCard,
});
