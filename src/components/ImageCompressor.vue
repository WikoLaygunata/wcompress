<script setup>
import { ref, onMounted, onUnmounted, onActivated, onDeactivated, computed, watch, inject } from 'vue'
import imageCompression from 'browser-image-compression'
import mockImageUrl from '../assets/hahaha.jpg'

const showToast = inject('showToast')

const selectedFormat = ref('webp')
const quality = ref(80)
const resizeEnabled = ref(true)
const customWidth = ref(1920)
const preserveExif = ref(true)

const originalFile = ref(null)
const originalUrl = ref('')
const originalSize = ref(0)
const originalDim = ref('-')

const compressedUrl = ref('')
const compressedSize = ref(0)
const compressedDim = ref('-')

const isCompressing = ref(false)
const mockImageActive = ref(false)
const comparisonPosition = ref(50)
const isDragging = ref(false)
const comparisonContainer = ref(null)
const previewPanel = ref(null)

// Dropzone ref for compressor
const fileInput = ref(null)

const scrollToPreview = () => {
  if (window.innerWidth < 1024 && previewPanel.value) {
    const headerHeight = 80
    const elementPosition = previewPanel.value.getBoundingClientRect().top + window.scrollY
    const offsetPosition = elementPosition - headerHeight
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    })
  }
}

const triggerFileInput = () => {
  fileInput.value.click()
}

