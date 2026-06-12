<script setup>
import { ref, onUnmounted, inject } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import JSZip from 'jszip'

// Configure PDF.js worker locally
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

const showToast = inject('showToast')

// ─── STATE ───
const pdfFile = ref(null)
const pdfName = ref('')
const pdfPageCount = ref(0)
const isProcessing = ref(false)
const currentProcessingPage = ref(0)
const extractedImages = ref([]) // { page: number, url: string, blob: Blob }
const pdfFileInput = ref(null)
const imageQuality = ref(90) // Render quality
const renderScale = ref(2.0)

// ─── HELPERS ───
const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

// ─── LOGIC ───
const triggerPdfInput = () => pdfFileInput.value?.click()

const handlePdfUpload = async (e) => {
  const files = e.target.files || e.dataTransfer?.files
  if (!files || files.length === 0) return

  const file = files[0]
  if (file.type !== 'application/pdf') {
    showToast('File Tidak Valid', 'Mohon unggah file PDF saja.', 'warning')
    return
  }

  resetDismantle(false)

  pdfFile.value = file
  pdfName.value = file.name
  currentProcessingPage.value = 0

  try {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    pdfPageCount.value = pdf.numPages

    if (pdf.numPages > 30) {
      showToast(
        'Dokumen Besar Terdeteksi',
        `File ini memiliki ${pdf.numPages} halaman. Proses ekstrak gambar mungkin lambat dan memakan banyak RAM.`,
        'warning',
      )
    }

    showToast('PDF Dimuat', `${file.name} — ${pdf.numPages} halaman siap diekstrak.`)
    loadingTask.destroy()
  } catch (err) {
    console.error('Failed to read PDF:', err)
    showToast('Gagal Membaca PDF', 'File PDF rusak atau tidak didukung.', 'error')
    resetDismantle(false)
  }
}

const dismantlePdf = async () => {
  if (!pdfFile.value || isProcessing.value) return

  isProcessing.value = true
  currentProcessingPage.value = 0
  showToast('Mengekstrak PDF', 'Merender setiap halaman menjadi gambar...', 'info')

  try {
    const arrayBuffer = await pdfFile.value.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    const totalPages = pdf.numPages

    const images = []

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    for (let i = 1; i <= totalPages; i++) {
      currentProcessingPage.value = i
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: renderScale.value })
      canvas.width = viewport.width
      canvas.height = viewport.height
      // Fill white background to prevent black backgrounds in JPEGs
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      await page.render({ canvasContext: ctx, viewport }).promise

      // Konversi canvas ke blob
      const safeQuality = Math.min(imageQuality.value / 100, 0.99)
      const blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', safeQuality)
      })

      const url = URL.createObjectURL(blob)
      images.push({ page: i, url, blob })

      // Beri jeda agar UI tidak macet
      await new Promise(resolve => setTimeout(resolve, 15))
    }

    canvas.width = 0
    canvas.height = 0

    loadingTask.destroy()
    extractedImages.value = images

    showToast('Ekstraksi Selesai!', `Berhasil mengekstrak ${totalPages} halaman menjadi gambar.`)
  } catch (err) {
    console.error('PDF dismantle error:', err)
    showToast('Gagal Mengekstrak', 'Terjadi kesalahan saat memecah PDF.', 'error')
  } finally {
    isProcessing.value = false
  }
}

