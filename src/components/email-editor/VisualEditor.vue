<script setup lang="ts">
/**
 * VisualEditor — GrapesJS + MJML drag-and-drop email builder.
 *
 * Architecture:
 *   - GrapesJS handles the canvas, block palette, and style/layer panels.
 *   - grapesjs-mjml supplies MJML components (section, column, text,
 *     button, image…) so the output compiles to responsive HTML.
 *   - We expose a v-model for the MJML source; on every canvas change
 *     we emit both the MJML and the compiled HTML so the parent can
 *     persist MJML in the `mjml_source` column and HTML in `body`.
 *   - No GrapesJS storage plugin — persistence is the parent's job
 *     via v-model / update events.
 *
 * Custom blocks: adds a "Product card" block that renders a
 * Handlebars-shim `{{#each cart_items}}` row template, so authors can
 * drop cart/recommended-product sections without hand-writing MJML.
 *
 * Lifecycle: GrapesJS is a heavy ~300KB editor; we initialise it lazily
 * in onMounted so it doesn't block non-visual template edits.
 */
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
// @ts-ignore — grapesjs has a `.d.ts` but it's sparse; loose types here
import grapesjs from 'grapesjs'
// @ts-ignore
import mjmlPlugin from 'grapesjs-mjml'
import 'grapesjs/dist/css/grapes.min.css'

const props = defineProps<{
  modelValue: string     // MJML source
  initialHtml?: string   // compiled HTML, used as fallback if MJML empty
}>()

const emit = defineEmits<{
  'update:modelValue': [mjml: string]
  'update-html':       [html: string]
}>()

const container = ref<HTMLDivElement | null>(null)
// Typed loosely — grapesjs's TS declarations don't cover runtime API
// surface we use (runCommand, Components, etc.).
let editor: any = null

const DEFAULT_MJML = `<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text font-size="20px" color="#020288" font-family="Helvetica, Arial, sans-serif">
          Hello {{first_name}}
        </mj-text>
        <mj-text font-size="14px" line-height="1.6">
          Welcome to AR-PAY. Drag more blocks from the left to build your email.
        </mj-text>
        <mj-button background-color="#0099db" href="#">Get started</mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`

// A ready-to-drop Handlebars-shim block for cart-item / recommendation
// iteration. The editor emits it as pure MJML so it round-trips through
// GrapesJS import/export cleanly.
const PRODUCT_LOOP_BLOCK = `
<mj-section background-color="#ffffff">
  <mj-column>
    <mj-text font-weight="bold" font-size="16px">Your cart</mj-text>
    <mj-raw>{{#each cart_items}}</mj-raw>
    <mj-section padding="8px 0">
      <mj-column width="25%">
        <mj-image src="{{this.image_url}}" alt="{{this.name}}" />
      </mj-column>
      <mj-column width="75%">
        <mj-text font-weight="600">{{this.name}}</mj-text>
        <mj-text color="#555555">{{this.quantity}} × {{this.price}}</mj-text>
      </mj-column>
    </mj-section>
    <mj-raw>{{/each}}</mj-raw>
    <mj-text font-weight="bold" align="right">Total: {{cart_total}} {{cart_currency}}</mj-text>
  </mj-column>
</mj-section>
`.trim()

onMounted(() => {
  if (!container.value) return

  editor = grapesjs.init({
    container: container.value,
    height: '100%',
    width: 'auto',
    fromElement: false,
    storageManager: false,  // parent owns persistence
    plugins: [mjmlPlugin],
    pluginsOpts: {
      [mjmlPlugin as any]: {
        // Let the plugin manage the <head>/<body>/<mj-body> scaffolding
        // so dropping blocks at the root 'just works'.
      },
    },
    canvas: {
      styles: [],
    },
    panels: { defaults: [] },  // keep the chrome minimal; Vue wraps the editor
  })

  // Load initial MJML — prefer v-model, fall back to the default starter.
  const initial = (props.modelValue && props.modelValue.trim())
    ? props.modelValue
    : DEFAULT_MJML
  editor.setComponents(initial)

  // Register the cart-loop block in the MJML plugin's category.
  editor.BlockManager.add('ma-product-loop', {
    label: 'Cart items loop',
    category: 'Dynamic',
    content: PRODUCT_LOOP_BLOCK,
    media: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="28" height="28">
              <path d="M3 3h2l2 14h11l3-9H7.5"/>
              <circle cx="10" cy="20" r="1.5"/>
              <circle cx="17" cy="20" r="1.5"/>
            </svg>`,
  })

  // Emit changes on every canvas update. Debouncing would be nicer but
  // GrapesJS's own update cadence is already rate-limited.
  editor.on('update', () => {
    const mjml = editor.getHtml()
    emit('update:modelValue', mjml)
    // Compile MJML → HTML for the runtime renderer. We lazy-import
    // mjml-browser so the worker/bundle only loads it when the editor
    // actually runs.
    compile(mjml).then((html) => emit('update-html', html)).catch(() => {
      // compilation errors (malformed markup) are tolerated silently;
      // the MJML source is still saved and the user can fix it.
    })
  })
})

onBeforeUnmount(() => {
  try { editor?.destroy?.() } catch { /* noop */ }
  editor = null
})

watch(() => props.modelValue, (v) => {
  // External update (e.g. user switched from Code mode back to Visual).
  // Only apply if the content actually differs from what the editor has.
  if (!editor) return
  const current = editor.getHtml()
  if (v && v !== current) {
    editor.setComponents(v)
  }
})

async function compile(mjml: string): Promise<string> {
  // mjml-browser is ~200KB compressed — lazy-imported at first compile.
  // No bundled types (@types/mjml-browser doesn't exist), hence the
  // @ts-ignore on the dynamic import rather than a sibling .d.ts file.
  // @ts-ignore — untyped third-party module
  const mod: any = await import('mjml-browser')
  const mjml2html = (mod.default || mod)
  const result = mjml2html(mjml, { validationLevel: 'soft' })
  return result?.html || ''
}
</script>

<template>
  <div ref="container" class="ma-visual-editor" aria-label="Visual email editor"></div>
</template>

<style>
.ma-visual-editor {
  height: 100%;
  min-height: 500px;
  display: flex;
  flex-direction: column;
}
/* GrapesJS ships a kitchen-sink theme; scoped tweaks keep it from
   fighting the editorial design system. */
.gjs-pn-panel { z-index: 1; }
.gjs-block { font-family: inherit !important; }
</style>