const formatSize = (bytes) => {
  if (bytes === 0) return '-'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const spaceSavings = computed(() => {
  if (!originalSize.value || !compressedSize.value) return 0
  const savings = (1 - compressedSize.value / originalSize.value) * 100
  return savings > 0 ? Math.round(savings) : 0
})

// Update selected format
const setFormat = (format) => {
  selectedFormat.value = format
  if (originalFile.value) {
    runCompression()
  }
}

// Update resize width preset
const setWidthPreset = (width) => {
  customWidth.value = width
  if (originalFile.value) {
    runCompression()
  }
}

// Handle File upload
const handleFileUpload = (e) => {
  const files = e.target.files || e.dataTransfer?.files
  if (!files || files.length === 0) return
  processFile(files[0])
}

const processFile = (file) => {
  if (!file.type.startsWith('image/')) {
    showToast('File tidak valid', 'Mohon unggah file gambar saja.', 'warning')
    return
  }
  originalFile.value = file
  mockImageActive.value = false

  if (originalUrl.value) URL.revokeObjectURL(originalUrl.value)
  originalUrl.value = URL.createObjectURL(file)
  originalSize.value = file.size

  const img = new Image()
  img.src = originalUrl.value
  img.onload = () => {
    originalDim.value = `${img.naturalWidth} x ${img.naturalHeight}px`
    runCompression()
    showToast('Gambar Dimuat', `Ukuran asli: ${formatSize(file.size)}`)
    scrollToPreview()
  }
  img.onerror = () => {
    isCompressing.value = false
    showToast('Gagal Membaca Gambar', 'Format file tidak didukung atau rusak.', 'error')
  }
}

// Load Mock Image
const loadMockImage = async () => {
  try {
    isCompressing.value = true
    showToast('Memuat Gambar Contoh', 'Sedang memuat gambar contoh dari aset lokal...', 'info')

    const response = await fetch(mockImageUrl)
    const blob = await response.blob()
    const file = new File([blob], 'hahaha.jpg', { type: 'image/jpeg' })

    originalFile.value = file
    mockImageActive.value = true

    if (originalUrl.value) URL.revokeObjectURL(originalUrl.value)
    originalUrl.value = URL.createObjectURL(file)
    originalSize.value = file.size

    const img = new Image()
    img.src = originalUrl.value
    img.onload = () => {
      originalDim.value = `${img.naturalWidth} x ${img.naturalHeight}px`
      runCompression()
      scrollToPreview()
    }
    img.onerror = () => {
      isCompressing.value = false
      showToast('Gagal Membaca Gambar', 'Gagal memuat gambar contoh.', 'error')
    }
  } catch (err) {
    console.error(err)
    isCompressing.value = false
    showToast('Gagal Memuat', 'Gagal mengambil gambar contoh dari internet.', 'error')
  }
}

// Compression execution
const runCompression = async () => {
  if (!originalFile.value) return

  isCompressing.value = true
  try {
    let mimeType = 'image/webp'
    if (selectedFormat.value === 'jpeg') mimeType = 'image/jpeg'
    if (selectedFormat.value === 'png') mimeType = 'image/png'

    const targetSizeMB = (originalSize.value / (1024 * 1024)) * (quality.value / 100)
    const options = {
      maxSizeMB: Math.max(0.01, targetSizeMB),
      maxWidthOrHeight: resizeEnabled.value ? customWidth.value : undefined,
      useWebWorker: true,
      preserveEXIF: preserveExif.value,
      fileType: mimeType,
      initialQuality: quality.value / 100,
      alwaysKeepResolution: !resizeEnabled.value,
    }

    const compressedBlob = await imageCompression(originalFile.value, options)

    if (compressedUrl.value) URL.revokeObjectURL(compressedUrl.value)
    compressedUrl.value = URL.createObjectURL(compressedBlob)
    compressedSize.value = compressedBlob.size

    const img = new Image()
    img.src = compressedUrl.value
    img.onload = () => {
      compressedDim.value = `${img.naturalWidth} x ${img.naturalHeight}px`
      isCompressing.value = false
    }
    img.onerror = () => {
      isCompressing.value = false
      showToast('Gagal Membaca Gambar', 'Hasil kompresi tidak dapat dibaca.', 'error')
    }
  } catch (error) {
    console.error(error)
    isCompressing.value = false
    showToast('Gagal Kompresi', 'Terjadi kesalahan saat mengompresi gambar.', 'error')
  }
}

// Download Compressed Image
const downloadCompressed = () => {
  if (!compressedUrl.value) return
  const a = document.createElement('a')
  a.href = compressedUrl.value
  a.download = `wcompress_${Date.now()}.${selectedFormat.value}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  showToast('Unduhan Dimulai', 'File hasil kompresi berhasil disimpan.')
}

// Drag and drop comparison slider methods
const startDrag = (e) => {
  isDragging.value = true
  e.preventDefault()
}

const onDrag = (e) => {
  if (!isDragging.value || !comparisonContainer.value) return
  const rect = comparisonContainer.value.getBoundingClientRect()
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  let position = ((clientX - rect.left) / rect.width) * 100
  if (position < 0) position = 0
  if (position > 100) position = 100
  comparisonPosition.value = position
}

const stopDrag = () => {
  isDragging.value = false
}

const clearImages = () => {
  originalFile.value = null
  if (originalUrl.value) {
    URL.revokeObjectURL(originalUrl.value)
    originalUrl.value = ''
  }
  if (compressedUrl.value) {
    URL.revokeObjectURL(compressedUrl.value)
    compressedUrl.value = ''
  }
  originalDim.value = '-'
  compressedDim.value = '-'
  originalSize.value = 0
  compressedSize.value = 0
}

// Lifecycle Hooks
onActivated(() => {
  window.addEventListener('mouseup', stopDrag)
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('touchend', stopDrag)
  window.addEventListener('touchmove', onDrag)
})

onDeactivated(() => {
  window.removeEventListener('mouseup', stopDrag)
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('touchend', stopDrag)
  window.removeEventListener('touchmove', onDrag)
})

onUnmounted(() => {
  window.removeEventListener('mouseup', stopDrag)
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('touchend', stopDrag)
  window.removeEventListener('touchmove', onDrag)

  if (originalUrl.value) URL.revokeObjectURL(originalUrl.value)
  if (compressedUrl.value) URL.revokeObjectURL(compressedUrl.value)
})

// Watch reactive properties to trigger compression automatically with debounce
let debounceTimeout = null
const runCompressionDebounced = () => {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    runCompression()
  }, 250)
}

watch([resizeEnabled, customWidth, preserveExif, quality], () => {
  if (originalFile.value) {
    runCompressionDebounced()
  }
})
</script>

<template>
  <div id="panel-compressor" class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
    <!-- Left Side: Control Panel (5 Columns) -->
    <div
      class="lg:col-span-5 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-6 backdrop-blur-sm transition-all duration-300 hover:border-slate-700/60 hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)]"
    >
      <div class="flex items-center justify-between pb-4 border-b border-slate-800">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <span class="w-1.5 h-4 bg-brand-500 rounded"></span>
          Konfigurasi Mesin
        </h3>
        <button
          v-if="originalFile"
          @click="clearImages"
          class="text-xs font-semibold text-rose-400 hover:text-rose-300 transition cursor-pointer"
        >
          Hapus Gambar
        </button>
      </div>

      <!-- File Dropzone -->
      <div class="space-y-2">
        <label class="text-xs font-semibold text-slate-300 uppercase tracking-wider"
          >Unggah Gambar</label
        >
        <div
          @click="triggerFileInput"
          @dragover.prevent
          @drop.prevent="handleFileUpload"
          class="border-2 border-dashed border-slate-800 hover:border-brand-500/50 bg-slate-950/20 hover:bg-slate-900/10 transition-all rounded-xl p-6 text-center cursor-pointer group relative"
        >
          <input
            type="file"
            ref="fileInput"
            @change="handleFileUpload"
            class="hidden"
            accept="image/*"
          />
          <div class="space-y-2 pointer-events-none py-3">
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            </div>
            <p class="text-xs text-slate-300 font-medium">
              Drag & drop gambarmu di sini atau
              <span class="text-brand-400 group-hover:underline">telusuri</span>
            </p>
            <p class="text-[10px] text-slate-500">Mendukung JPEG, PNG, WEBP, HEIC s.d 20MB</p>
          </div>
        </div>
      </div>

      <!-- Format Output -->
      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <label class="text-xs font-semibold text-slate-300 uppercase tracking-wider"
            >Format Tujuan</label
          >
          <span
            v-if="selectedFormat === 'webp'"
            class="text-[10px] px-2 py-0.5 bg-brand-500/10 text-brand-400 rounded-full font-bold uppercase border border-brand-500/20"
          >
            Super Hemat
          </span>
          <span
            v-else-if="selectedFormat === 'jpeg'"
            class="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full font-bold uppercase border border-blue-500/20"
          >
            Kompatibilitas
          </span>
          <span
            v-else
            class="text-[10px] px-2 py-0.5 bg-pink-500/10 text-pink-400 rounded-full font-bold uppercase border border-pink-500/20"
          >
            Lossless Tajam
          </span>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <button
            type="button"
            @click="setFormat('webp')"
            :class="[
              'py-2 px-3 text-xs rounded-lg border transition-all duration-200 cursor-pointer font-semibold',
              selectedFormat === 'webp'
                ? 'border-brand-500 bg-brand-500/10 text-brand-400 shadow-inner'
                : 'border-slate-800 bg-slate-950 text-slate-450 hover:text-slate-200 hover:border-slate-700/60',
            ]"
          >
            WEBP
          </button>
          <button
            type="button"
            @click="setFormat('jpeg')"
            :class="[
              'py-2 px-3 text-xs rounded-lg border transition-all duration-200 cursor-pointer font-semibold',
              selectedFormat === 'jpeg'
                ? 'border-brand-500 bg-brand-500/10 text-brand-400 shadow-inner'
                : 'border-slate-800 bg-slate-950 text-slate-450 hover:text-slate-200 hover:border-slate-700/60',
            ]"
          >
            JPEG
          </button>
          <button
            type="button"
            @click="setFormat('png')"
            :class="[
              'py-2 px-3 text-xs rounded-lg border transition-all duration-200 cursor-pointer font-semibold',
              selectedFormat === 'png'
                ? 'border-brand-500 bg-brand-500/10 text-brand-400 shadow-inner'
                : 'border-slate-800 bg-slate-950 text-slate-450 hover:text-slate-200 hover:border-slate-700/60',
            ]"
          >
            PNG
          </button>
        </div>
      </div>

      <!-- Quality Control (Slider) -->
      <div class="space-y-3">
        <div class="flex justify-between">
          <label class="text-xs font-semibold text-slate-300 uppercase tracking-wider"
            >Kualitas Gambar</label
          >
          <span class="text-xs font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded"
            >{{ quality }}%</span
          >
        </div>
        <input
          type="range"
          min="10"
          max="100"
          v-model.number="quality"
          class="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
        />
        <div class="flex justify-between text-[10px] text-slate-500">
          <span>Kompresi Tinggi (Buram)</span>
          <span>Seimbang</span>
          <span>Maksimal (Besar)</span>
        </div>
      </div>

      <!-- Custom Width Resize -->
      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <label class="text-xs font-semibold text-slate-300 uppercase tracking-wider"
            >Batasi Lebar (Width)</label
          >
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              id="resize-toggle"
              v-model="resizeEnabled"
              class="rounded border-slate-800 bg-slate-950 text-brand-500 focus:ring-brand-500 cursor-pointer"
            />
            <span class="text-[11px] text-slate-400 font-medium">Aktif</span>
          </div>
        </div>

        <div
          class="grid grid-cols-4 gap-2 transition-all duration-200"
          :class="{ 'opacity-50 pointer-events-none': !resizeEnabled }"
        >
          <button
            type="button"
            @click="setWidthPreset(800)"
            :class="[
              'py-2 px-1 text-[11px] font-semibold rounded border transition-all duration-200 cursor-pointer',
              customWidth === 800
                ? 'border-brand-500 bg-brand-500/10 text-brand-400 shadow-inner'
                : 'border-slate-800 bg-slate-950 text-slate-450 hover:text-slate-200 hover:border-slate-700/60',
            ]"
          >
            800px
          </button>
          <button
            type="button"
            @click="setWidthPreset(1200)"
            :class="[
              'py-2 px-1 text-[11px] font-semibold rounded border transition-all duration-200 cursor-pointer',
              customWidth === 1200
                ? 'border-brand-500 bg-brand-500/10 text-brand-400 shadow-inner'
                : 'border-slate-800 bg-slate-950 text-slate-450 hover:text-slate-200 hover:border-slate-700/60',
            ]"
          >
            1200px
          </button>
          <button
            type="button"
            @click="setWidthPreset(1920)"
            :class="[
              'py-2 px-1 text-[11px] font-semibold rounded border transition-all duration-200 cursor-pointer',
              customWidth === 1920
                ? 'border-brand-500 bg-brand-500/10 text-brand-400 shadow-inner'
                : 'border-slate-800 bg-slate-950 text-slate-450 hover:text-slate-200 hover:border-slate-700/60',
            ]"
          >
            1920px
          </button>
          <div class="relative">
            <input
              type="number"
              v-model.number="customWidth"
              placeholder="Custom"
              class="w-full text-center py-2 px-1 text-[11px] font-mono font-bold bg-slate-950 border border-slate-800 hover:border-slate-700 rounded text-slate-200 focus:outline-none focus:border-brand-500/55 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>
      </div>

      <!-- Toggle EXIF preservation -->
      <div
        class="flex items-center justify-between p-3.5 bg-slate-950/45 rounded-xl border border-slate-800/40"
      >
        <div>
          <p class="text-xs font-bold text-slate-300">Preserve EXIF Metadata</p>
          <p class="text-[10px] text-slate-500 mt-0.5">
            Simpan info lokasi, kamera, dan tanggal foto.
          </p>
        </div>

        <button
          type="button"
          @click="preserveExif = !preserveExif"
          :class="[
            'w-9 h-5 rounded-full p-0.5 transition-colors duration-200 relative focus:outline-none cursor-pointer',
            preserveExif ? 'bg-brand-500' : 'bg-slate-800',
          ]"
        >
          <div
            :class="[
              'w-4 h-4 bg-white rounded-full transition-transform duration-200 transform',
              preserveExif ? 'translate-x-4' : 'translate-x-0',
            ]"
          ></div>
        </button>
      </div>
    </div>

    <!-- Right Side: Live Interactive Preview Panel (7 Columns) -->
    <div
      ref="previewPanel"
      class="lg:col-span-7 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-6 backdrop-blur-sm h-full justify-between transition-all duration-300 hover:border-slate-700/60 hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)]"
    >
      <div>
        <div class="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <span class="w-1.5 h-4 bg-brand-500 rounded"></span>
            Live Preview & Estimasi
          </h3>
          <span
            v-if="isCompressing"
            class="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-medium animate-pulse"
          >
            Memproses...
          </span>
          <span
            v-else-if="originalUrl"
            class="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-medium"
          >
            Kompresi Selesai
          </span>
          <span
            v-else
            class="text-[10px] px-2 py-0.5 bg-slate-500/10 text-slate-400 border border-slate-800 rounded font-medium"
          >
            Menunggu Gambar
          </span>
        </div>

        <!-- Preview Box -->
        <div
          class="relative min-h-[350px] w-full rounded-xl border border-slate-800 overflow-hidden bg-slate-950 flex items-center justify-center select-none group mb-6"
        >
          <!-- Fallback State (No Image) -->
          <div
            v-if="!originalUrl"
            class="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-4"
          >
            <div
              class="w-16 h-16 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-400 shadow-inner"
            >
              <svg
                class="w-8 h-8 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div class="space-y-1">
              <p class="text-sm font-semibold text-slate-300">Belum Ada Gambar</p>
              <p class="text-xs text-slate-500 max-w-xs">
                Gunakan tombol 'Gambar Contoh' di bawah jika Anda tidak ingin mengunggah file
                sendiri.
              </p>
            </div>
            <button
              type="button"
              @click="loadMockImage"
              class="px-4 py-2 text-xs font-semibold text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 rounded-lg border border-brand-500/20 transition-all cursor-pointer"
            >
              Gunakan Gambar Contoh
            </button>
          </div>

          <!-- Comparison Container (Shown when image loaded) -->
          <div
            v-else
            ref="comparisonContainer"
            class="absolute inset-0 select-none cursor-ew-resize"
          >
            <!-- Left Side Image (Original) -->
            <img
              :src="originalUrl"
              class="absolute inset-0 w-full h-full object-contain pointer-events-none"
              alt="Original"
            />

            <!-- Right Side Image (Compressed - Clipped dynamically) -->
            <div
              class="absolute inset-0 w-full h-full overflow-hidden"
              :style="{ clipPath: `inset(0 0 0 ${comparisonPosition}%)` }"
            >
              <img
                :src="compressedUrl || originalUrl"
                class="absolute inset-0 w-full h-full object-contain pointer-events-none"
                alt="Compressed"
              />
            </div>

            <!-- Labels for Slider -->
            <div
              class="absolute left-4 top-4 bg-slate-950/80 backdrop-blur-md text-[10px] uppercase font-bold text-slate-400 border border-slate-800 px-2 py-1 rounded"
            >
              Asli
            </div>
            <div
              class="absolute right-4 top-4 bg-brand-950/80 backdrop-blur-md text-[10px] uppercase font-bold text-brand-400 border border-brand-500/30 px-2 py-1 rounded"
            >
              Terkompresi
            </div>

            <!-- Draggable Comparison Bar -->
            <div
              class="absolute top-0 bottom-0 w-1 bg-brand-500 flex items-center justify-center pointer-events-auto"
              :style="{ left: comparisonPosition + '%' }"
              @mousedown="startDrag"
              @touchstart="startDrag"
            >
              <div
                class="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center border border-white/20 select-none pulse-glow-handle"
              >
                <svg
                  class="w-4 h-4 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2.5"
                    d="M8 9l-4 3 4 3m8-6l4 3-4 3"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Comparative Metrics Grid -->
        <div class="grid grid-cols-3 gap-4">
          <!-- Metric Asli -->
          <div
            class="bg-slate-950/50 border border-slate-700 rounded-xl p-3.5 relative overflow-hidden"
          >
            <span
              class="absolute right-3 top-3 w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center text-[10px] text-slate-500 font-bold font-mono"
              >1</span
            >
            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ukuran Asli</p>
            <p class="text-sm font-black text-slate-200 mt-1">
              {{ formatSize(originalSize) }}
            </p>
            <p class="text-[10px] text-slate-400 font-mono mt-0.5">{{ originalDim }}</p>
          </div>

          <!-- Metric Terkompresi -->
          <div
            class="bg-slate-950/50 border border-slate-700 rounded-xl p-3.5 relative overflow-hidden"
          >
            <span
              class="absolute right-3 top-3 w-5 h-5 rounded-full bg-brand-950 border border-brand-500/25 flex items-center justify-center text-[10px] text-brand-400 font-bold font-mono"
              >2</span
            >
            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Hasil Kompresi
            </p>
            <p class="text-sm font-black text-brand-400 mt-1">
              {{ formatSize(compressedSize) }}
            </p>
            <p class="text-[10px] text-slate-400 font-mono mt-0.5">
              {{ compressedDim }}
            </p>
          </div>

          <!-- Savings -->
          <div
            class="border rounded-xl p-3.5 relative overflow-hidden bg-gradient-to-br"
            :class="[
              spaceSavings > 50
                ? 'border-emerald-500/20 from-slate-950/50 to-emerald-500/5'
                : 'border-brand-500/15 from-slate-950/50 to-brand-500/5',
            ]"
          >
            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Efisiensi Space
            </p>
            <div class="flex items-baseline gap-1 mt-1">
              <span
                :class="[
                  'text-2xl font-black font-mono',
                  spaceSavings > 50 ? 'text-emerald-400' : 'text-brand-400',
                ]"
              >
                {{ spaceSavings > 0 ? `-${spaceSavings}%` : '0%' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons Group -->
      <div class="flex flex-col sm:flex-row gap-3 mt-6 w-full">
        <button
          v-if="originalUrl"
          type="button"
          @click="clearImages"
          class="w-full sm:w-auto px-4 py-3 border border-slate-800 hover:border-slate-700 hover:text-slate-200 bg-slate-950/45 text-slate-400 hover:bg-slate-900/10 rounded-xl font-bold text-sm transition-all flex items-center gap-2 justify-center cursor-pointer active:scale-95 flex-shrink-0"
        >
          Reset
        </button>
        
        <button
          type="button"
          :disabled="!compressedUrl || isCompressing"
          @click="downloadCompressed"
          :class="[
            'w-full sm:flex-grow py-3 px-6 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg',
            compressedUrl && !isCompressing
              ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer shadow-brand-500/15 hover:shadow-brand-500/25 hover:scale-[1.01] active:scale-[0.99]'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed',
          ]"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          Unduh Gambar Hasil Kompresi
        </button>
      </div>
    </div>
  </div>
</template>
