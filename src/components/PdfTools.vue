<script setup>
import { ref, onUnmounted, inject, computed, watch } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { jsPDF } from 'jspdf'

// Configure PDF.js worker locally (offline-ready, no CDN)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

const showToast = inject('showToast')

// ─── Sub-Tab Navigation ───
const activeSubTab = ref('compress') // 'compress' | 'img2pdf'

// ─── PDF COMPRESSOR STATE ───
const pdfFile = ref(null)
const pdfName = ref('')
const pdfPageCount = ref(0)
const compressQuality = ref(75)
const isCompressing = ref(false)
const originalPdfSize = ref(0)
const compressedPdfBlob = ref(null)
const compressedPdfUrl = ref('')
const compressedPdfSize = ref(0)
const pdfRenderScale = ref(2.0)
const pdfFileInput = ref(null)

// ─── IMAGE TO PDF STATE ───
const images = ref([])
const isConverting = ref(false)
const imgToPdfQuality = ref(90)
const imgFileInput = ref(null)
const convertedPdfBlob = ref(null)
const convertedPdfUrl = ref('')
const convertedPdfSize = ref(0)

let imageIdCounter = 0

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

const totalImagesSize = computed(() => {
  return images.value.reduce((sum, img) => sum + img.size, 0)
})

const imagesToPdfSavings = computed(() => {
  if (!totalImagesSize.value || !convertedPdfSize.value) return 0
  const savings = (1 - convertedPdfSize.value / totalImagesSize.value) * 105
  // Cap at 100% or standard range
  const actualSavings = (1 - convertedPdfSize.value / totalImagesSize.value) * 100
  return actualSavings > 0 ? Math.round(actualSavings) : 0
})

// Clear generated PDF preview if images list or quality changes
watch(
  [images, imgToPdfQuality],
  () => {
    if (convertedPdfUrl.value) {
      URL.revokeObjectURL(convertedPdfUrl.value)
      convertedPdfUrl.value = ''
      convertedPdfBlob.value = null
      convertedPdfSize.value = 0
    }
  },
  { deep: true }
)

const compressPreviewUrls = ref([])
const convertPreviewUrls = ref([])

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
    for (let i = 1; i <= previewCount; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 1.0 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      await page.render({ canvasContext: ctx, viewport }).promise
      urls.push(canvas.toDataURL('image/jpeg', 0.8))
      canvas.width = 0
      canvas.height = 0
    }
    compressPreviewUrls.value = urls
    loadingTask.destroy()
  } catch (err) {
    console.error('Failed to generate compress preview:', err)
  }
}

const generateConvertPreview = async (blob) => {
  convertPreviewUrls.value = []
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    const totalPages = pdf.numPages
    const urls = []
    
    // Preview up to 5 pages
    const previewCount = Math.min(totalPages, 5)
    for (let i = 1; i <= previewCount; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 1.0 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      await page.render({ canvasContext: ctx, viewport }).promise
      urls.push(canvas.toDataURL('image/jpeg', 0.8))
      canvas.width = 0
      canvas.height = 0
    }
    convertPreviewUrls.value = urls
    loadingTask.destroy()
  } catch (err) {
    console.error('Failed to generate convert preview:', err)
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

  try {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    pdfPageCount.value = pdf.numPages

    if (pdf.numPages > 20) {
      showToast(
        'Dokumen Besar Terdeteksi',
        `File ini memiliki ${pdf.numPages} halaman. Proses mungkin lambat dan memakan banyak RAM. Risiko ditanggung pengguna.`,
        'warning'
      )
    }

    showToast('PDF Dimuat', `${file.name} — ${pdf.numPages} halaman siap dikompres.`)
    loadingTask.destroy() // Bebaskan memori WASM PDF.js segera setelah baca metadata
  } catch (err) {
    console.error('Failed to read PDF:', err)
    showToast('Gagal Membaca PDF', 'File PDF rusak atau tidak didukung.', 'error')
    resetPdfCompressor(false)
  }
}

