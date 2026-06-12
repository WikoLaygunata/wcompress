<script setup>
import { ref, onUnmounted, inject, computed } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { jsPDF } from 'jspdf'

// Configure PDF.js worker locally (offline-ready, no CDN)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

const showToast = inject('showToast')

// ─── PDF COMPRESSOR STATE ───
const pdfFile = ref(null)
const pdfName = ref('')
const pdfPageCount = ref(0)
const compressQuality = ref(75)
const isCompressing = ref(false)
const currentProcessingPage = ref(0)
const originalPdfSize = ref(0)
const compressedPdfBlob = ref(null)
const compressedPdfUrl = ref('')
const compressedPdfSize = ref(0)
const pdfRenderScale = ref(2.0)
const pdfFileInput = ref(null)

// ─── HELPERS ───
const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

const spaceSavings = computed(() => {
  if (!originalPdfSize.value || !compressedPdfSize.value) return 0
  const savings = (1 - compressedPdfSize.value / originalPdfSize.value) * 100
  return savings > 0 ? Math.round(savings) : 0
})

const compressPreviewUrls = ref([])

const generateCompressPreview = async (blob) => {
  compressPreviewUrls.value = []
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    const totalPages = pdf.numPages
    const urls = []

    // Preview up to 5 pages
    const previewCount = Math.min(totalPages, 5)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    for (let i = 1; i <= previewCount; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 1.0 })
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: ctx, viewport }).promise
      urls.push(canvas.toDataURL('image/jpeg', 0.8))
    }
    canvas.width = 0
    canvas.height = 0
    compressPreviewUrls.value = urls
    loadingTask.destroy()
  } catch (err) {
    console.error('Failed to generate compress preview:', err)
  }
}

// ─── PDF COMPRESSOR LOGIC ───
const triggerPdfInput = () => pdfFileInput.value?.click()

const handlePdfUpload = async (e) => {
  const files = e.target.files || e.dataTransfer?.files
  if (!files || files.length === 0) return

  const file = files[0]
  if (file.type !== 'application/pdf') {
    showToast('File Tidak Valid', 'Mohon unggah file PDF saja.', 'warning')
    return
  }

  // Reset previous state
  resetPdfCompressor(false)

  pdfFile.value = file
  pdfName.value = file.name
  originalPdfSize.value = file.size
  currentProcessingPage.value = 0

  try {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    pdfPageCount.value = pdf.numPages

    if (pdf.numPages > 20) {
      showToast(
        'Dokumen Besar Terdeteksi',
        `File ini memiliki ${pdf.numPages} halaman. Proses mungkin lambat dan memakan banyak RAM. Risiko ditanggung pengguna.`,
        'warning',
      )
    }

    showToast('PDF Dimuat', `${file.name} — ${pdf.numPages} halaman siap dikompres.`)
    loadingTask.destroy()
  } catch (err) {
    console.error('Failed to read PDF:', err)
    showToast('Gagal Membaca PDF', 'File PDF rusak atau tidak didukung.', 'error')
    resetPdfCompressor(false)
  }
}

const compressPdf = async () => {
  if (!pdfFile.value || isCompressing.value) return

  isCompressing.value = true
  currentProcessingPage.value = 0
  showToast('Memproses PDF', 'Mengompresi halaman demi halaman di browsermu...', 'info')

  try {
    const arrayBuffer = await pdfFile.value.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    const totalPages = pdf.numPages

    const ptToMm = 25.4 / 72

    let doc = null

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    for (let i = 1; i <= totalPages; i++) {
      currentProcessingPage.value = i
      const page = await pdf.getPage(i)

      const originalViewport = page.getViewport({ scale: 1.0 })
      const origWidthMm = originalViewport.width * ptToMm
      const origHeightMm = originalViewport.height * ptToMm

      const renderViewport = page.getViewport({ scale: pdfRenderScale.value })
      canvas.width = renderViewport.width
      canvas.height = renderViewport.height
      // Fill white background to prevent black backgrounds in JPEGs
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      await page.render({ canvasContext: ctx, viewport: renderViewport }).promise

      const safeQuality = Math.min(compressQuality.value / 100, 0.99)
      const imgData = canvas.toDataURL('image/jpeg', safeQuality)

      const isLandscape = originalViewport.width > originalViewport.height
      const orientation = isLandscape ? 'landscape' : 'portrait'

      if (i === 1) {
        doc = new jsPDF({
          orientation,
          unit: 'mm',
          format: [origWidthMm, origHeightMm],
          compress: true,
        })
      } else {
        doc.addPage([origWidthMm, origHeightMm], orientation)
      }

      doc.addImage(imgData, 'JPEG', 0, 0, origWidthMm, origHeightMm)

      // Beri jeda agar UI tidak macet
      await new Promise(resolve => setTimeout(resolve, 15))
    }

    canvas.width = 0
    canvas.height = 0

    loadingTask.destroy()

    const blob = doc.output('blob')

    if (compressedPdfUrl.value) {
      URL.revokeObjectURL(compressedPdfUrl.value)
    }

    compressedPdfBlob.value = blob
    compressedPdfUrl.value = URL.createObjectURL(blob)
    compressedPdfSize.value = blob.size

    await generateCompressPreview(blob)

    showToast(
      'Kompresi Selesai!',
      `Ukuran berhasil diperkecil dari ${formatSize(originalPdfSize.value)} ke ${formatSize(blob.size)}.`,
    )
  } catch (err) {
    console.error('PDF compression error:', err)
    showToast('Gagal Kompresi', 'Terjadi kesalahan saat mengompresi PDF.', 'error')
  } finally {
    isCompressing.value = false
  }
}

