<script setup>
import { ref } from 'vue'
import PdfCompressor from './PdfCompressor.vue'
import ImageToPdf from './ImageToPdf.vue'
import PdfDismantle from './PdfDismantle.vue'
import PdfMerge from './PdfMerge.vue'

// ─── Sub-Tab Navigation ───
const activeSubTab = ref('compress') // 'compress' | 'img2pdf' | 'dismantle' | 'merge'
</script>

<template>
  <div id="panel-pdftools" class="max-w-6xl mx-auto w-full space-y-6">
    <!-- Sub-Tab Navigation -->
    <div
      class="flex p-1 bg-slate-900/60 border border-slate-800/80 rounded-xl max-w-2xl mx-auto w-full overflow-x-auto custom-scrollbar"
    >
      <button
        type="button"
        @click="activeSubTab = 'compress'"
        :class="[
          'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer min-w-max',
          activeSubTab === 'compress'
            ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40',
        ]"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
        Kompres PDF
      </button>

      <button
        type="button"
        @click="activeSubTab = 'img2pdf'"
        :class="[
          'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer min-w-max',
          activeSubTab === 'img2pdf'
            ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40',
        ]"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Gambar ke PDF
      </button>

      <button
        type="button"
        @click="activeSubTab = 'dismantle'"
        :class="[
          'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer min-w-max',
          activeSubTab === 'dismantle'
            ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40',
        ]"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
        Pecah PDF
      </button>

      <button
        type="button"
        @click="activeSubTab = 'merge'"
        :class="[
          'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer min-w-max',
          activeSubTab === 'merge'
            ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40',
        ]"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
        </svg>
        Gabung PDF
      </button>
    </div>

    <!-- ═══════════════════════════════ -->
    <!-- SUB-TABS CONTENT               -->
    <!-- ═══════════════════════════════ -->
    <keep-alive>
      <component :is="activeSubTab === 'compress' ? PdfCompressor : 
                      activeSubTab === 'img2pdf' ? ImageToPdf : 
                      activeSubTab === 'dismantle' ? PdfDismantle : 
                      PdfMerge" />
    </keep-alive>
  </div>
</template>