const compressPdf = async () => {
  if (!pdfFile.value || isCompressing.value) return

  isCompressing.value = true
  showToast('Memproses PDF', 'Mengompresi halaman demi halaman di browsermu...', 'info')

  try {
    const arrayBuffer = await pdfFile.value.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    const totalPages = pdf.numPages

    let doc = null

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: pdfRenderScale.value })

      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')

      await page.render({ canvasContext: ctx, viewport }).promise

      const imgData = canvas.toDataURL('image/jpeg', compressQuality.value / 100)

      // Auto-detect orientation per page
      const isLandscape = viewport.width > viewport.height
      const orientation = isLandscape ? 'landscape' : 'portrait'
      const pageWidth = viewport.width
      const pageHeight = viewport.height

      if (i === 1) {
        doc = new jsPDF({
          orientation,
          unit: 'px',
          format: [pageWidth, pageHeight],
          compress: true,
        })
      } else {
        doc.addPage([pageWidth, pageHeight], orientation)
      }

      doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight)

      // Cleanup canvas memory
      canvas.width = 0
      canvas.height = 0
    }

    loadingTask.destroy() // Bebaskan memori WASM PDF.js setelah semua halaman di-render

    const blob = doc.output('blob')

    if (compressedPdfUrl.value) {
      URL.revokeObjectURL(compressedPdfUrl.value)
    }

    compressedPdfBlob.value = blob
    compressedPdfUrl.value = URL.createObjectURL(blob)
    compressedPdfSize.value = blob.size

    await generateCompressPreview(blob)

    showToast('Kompresi Selesai!', `Ukuran berhasil diperkecil dari ${formatSize(originalPdfSize.value)} ke ${formatSize(blob.size)}.`)
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

// ─── IMAGE TO PDF LOGIC ───
const triggerImgInput = () => imgFileInput.value?.click()

const handleImagesUpload = (e) => {
  const files = e.target.files || e.dataTransfer?.files
  if (!files || files.length === 0) return

  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    images.value.push({
      id: ++imageIdCounter,
      file,
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file),
    })
  }

  showToast('Gambar Ditambahkan', `${files.length} gambar berhasil diunggah.`)
  // Reset file input so same files can be re-added
  if (imgFileInput.value) imgFileInput.value.value = ''
}

const removeImage = (id) => {
  const idx = images.value.findIndex((img) => img.id === id)
  if (idx !== -1) {
    URL.revokeObjectURL(images.value[idx].url)
    images.value.splice(idx, 1)
  }
}

const moveImage = (fromIdx, direction) => {
  const toIdx = fromIdx + direction
  if (toIdx < 0 || toIdx >= images.value.length) return
  const temp = images.value[fromIdx]
  images.value[fromIdx] = images.value[toIdx]
  images.value[toIdx] = temp
  // Force reactivity
  images.value = [...images.value]
}

const convertToPdf = async () => {
  if (images.value.length === 0 || isConverting.value) return

  isConverting.value = true
  showToast('Mengonversi', 'Menyusun gambar menjadi PDF...', 'info')

  try {
    let doc = null
    const targetWidth = 210 // Uniform width in mm (A4 width)

    for (let i = 0; i < images.value.length; i++) {
      const imgUrl = images.value[i].url

      // Load image to get natural dimensions
      const img = await new Promise((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = reject
        el.src = imgUrl
      })

      // Calculate proportional height based on the uniform width
      const targetHeight = targetWidth * (img.naturalHeight / img.naturalWidth)
      const isLandscape = targetWidth > targetHeight
      const orientation = isLandscape ? 'landscape' : 'portrait'

      // Draw to temporary canvas for quality compression
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const dataUrl = canvas.toDataURL('image/jpeg', imgToPdfQuality.value / 100)

      if (i === 0) {
        doc = new jsPDF({
          orientation,
          unit: 'mm',
          format: [targetWidth, targetHeight],
          compress: true,
        })
      } else {
        doc.addPage([targetWidth, targetHeight], orientation)
      }

      doc.addImage(dataUrl, 'JPEG', 0, 0, targetWidth, targetHeight)

      // Cleanup canvas
      canvas.width = 0
      canvas.height = 0
    }

    const blob = doc.output('blob')

    if (convertedPdfUrl.value) {
      URL.revokeObjectURL(convertedPdfUrl.value)
    }

    convertedPdfBlob.value = blob
    convertedPdfUrl.value = URL.createObjectURL(blob)
    convertedPdfSize.value = blob.size

    await generateConvertPreview(blob)

    showToast('Konversi Selesai!', `${images.value.length} gambar berhasil digabung menjadi PDF.`)
  } catch (err) {
    console.error('Image to PDF error:', err)
    showToast('Gagal Konversi', 'Terjadi kesalahan saat membuat PDF.', 'error')
  } finally {
    isConverting.value = false
  }
}