const downloadCompressedPdf = () => {
  if (!compressedPdfUrl.value) return
  const a = document.createElement('a')
  a.href = compressedPdfUrl.value
  a.download = `wcompress_${pdfName.value || 'compressed'}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  showToast('Unduhan Dimulai', 'File PDF hasil kompresi berhasil disimpan.')
}

const resetPdfCompressor = (notify = true) => {
  pdfFile.value = null
  pdfName.value = ''
  pdfPageCount.value = 0
  originalPdfSize.value = 0
  isCompressing.value = false
  currentProcessingPage.value = 0

  if (compressedPdfUrl.value) {
    URL.revokeObjectURL(compressedPdfUrl.value)
    compressedPdfUrl.value = ''
  }
  compressedPdfBlob.value = null
  compressedPdfSize.value = 0
  compressPreviewUrls.value = []

  if (pdfFileInput.value) pdfFileInput.value.value = ''
  if (notify) showToast('Reset', 'Dokumen PDF telah dihapus.')
}

// ─── MEMORY CLEANUP ───
onUnmounted(() => {
  if (compressedPdfUrl.value) URL.revokeObjectURL(compressedPdfUrl.value)
  compressedPdfBlob.value = null
  compressPreviewUrls.value = []
})
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
    <!-- Left Panel (5 cols) -->
    <div
      class="md:col-span-5 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-6 backdrop-blur-sm transition-all duration-300 hover:border-slate-700/60 hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)]"
    >
      <div class="flex items-center justify-between pb-4 border-b border-slate-800">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <span class="w-1.5 h-4 bg-brand-500 rounded"></span>
          Kompres Berkas PDF
        </h3>
        <button
          v-if="pdfFile"
          @click="resetPdfCompressor()"
          class="text-xs font-semibold text-rose-400 hover:text-rose-300 transition cursor-pointer"
        >
          Reset Dokumen
        </button>
      </div>

      <!-- PDF Upload Dropzone -->
      <div class="space-y-2">
        <label class="text-xs font-semibold text-slate-300 uppercase tracking-wider">Unggah PDF</label>
        <div
          @click="triggerPdfInput"
          @dragover.prevent
          @drop.prevent="handlePdfUpload"
          class="border-2 border-dashed border-slate-800 hover:border-brand-500/50 bg-slate-950/20 hover:bg-slate-900/10 transition-all rounded-xl p-6 text-center cursor-pointer group relative"
        >
          <input
            type="file"
            ref="pdfFileInput"
            @change="handlePdfUpload"
            class="hidden"
            accept="application/pdf"
          />
          <div class="space-y-2 pointer-events-none py-2">
            <div
              class="mx-auto w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:scale-110 group-hover:border-brand-500 transition-all"
            >
              <svg
                class="w-5 h-5 text-slate-400 group-hover:text-brand-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div class="space-y-0.5">
              <p class="text-xs text-slate-300 font-medium">
                Drag & drop PDF atau
                <span class="text-brand-400 group-hover:underline">telusuri</span>
              </p>
              <p class="text-[10px] text-slate-500">Mendukung file .pdf</p>
            </div>
          </div>
        </div>
      </div>

      <!-- File Info Badge -->
      <div v-if="pdfFile" class="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-300 truncate max-w-[180px]" :title="pdfName">{{ pdfName }}</span>
          <span class="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase">
            {{ pdfPageCount }} Halaman
          </span>
        </div>
        <p class="text-[10px] text-slate-500 font-mono">Ukuran asli: {{ formatSize(originalPdfSize) }}</p>
      </div>

      <!-- Quality Slider -->
      <div class="space-y-3">
        <div class="flex justify-between">
          <label class="text-xs font-semibold text-slate-300 uppercase tracking-wider">Kualitas Gambar</label>
          <span class="text-xs font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">{{ compressQuality }}%</span>
        </div>
        <input
          type="range"
          min="10"
          max="100"
          step="5"
          v-model.number="compressQuality"
          class="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
        />
        <div class="flex justify-between text-[10px] text-slate-500">
          <span>Kecil (Buram)</span>
          <span>Seimbang</span>
          <span>Besar (Tajam)</span>
        </div>
      </div>

      <!-- Render Scale -->
      <div class="space-y-3">
        <div class="flex justify-between">
          <label class="text-xs font-semibold text-slate-300 uppercase tracking-wider">Resolusi Render</label>
          <span class="text-xs font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">{{ pdfRenderScale }}x</span>
        </div>
        <input
          type="range"
          min="1"
          max="3"
          step="0.5"
          v-model.number="pdfRenderScale"
          class="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
        />
        <div class="flex justify-between text-[10px] text-slate-500">
          <span>1x (Cepat)</span>
          <span>2x (Default)</span>
          <span>3x (HD)</span>
        </div>
      </div>

      <!-- Compress Button -->
      <button
        type="button"
        :disabled="!pdfFile || isCompressing"
        @click="compressPdf"
        :class="[
          'w-full py-3 px-6 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg',
          pdfFile && !isCompressing
            ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer shadow-brand-500/15 hover:shadow-brand-500/25 hover:scale-[1.01] active:scale-[0.99]'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed',
        ]"
      >
        <svg v-if="isCompressing" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
        {{ isCompressing ? 'Mengompresi...' : 'Proses Kompresi PDF' }}
      </button>
    </div>

    <!-- Right Panel (7 cols) -->
    <div
      class="md:col-span-7 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-6 backdrop-blur-sm h-full transition-all duration-300 hover:border-slate-700/60 hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)]"
    >
      <!-- Result Area -->
      <div
        :class="[
          'relative flex-grow min-h-[300px] rounded-xl border border-slate-800 overflow-hidden bg-slate-950',
          compressedPdfUrl ? 'p-3' : 'flex items-center justify-center',
        ]"
      >
        <!-- No PDF -->
        <div v-if="!pdfFile" class="flex flex-col items-center justify-center text-center p-6 space-y-4">
          <div class="w-16 h-16 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center shadow-inner">
            <svg class="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div class="space-y-1">
            <p class="text-sm font-semibold text-slate-300">Belum Ada Dokumen</p>
            <p class="text-xs text-slate-500 max-w-xs">Unggah file PDF di panel kiri untuk memulai kompresi.</p>
          </div>
        </div>

        <!-- Compressing Spinner -->
        <div v-else-if="isCompressing" class="flex flex-col items-center justify-center space-y-4 p-6">
          <div class="w-12 h-12 rounded-full border-4 border-slate-800 border-t-brand-500 animate-spin"></div>
          <div class="text-center space-y-1">
            <p class="text-xs font-semibold text-slate-300">Mengompresi {{ currentProcessingPage }} dari {{ pdfPageCount }} halaman...</p>
            <p class="text-[10px] text-slate-500">Setiap halaman dirender ke gambar lalu disusun ulang.</p>
          </div>
        </div>

        <!-- Waiting for action -->
        <div v-else-if="pdfFile && !compressedPdfUrl" class="flex flex-col items-center justify-center text-center p-6 space-y-4">
          <div class="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
            <svg class="w-8 h-8 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div class="space-y-1">
            <p class="text-sm font-semibold text-slate-300">{{ pdfName }}</p>
            <p class="text-xs text-slate-500">{{ pdfPageCount }} halaman • {{ formatSize(originalPdfSize) }}</p>
            <p class="text-[10px] text-slate-400 mt-2">Atur kualitas di panel kiri, lalu tekan "Proses Kompresi PDF".</p>
          </div>
        </div>

        <!-- Compression Done -->
        <div v-else-if="compressedPdfUrl" class="w-full flex-grow flex flex-col gap-3">
          <div class="flex-grow overflow-y-auto max-h-[380px] p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-3 custom-scrollbar">
            <div
              v-for="(url, idx) in compressPreviewUrls"
              :key="idx"
              class="relative bg-slate-900/40 border border-slate-800/60 shadow rounded-lg overflow-hidden p-0.5"
            >
              <img :src="url" class="w-full h-auto object-contain rounded" :alt="'Halaman ' + (idx + 1)" />
              <span class="absolute bottom-2 right-2 px-1.5 py-0.5 bg-slate-950/85 text-[9px] text-slate-400 font-bold rounded">
                Halaman {{ idx + 1 }}
              </span>
            </div>
          </div>
          <p v-if="pdfPageCount > 5" class="text-[10px] text-center text-slate-500">
            * Hanya menampilkan preview 5 halaman pertama.
          </p>
        </div>
      </div>

      <!-- Size Comparison -->
      <div
        v-if="pdfFile"
        class="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs"
      >
        <div class="flex items-center gap-4">
          <div>
            <span class="text-slate-500 font-medium uppercase tracking-wider text-[9px]">Ukuran Asli</span>
            <p class="font-bold text-slate-300 font-mono mt-0.5">{{ formatSize(originalPdfSize) }}</p>
          </div>
          <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <div>
            <span class="text-slate-500 font-medium uppercase tracking-wider text-[9px]">Hasil Kompresi</span>
            <p class="font-bold font-mono mt-0.5" :class="compressedPdfUrl ? 'text-brand-400' : 'text-slate-500 animate-pulse'">
              {{ compressedPdfUrl ? formatSize(compressedPdfSize) : 'Menunggu...' }}
            </p>
          </div>
        </div>
        <div v-if="compressedPdfUrl && compressedPdfSize" class="text-right">
          <span class="text-slate-500 font-medium uppercase tracking-wider text-[9px]">Penghematan</span>
          <p class="font-black font-mono text-xs mt-0.5" :class="spaceSavings > 0 ? 'text-emerald-400' : 'text-amber-400'">
            {{ spaceSavings > 0 ? `-${spaceSavings}%` : '0%' }}
          </p>
        </div>
      </div>

      <!-- Action Buttons Group -->
      <div class="flex flex-col sm:flex-row gap-3 w-full">
        <button
          v-if="pdfFile"
          type="button"
          @click="resetPdfCompressor()"
          class="w-full sm:w-auto px-4 py-3 border border-slate-800 hover:border-slate-700 hover:text-slate-200 bg-slate-950/45 text-slate-400 hover:bg-slate-900/10 rounded-xl font-bold text-sm transition-all flex items-center gap-2 justify-center cursor-pointer active:scale-95 flex-shrink-0"
        >
          Reset
        </button>

        <button
          type="button"
          :disabled="!compressedPdfUrl"
          @click="downloadCompressedPdf"
          :class="[
            'w-full sm:flex-grow py-3 px-6 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg',
            compressedPdfUrl
              ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer shadow-brand-500/15 hover:shadow-brand-500/25 hover:scale-[1.01] active:scale-[0.99]'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed',
          ]"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Unduh PDF Hasil Kompresi
          <span v-if="compressedPdfSize" class="text-[10px] opacity-70">({{ formatSize(compressedPdfSize) }})</span>
        </button>
      </div>

      <!-- Disclaimer -->
      <div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
        <div class="flex items-start gap-2">
          <svg class="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p class="text-xs font-bold text-amber-200">Disklaimer Cara Kerja & Keterbatasan</p>
            <p class="text-[11px] text-amber-200/70 leading-relaxed mt-1">
              Aplikasi ini menggunakan metode
              <b class="text-amber-200">Client-Side Rasterization</b> (PDF → Gambar → PDF) yang diproses 100% lokal di browsermu. Teks di dalam PDF hasil kompresi akan diubah menjadi format gambar, sehingga
              <b class="text-amber-200">tidak bisa disalin (copy-paste)</b>. Sangat cocok untuk berkas lamaran kerja, scan ijazah, KTP, atau dokumen administrasi singkat lainnya.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
