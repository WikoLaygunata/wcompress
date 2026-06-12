<script setup>
import { ref, onUnmounted, inject, computed, watch } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { jsPDF } from 'jspdf'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

const showToast = inject('showToast')

// ─── IMAGE TO PDF STATE ───
const images = ref([])
const isConverting = ref(false)
const currentProcessingItem = ref(0)
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

const totalImagesSize = computed(() => {
  return images.value.reduce((sum, img) => sum + img.size, 0)
})

const imagesToPdfSavings = computed(() => {
  if (!totalImagesSize.value || !convertedPdfSize.value) return 0
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
  { deep: true },
)

const convertPreviewUrls = ref([])

const generateConvertPreview = async (blob) => {
  // Use existing image URLs for preview instead of rendering PDF again
  convertPreviewUrls.value = images.value.slice(0, 5).map(img => img.url)
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
  images.value = [...images.value]
}

const convertToPdf = async () => {
  if (images.value.length === 0 || isConverting.value) return

  isConverting.value = true
  currentProcessingItem.value = 0
  showToast('Mengonversi', 'Menyusun gambar menjadi PDF...', 'info')

  try {
    let doc = null
    const targetWidth = 210 // Uniform width in mm (A4 width)

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    for (let i = 0; i < images.value.length; i++) {
      currentProcessingItem.value = i + 1
      const imgUrl = images.value[i].url

      const img = await new Promise((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = reject
        el.src = imgUrl
      })

      const targetHeight = targetWidth * (img.naturalHeight / img.naturalWidth)
      const isLandscape = targetWidth > targetHeight
      const orientation = isLandscape ? 'landscape' : 'portrait'

      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      // Fill white background to prevent black backgrounds for transparent images
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      const dataUrl = canvas.toDataURL('image/jpeg', Math.min(imgToPdfQuality.value / 100, 0.99))

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

      // Yield to main thread to prevent UI freezing
      await new Promise(resolve => setTimeout(resolve, 15))
    }

    canvas.width = 0
    canvas.height = 0

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
  currentProcessingItem.value = 0
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
  if (convertedPdfUrl.value) URL.revokeObjectURL(convertedPdfUrl.value)
  images.value.forEach((img) => URL.revokeObjectURL(img.url))
  images.value = []
  convertedPdfBlob.value = null
  convertPreviewUrls.value = []
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
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div class="space-y-0.5">
              <p class="text-xs text-slate-300 font-medium">
                Drag & drop gambar atau
                <span class="text-brand-400 group-hover:underline">telusuri</span>
              </p>
              <p class="text-[10px] text-slate-500">
                Pilih banyak gambar sekaligus (JPEG, PNG, WEBP)
              </p>
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

      <!-- Convert Action Buttons Group -->
      <div class="flex flex-col sm:flex-row gap-3 w-full">
        <button
          v-if="images.length > 0"
          type="button"
          @click="resetImages"
          class="w-full sm:w-auto px-4 py-3 border border-slate-800 hover:border-slate-700 hover:text-slate-200 bg-slate-950/45 text-slate-400 hover:bg-slate-900/10 rounded-xl font-bold text-sm transition-all flex items-center gap-2 justify-center cursor-pointer active:scale-95 flex-shrink-0"
        >
          Hapus Semua
        </button>

        <button
          type="button"
          :disabled="images.length === 0 || isConverting"
          @click="convertToPdf"
          :class="[
            'w-full sm:flex-grow py-3 px-6 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg',
            images.length > 0 && !isConverting
              ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer shadow-brand-500/15 hover:shadow-brand-500/25 hover:scale-[1.01] active:scale-[0.99]'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed',
          ]"
        >
          <svg v-if="isConverting" class="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <svg v-else class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {{ isConverting ? `Mengonversi ${currentProcessingItem} dari ${images.length}...` : 'Konversi ke PDF' }}
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
        <span
          v-if="images.length > 0 && !convertedPdfUrl"
          class="text-[10px] px-2 py-0.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded font-medium"
        >
          {{ images.length }} gambar
        </span>
        <span
          v-else-if="convertedPdfUrl"
          class="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-medium"
        >
          Selesai Dikonversi
        </span>
      </div>

      <!-- Empty State (No Images) -->
      <div
        v-if="images.length === 0"
        class="flex-grow min-h-[300px] rounded-xl border border-slate-800 bg-slate-950 flex flex-col items-center justify-center text-center p-6 space-y-4"
      >
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
        <div class="flex-grow overflow-y-auto max-h-[380px] p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-3 custom-scrollbar">
          <div
            v-for="(url, idx) in convertPreviewUrls"
            :key="idx"
            class="relative bg-slate-900/40 border border-slate-800/60 shadow rounded-lg overflow-hidden p-0.5"
          >
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
      <div v-else class="flex-grow overflow-y-auto max-h-[500px] pr-1 space-y-2 custom-scrollbar">
        <div
          v-for="(img, idx) in images"
          :key="img.id"
          class="flex items-center gap-3 p-2.5 bg-slate-950/60 border border-slate-800/60 rounded-xl group hover:border-slate-700/60 transition-all"
        >
          <span class="text-[10px] font-bold text-slate-500 font-mono w-5 text-center flex-shrink-0">{{ idx + 1 }}</span>

          <div class="w-12 h-12 rounded-lg overflow-hidden border border-slate-800 bg-slate-900 flex-shrink-0">
            <img :src="img.url" class="w-full h-full object-cover" :alt="img.name" />
          </div>

          <div class="flex-grow min-w-0">
            <p class="text-[11px] font-semibold text-slate-300 truncate">{{ img.name }}</p>
            <p class="text-[10px] text-slate-500 font-mono">{{ formatSize(img.size) }}</p>
          </div>

          <div class="flex items-center gap-1 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              @click="moveImage(idx, -1)"
              :disabled="idx === 0"
              class="w-9 h-9 p-2 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Pindah ke atas"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              type="button"
              @click="moveImage(idx, 1)"
              :disabled="idx === images.length - 1"
              class="w-9 h-9 p-2 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Pindah ke bawah"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              type="button"
              @click="removeImage(img.id)"
              class="w-9 h-9 p-2 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer ml-1"
              title="Hapus gambar"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <p class="font-bold font-mono mt-0.5 text-brand-400">{{ formatSize(convertedPdfSize) }}</p>
          </div>
        </div>
        <div v-if="imagesToPdfSavings > 0" class="text-right">
          <span class="text-slate-500 font-medium uppercase tracking-wider text-[9px]">Penghematan</span>
          <p class="font-black font-mono text-xs mt-0.5 text-emerald-400">-{{ imagesToPdfSavings }}%</p>
        </div>
      </div>

      <!-- Info Box (Before conversion) -->
      <div v-if="!convertedPdfUrl" class="text-xs text-slate-500 bg-slate-950/40 p-3 rounded-lg border border-slate-800/40 flex items-start gap-2">
        <svg class="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          Setiap halaman PDF akan disesuaikan secara otomatis dengan lebar seragam (A4 - 210mm)
          agar sejajar, sementara tinggi masing-masing halaman beradaptasi dengan rasio aspek
          gambar aslinya tanpa ada pemotongan.
        </span>
      </div>

      <!-- Action Buttons Group (when PDF is generated) -->
      <div v-if="convertedPdfUrl" class="flex flex-col sm:flex-row gap-3 w-full">
        <div class="flex gap-2 w-full sm:w-auto">
          <button
            type="button"
            @click="backToImageEditing"
            class="flex-grow sm:flex-grow-0 px-4 py-3 border border-slate-800 hover:border-slate-700 hover:text-slate-200 bg-slate-950/45 text-slate-400 hover:bg-slate-900/10 rounded-xl font-bold text-sm transition-all flex items-center gap-2 justify-center cursor-pointer active:scale-95 flex-shrink-0"
          >
            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Edit Kembali
          </button>

          <button
            type="button"
            @click="resetImages"
            class="flex-grow sm:flex-grow-0 px-4 py-3 border border-slate-800 hover:border-slate-700 hover:text-slate-200 bg-slate-950/45 text-slate-400 hover:bg-slate-900/10 rounded-xl font-bold text-sm transition-all flex items-center gap-2 justify-center cursor-pointer active:scale-95 flex-shrink-0"
          >
            Reset
          </button>
        </div>

        <button
          type="button"
          @click="downloadConvertedPdf"
          class="w-full sm:flex-grow py-3 px-6 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg bg-brand-600 hover:bg-brand-500 text-white cursor-pointer shadow-brand-500/15 hover:shadow-brand-500/25 hover:scale-[1.01] active:scale-[0.99]"
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
</template>