const downloadConvertedPdf = () => {
  if (!convertedPdfUrl.value) return
  const a = document.createElement('a')
  a.href = convertedPdfUrl.value
  a.download = `wcompress_images_${Date.now()}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  showToast('Unduhan Dimulai', 'File PDF hasil konversi berhasil disimpan.')
}

const resetImages = () => {
  images.value.forEach((img) => URL.revokeObjectURL(img.url))
  images.value = []
  if (convertedPdfUrl.value) {
    URL.revokeObjectURL(convertedPdfUrl.value)
    convertedPdfUrl.value = ''
  }
  convertedPdfBlob.value = null
  convertedPdfSize.value = 0
  convertPreviewUrls.value = []
  if (imgFileInput.value) imgFileInput.value.value = ''
  showToast('Reset', 'Semua gambar telah dihapus.')
}

const backToImageEditing = () => {
  if (convertedPdfUrl.value) {
    URL.revokeObjectURL(convertedPdfUrl.value)
    convertedPdfUrl.value = ''
  }
  convertedPdfBlob.value = null
  convertedPdfSize.value = 0
  convertPreviewUrls.value = []
  showToast('Edit Kembali', 'Silakan atur kembali daftar dan urutan gambar.')
}

// ─── MEMORY CLEANUP ───
onUnmounted(() => {
  if (compressedPdfUrl.value) URL.revokeObjectURL(compressedPdfUrl.value)
  if (convertedPdfUrl.value) URL.revokeObjectURL(convertedPdfUrl.value)
  images.value.forEach((img) => URL.revokeObjectURL(img.url))
  images.value = []
  compressedPdfBlob.value = null
  convertedPdfBlob.value = null
  compressPreviewUrls.value = []
  convertPreviewUrls.value = []
})
</script>

<template>
  <div id="panel-pdftools" class="max-w-5xl mx-auto w-full space-y-6">
    <!-- Sub-Tab Navigation -->
    <div class="flex p-1 bg-slate-900/60 border border-slate-800/80 rounded-xl max-w-sm mx-auto w-full">
      <button
        type="button"
        @click="activeSubTab = 'compress'"
        :class="[
          'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer',
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
          'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer',
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
    </div>

    <!-- ═══════════════════════════════ -->
    <!-- SUB-TAB 1: KOMPRES PDF         -->
    <!-- ═══════════════════════════════ -->
    <div v-if="activeSubTab === 'compress'" class="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
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
                <svg class="w-5 h-5 text-slate-400 group-hover:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
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
            compressedPdfUrl ? 'p-3' : 'flex items-center justify-center'
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
              <p class="text-xs text-slate-500 max-w-xs">
                Unggah file PDF di panel kiri untuk memulai kompresi.
              </p>
            </div>
          </div>

          <!-- Compressing Spinner -->
          <div v-else-if="isCompressing" class="flex flex-col items-center justify-center space-y-4 p-6">
            <div class="w-12 h-12 rounded-full border-4 border-slate-800 border-t-brand-500 animate-spin"></div>
            <div class="text-center space-y-1">
              <p class="text-xs font-semibold text-slate-300">Mengompresi {{ pdfPageCount }} halaman...</p>
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
            <div class="flex-grow overflow-y-auto max-h-[380px] p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-3">
              <div v-for="(url, idx) in compressPreviewUrls" :key="idx" class="relative bg-slate-900/40 border border-slate-800/60 shadow rounded-lg overflow-hidden p-0.5">
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
        <div v-if="pdfFile" class="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs">
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
        <div class="flex gap-4 w-full">
          <button
            v-if="pdfFile"
            type="button"
            @click="resetPdfCompressor()"
            class="px-4 py-3 border border-slate-800 hover:border-slate-700 hover:text-slate-200 bg-slate-950/45 text-slate-400 hover:bg-slate-900/10 rounded-xl font-bold text-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95 flex-shrink-0"
          >
            Reset
          </button>
          
          <button
            type="button"
            :disabled="!compressedPdfUrl"
            @click="downloadCompressedPdf"
            :class="[
              'flex-grow py-3 px-6 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg',
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
                Aplikasi ini menggunakan metode <b class="text-amber-200">Client-Side Rasterization</b> (PDF → Gambar → PDF) yang diproses 100% lokal di browsermu. Teks di dalam PDF hasil kompresi akan diubah menjadi format gambar, sehingga <b class="text-amber-200">tidak bisa disalin (copy-paste)</b>. Sangat cocok untuk berkas lamaran kerja, scan ijazah, KTP, atau dokumen administrasi singkat lainnya.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════ -->
    <!-- SUB-TAB 2: GAMBAR KE PDF       -->
    <!-- ═══════════════════════════════ -->
    <div v-if="activeSubTab === 'img2pdf'" class="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
      <!-- Left Panel (5 cols) -->
      <div
        class="md:col-span-5 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-6 backdrop-blur-sm transition-all duration-300 hover:border-slate-700/60 hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)]"
      >
        <div class="flex items-center justify-between pb-4 border-b border-slate-800">
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <span class="w-1.5 h-4 bg-brand-500 rounded"></span>
            Gambar ke PDF
          </h3>
          <button
            v-if="images.length > 0"
            @click="resetImages"
            class="text-xs font-semibold text-rose-400 hover:text-rose-300 transition cursor-pointer"
          >
            Hapus Semua
          </button>
        </div>

        <!-- Image Upload Dropzone -->
        <div class="space-y-2">
          <label class="text-xs font-semibold text-slate-300 uppercase tracking-wider">Unggah Gambar</label>
          <div
            @click="triggerImgInput"
            @dragover.prevent
            @drop.prevent="handleImagesUpload"
            class="border-2 border-dashed border-slate-800 hover:border-brand-500/50 bg-slate-950/20 hover:bg-slate-900/10 transition-all rounded-xl p-6 text-center cursor-pointer group relative"
          >
            <input
              type="file"
              ref="imgFileInput"
              @change="handleImagesUpload"
              class="hidden"
              accept="image/*"
              multiple
            />
            <div class="space-y-2 pointer-events-none py-2">
              <div
                class="mx-auto w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:scale-110 group-hover:border-brand-500 transition-all"
              >
                <svg class="w-5 h-5 text-slate-400 group-hover:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div class="space-y-0.5">
                <p class="text-xs text-slate-300 font-medium">
                  Drag & drop gambar atau
                  <span class="text-brand-400 group-hover:underline">telusuri</span>
                </p>
                <p class="text-[10px] text-slate-500">Pilih banyak gambar sekaligus (JPEG, PNG, WEBP)</p>
              </div>
            </div>
          </div>
        </div>


        <!-- Quality Slider -->
        <div class="space-y-3">
          <div class="flex justify-between">
            <label class="text-xs font-semibold text-slate-300 uppercase tracking-wider">Kualitas Kompresi</label>
            <span class="text-xs font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">{{ imgToPdfQuality }}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            v-model.number="imgToPdfQuality"
            class="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
          />
          <div class="flex justify-between text-[10px] text-slate-500">
            <span>Kecil (Buram)</span>
            <span>Seimbang</span>
            <span>Besar (Tajam)</span>
          </div>
        </div>

        <!-- Image Count Badge -->
        <div v-if="images.length > 0" class="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between">
          <span class="text-xs text-slate-400">Total gambar yang akan digabung:</span>
          <span class="text-xs font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded font-mono">{{ images.length }}</span>
        </div>

        <!-- Convert Button -->
        <!-- Convert Action Buttons Group -->
        <div class="flex gap-4 w-full">
          <button
            v-if="images.length > 0"
            type="button"
            @click="resetImages"
            class="px-4 py-3 border border-slate-800 hover:border-slate-700 hover:text-slate-200 bg-slate-950/45 text-slate-400 hover:bg-slate-900/10 rounded-xl font-bold text-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95 flex-shrink-0"
          >
            Hapus Semua
          </button>
          
          <button
            type="button"
            :disabled="images.length === 0 || isConverting"
            @click="convertToPdf"
            :class="[
              'flex-grow py-3 px-6 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg',
              images.length > 0 && !isConverting
                ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer shadow-brand-500/15 hover:shadow-brand-500/25 hover:scale-[1.01] active:scale-[0.99]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed',
            ]"
          >
            <svg v-if="isConverting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {{ isConverting ? 'Mengonversi...' : 'Konversi ke PDF' }}
          </button>
        </div>
      </div>

      <!-- Right Panel (7 cols) - Image Preview Grid or PDF Preview -->
      <div
        class="md:col-span-7 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-6 backdrop-blur-sm h-full transition-all duration-300 hover:border-slate-700/60 hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)]"
      >
        <div class="flex items-center justify-between pb-4 border-b border-slate-800">
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <span class="w-1.5 h-4 bg-brand-500 rounded"></span>
            {{ convertedPdfUrl ? 'Hasil Berkas PDF' : 'Preview & Urutan Gambar' }}
          </h3>
          <span v-if="images.length > 0 && !convertedPdfUrl" class="text-[10px] px-2 py-0.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded font-medium">
            {{ images.length }} gambar
          </span>
          <span v-else-if="convertedPdfUrl" class="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-medium">
            Selesai Dikonversi
          </span>
        </div>

        <!-- Empty State (No Images) -->
        <div v-if="images.length === 0" class="flex-grow min-h-[300px] rounded-xl border border-slate-800 bg-slate-950 flex flex-col items-center justify-center text-center p-6 space-y-4">
          <div class="w-16 h-16 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center shadow-inner">
            <svg class="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="space-y-1">
            <p class="text-sm font-semibold text-slate-300">Belum Ada Gambar</p>
            <p class="text-xs text-slate-500 max-w-xs">Unggah gambar di panel kiri untuk melihat preview dan mengatur urutan halaman PDF.</p>
          </div>
        </div>

        <!-- PDF Success State (When conversion is done) -->
        <div v-else-if="convertedPdfUrl" class="w-full flex-grow flex flex-col gap-3">
          <div class="flex-grow overflow-y-auto max-h-[380px] p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-3">
            <div v-for="(url, idx) in convertPreviewUrls" :key="idx" class="relative bg-slate-900/40 border border-slate-800/60 shadow rounded-lg overflow-hidden p-0.5">
              <img :src="url" class="w-full h-auto object-contain rounded" :alt="'Halaman ' + (idx + 1)" />
              <span class="absolute bottom-2 right-2 px-1.5 py-0.5 bg-slate-950/85 text-[9px] text-slate-400 font-bold rounded">
                Halaman {{ idx + 1 }}
              </span>
            </div>
          </div>
          <p v-if="images.length > 5" class="text-[10px] text-center text-slate-500">
            * Hanya menampilkan preview 5 halaman pertama.
          </p>
        </div>

        <!-- Image Grid (Before conversion) -->
        <div v-else class="flex-grow overflow-y-auto max-h-[500px] pr-1 space-y-2">
          <div
            v-for="(img, idx) in images"
            :key="img.id"
            class="flex items-center gap-3 p-2.5 bg-slate-950/60 border border-slate-800/60 rounded-xl group hover:border-slate-700/60 transition-all"
          >
            <!-- Page Number -->
            <span class="text-[10px] font-bold text-slate-500 font-mono w-5 text-center flex-shrink-0">{{ idx + 1 }}</span>

            <!-- Thumbnail -->
            <div class="w-12 h-12 rounded-lg overflow-hidden border border-slate-800 bg-slate-900 flex-shrink-0">
              <img :src="img.url" class="w-full h-full object-cover" :alt="img.name" />
            </div>

            <!-- Info -->
            <div class="flex-grow min-w-0">
              <p class="text-[11px] font-semibold text-slate-300 truncate">{{ img.name }}</p>
              <p class="text-[10px] text-slate-500 font-mono">{{ formatSize(img.size) }}</p>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                @click="moveImage(idx, -1)"
                :disabled="idx === 0"
                class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                title="Pindah ke atas"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                @click="moveImage(idx, 1)"
                :disabled="idx === images.length - 1"
                class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                title="Pindah ke bawah"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                type="button"
                @click="removeImage(img.id)"
                class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer ml-1"
                title="Hapus gambar"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Size Comparison (when PDF is generated) -->
        <div v-if="convertedPdfUrl" class="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs">
          <div class="flex items-center gap-4">
            <div>
              <span class="text-slate-500 font-medium uppercase tracking-wider text-[9px]">Total Gambar</span>
              <p class="font-bold text-slate-300 font-mono mt-0.5">{{ formatSize(totalImagesSize) }}</p>
            </div>
            <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <div>
              <span class="text-slate-500 font-medium uppercase tracking-wider text-[9px]">Hasil PDF</span>
              <p class="font-bold font-mono mt-0.5 text-brand-400">
                {{ formatSize(convertedPdfSize) }}
              </p>
            </div>
          </div>
          <div v-if="imagesToPdfSavings > 0" class="text-right">
            <span class="text-slate-500 font-medium uppercase tracking-wider text-[9px]">Penghematan</span>
            <p class="font-black font-mono text-xs mt-0.5 text-emerald-400">
              -{{ imagesToPdfSavings }}%
            </p>
          </div>
        </div>

        <!-- Info Box (Before conversion) -->
        <div v-if="!convertedPdfUrl" class="text-xs text-slate-500 bg-slate-950/40 p-3 rounded-lg border border-slate-800/40 flex items-start gap-2">
          <svg class="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Setiap halaman PDF akan disesuaikan secara otomatis dengan lebar seragam (A4 - 210mm) agar sejajar, sementara tinggi masing-masing halaman beradaptasi dengan rasio aspek gambar aslinya tanpa ada pemotongan.
          </span>
        </div>

        <!-- Action Buttons Group (when PDF is generated) -->
        <div v-if="convertedPdfUrl" class="flex gap-4 w-full">
          <button
            type="button"
            @click="backToImageEditing"
            class="px-4 py-3 border border-slate-800 hover:border-slate-700 hover:text-slate-200 bg-slate-950/45 text-slate-400 hover:bg-slate-900/10 rounded-xl font-bold text-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95 flex-shrink-0"
          >
            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Edit Kembali
          </button>

          <button
            type="button"
            @click="resetImages"
            class="px-4 py-3 border border-slate-800 hover:border-slate-700 hover:text-slate-200 bg-slate-950/45 text-slate-400 hover:bg-slate-900/10 rounded-xl font-bold text-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95 flex-shrink-0"
          >
            Reset
          </button>
          
          <button
            type="button"
            @click="downloadConvertedPdf"
            class="flex-grow py-3 px-6 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg bg-brand-600 hover:bg-brand-500 text-white cursor-pointer shadow-brand-500/15 hover:shadow-brand-500/25 hover:scale-[1.01] active:scale-[0.99]"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Unduh Berkas PDF
            <span class="text-[10px] opacity-70">({{ formatSize(convertedPdfSize) }})</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