const downloadImage = (img) => {
  const a = document.createElement('a')
  a.href = img.url
  a.download = `${pdfName.value.replace('.pdf', '')}_page_${img.page}.jpeg`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

const downloadAllImages = async () => {
  if (extractedImages.value.length === 0) return
  
  showToast('Membuat ZIP', 'Sedang mengompresi gambar ke dalam format ZIP...', 'info')
  
  try {
    const zip = new JSZip()
    const folderName = pdfName.value.replace('.pdf', '')
    const folder = zip.folder(folderName)
    
    for (const img of extractedImages.value) {
      folder.file(`${folderName}_page_${img.page}.jpeg`, img.blob)
    }
    
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const zipUrl = URL.createObjectURL(zipBlob)
    
    const a = document.createElement('a')
    a.href = zipUrl
    a.download = `${folderName}_images.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(zipUrl)
    
    showToast('Unduhan Selesai', 'File ZIP berhasil disimpan.')
  } catch (err) {
    console.error('ZIP generation error:', err)
    showToast('Gagal', 'Terjadi kesalahan saat membuat file ZIP.', 'error')
  }
}

const resetDismantle = (notify = true) => {
  pdfFile.value = null
  pdfName.value = ''
  pdfPageCount.value = 0
  isProcessing.value = false
  currentProcessingPage.value = 0

  extractedImages.value.forEach((img) => URL.revokeObjectURL(img.url))
  extractedImages.value = []

  if (pdfFileInput.value) pdfFileInput.value.value = ''
  if (notify) showToast('Reset', 'Dokumen PDF dan gambar hasil ekstrak telah dihapus.')
}

onUnmounted(() => {
  extractedImages.value.forEach((img) => URL.revokeObjectURL(img.url))
  extractedImages.value = []
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
          Pecah PDF ke Gambar
        </h3>
        <button
          v-if="pdfFile"
          @click="resetDismantle()"
          class="text-xs font-semibold text-rose-400 hover:text-rose-300 transition cursor-pointer"
        >
          Reset
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
      </div>

      <!-- Quality Slider -->
      <div class="space-y-3">
        <div class="flex justify-between">
          <label class="text-xs font-semibold text-slate-300 uppercase tracking-wider">Kualitas Ekstraksi (JPEG)</label>
          <span class="text-xs font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">{{ imageQuality }}%</span>
        </div>
        <input
          type="range"
          min="10"
          max="100"
          step="5"
          v-model.number="imageQuality"
          class="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
        />
      </div>

      <!-- Render Scale -->
      <div class="space-y-3">
        <div class="flex justify-between">
          <label class="text-xs font-semibold text-slate-300 uppercase tracking-wider">Resolusi Gambar</label>
          <span class="text-xs font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">{{ renderScale }}x</span>
        </div>
        <input
          type="range"
          min="1"
          max="3"
          step="0.5"
          v-model.number="renderScale"
          class="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
        />
        <div class="flex justify-between text-[10px] text-slate-500">
          <span>1x (Standar)</span>
          <span>2x (Tajam)</span>
          <span>3x (HD)</span>
        </div>
      </div>

      <!-- Extract Button -->
      <button
        type="button"
        :disabled="!pdfFile || isProcessing"
        @click="dismantlePdf"
        :class="[
          'w-full py-3 px-6 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg',
          pdfFile && !isProcessing
            ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer shadow-brand-500/15 hover:shadow-brand-500/25 hover:scale-[1.01] active:scale-[0.99]'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed',
        ]"
      >
        <svg v-if="isProcessing" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {{ isProcessing ? 'Mengekstrak PDF...' : 'Ekstrak Menjadi Gambar' }}
      </button>
    </div>

    <!-- Right Panel (7 cols) -->
    <div
      class="md:col-span-7 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-6 backdrop-blur-sm h-full transition-all duration-300 hover:border-slate-700/60 hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)]"
    >
      <div class="flex items-center justify-between pb-4 border-b border-slate-800">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <span class="w-1.5 h-4 bg-brand-500 rounded"></span>
          Hasil Ekstrak Gambar
        </h3>
        <span
          v-if="extractedImages.length > 0"
          class="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-medium"
        >
          {{ extractedImages.length }} Gambar
        </span>
      </div>

      <!-- Result Area -->
      <div
        :class="[
          'relative flex-grow min-h-[300px] rounded-xl border border-slate-800 overflow-hidden bg-slate-950',
          extractedImages.length > 0 ? 'p-3' : 'flex items-center justify-center',
        ]"
      >
        <!-- No Extracted Images yet -->
        <div v-if="!pdfFile && extractedImages.length === 0" class="flex flex-col items-center justify-center text-center p-6 space-y-4">
          <div class="w-16 h-16 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center shadow-inner">
            <svg class="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="space-y-1">
            <p class="text-sm font-semibold text-slate-300">Belum Ada Hasil</p>
            <p class="text-xs text-slate-500 max-w-xs">Unggah file PDF dan klik ekstrak untuk melihat hasilnya.</p>
          </div>
        </div>

        <!-- Processing Spinner -->
        <div v-else-if="isProcessing" class="flex flex-col items-center justify-center space-y-4 p-6">
          <div class="w-12 h-12 rounded-full border-4 border-slate-800 border-t-brand-500 animate-spin"></div>
          <div class="text-center space-y-1">
            <p class="text-xs font-semibold text-slate-300">Mengekstrak {{ currentProcessingPage }} dari {{ pdfPageCount }} halaman...</p>
            <p class="text-[10px] text-slate-500">Proses ini memakan memori CPU.</p>
          </div>
        </div>
        
        <!-- Waiting to extract -->
        <div v-else-if="pdfFile && extractedImages.length === 0" class="flex flex-col items-center justify-center text-center p-6 space-y-4">
          <div class="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
             <svg class="w-8 h-8 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="space-y-1">
            <p class="text-sm font-semibold text-slate-300">{{ pdfName }}</p>
            <p class="text-xs text-slate-500">{{ pdfPageCount }} halaman siap diekstrak</p>
          </div>
        </div>

        <!-- Extracted Grid -->
        <div v-else class="h-full overflow-y-auto max-h-[460px] custom-scrollbar pr-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div
            v-for="img in extractedImages"
            :key="img.page"
            class="relative bg-slate-900 border border-slate-800 rounded-lg overflow-hidden group flex flex-col h-48 sm:h-56"
          >
            <!-- Image Thumbnail -->
            <div class="w-full relative bg-slate-950/50 p-3 flex items-center justify-center flex-grow min-h-0">
              <img :src="img.url" class="max-w-full max-h-full object-contain rounded border border-slate-700/60 shadow-md" :alt="'Halaman ' + img.page" />
              
              <!-- Hover Overlay with Download button for this specific image -->
              <div class="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                 <button
                    @click="downloadImage(img)"
                    class="bg-brand-600 hover:bg-brand-500 text-white rounded-full p-2.5 shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-all cursor-pointer"
                    title="Unduh Halaman Ini"
                 >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                 </button>
              </div>
            </div>

            <!-- Meta / Info -->
            <div class="p-2 border-t border-slate-800 flex justify-between items-center bg-slate-900/80 mt-auto flex-shrink-0 z-10">
              <span class="text-[10px] font-bold text-slate-300">Hal {{ img.page }}</span>
              <span class="text-[9px] text-slate-500 font-mono">{{ formatSize(img.blob.size) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons Group -->
      <div v-if="extractedImages.length > 0" class="flex flex-col sm:flex-row gap-3 w-full mt-auto pt-2">
        <button
          type="button"
          @click="downloadAllImages"
          class="w-full py-3 px-6 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg bg-brand-600 hover:bg-brand-500 text-white cursor-pointer shadow-brand-500/15 hover:shadow-brand-500/25 active:scale-[0.99]"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Unduh Semua Gambar ({{ extractedImages.length }})
        </button>
      </div>

    </div>
  </div>
</template>
