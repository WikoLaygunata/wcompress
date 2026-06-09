<script setup>
import { ref, watch, onUnmounted, inject } from 'vue'

const showToast = inject('showToast')

const aiFile = ref(null)
const aiOriginalUrl = ref('')
const aiOutputUrl = ref('')

const aiIsModelLoaded = ref(false)
const aiIsLoadingModel = ref(false)
const aiModelProgress = ref(0)
const aiModelStatusText = ref('0% (Menunggu Gambar / Aktivasi)')
const aiIsProcessing = ref(false)
const feather = ref(2)
const outputFormat = ref('webp')
const outputQuality = ref(85)
const outputFileSize = ref(0)

const aiMockActive = ref(false)
const aiFileInput = ref(null)
const pendingAiProcess = ref(false)

const lastResultData = ref(null)
const lastResultWidth = ref(0)
const lastResultHeight = ref(0)
const lastResultChannels = ref(4)

let aiWorker = null

const triggerAiFileInput = () => {
  aiFileInput.value.click()
}

const handleAiFileUpload = (e) => {
  const files = e.target.files || e.dataTransfer?.files
  if (!files || files.length === 0) return
  processAiFile(files[0])
}

const processAiFile = (file) => {
  if (!file.type.startsWith('image/')) {
    showToast('File tidak valid', 'Mohon unggah file gambar saja.')
    return
  }
  aiFile.value = file
  aiMockActive.value = false
  aiOutputUrl.value = ''

  if (aiOriginalUrl.value) URL.revokeObjectURL(aiOriginalUrl.value)
  aiOriginalUrl.value = URL.createObjectURL(file)

  showToast('Gambar Terunggah', 'Siap untuk diproses oleh AI Hapus BG.')
}

// Initialize Web Worker
const initWorker = () => {
  if (aiWorker) return

  // Note: worker.js is located in src/ and this component is in src/components/, so we use '../worker.js'
  aiWorker = new Worker(new URL('../worker.js', import.meta.url), { type: 'module' })

  aiWorker.onmessage = (e) => {
    const { type, data, error } = e.data

    if (type === 'progress') {
      if (data.status === 'progress') {
        const progress = Math.round(data.progress || 0)
        aiModelProgress.value = progress
        aiModelStatusText.value = `Mengunduh model: ${progress}% (~${((progress / 100) * 6).toFixed(1)}MB / 6MB)`
      } else if (data.status === 'ready') {
        aiModelStatusText.value = 'Mengekstrak file model...'
      }
    } else if (type === 'ready') {
      aiIsLoadingModel.value = false
      aiIsModelLoaded.value = true
      aiModelProgress.value = 100
      aiModelStatusText.value = 'Model AI Aktif! Siap digunakan offline.'
      showToast('Model AI Siap', 'Model Xenova MODNet berhasil dimuat di browser.')

      if (pendingAiProcess.value) {
        startActualBgRemoval()
      }
    } else if (type === 'result') {
      const { width, height, channels, imageData } = data
      lastResultData.value = imageData
      lastResultWidth.value = width
      lastResultHeight.value = height
      lastResultChannels.value = channels || 4
      renderOutput(width, height, channels || 4, imageData)
    } else if (type === 'error') {
      aiIsProcessing.value = false
      aiIsLoadingModel.value = false
      showToast('Error AI', `Gagal memproses: ${error}`)
    }
  }
}

const activateAi = () => {
  if (aiIsModelLoaded.value || aiIsLoadingModel.value) return

  aiIsLoadingModel.value = true
  aiModelStatusText.value = 'Menghubungkan ke server Hugging Face...'
  initWorker()
  aiWorker.postMessage({ type: 'load' })
}

// Start AI background removal process
const startActualBgRemoval = () => {
  if (!aiIsModelLoaded.value) {
    pendingAiProcess.value = true
    activateAi()
    return
  }

  if (!aiOriginalUrl.value) {
    showToast('Pilih Gambar', 'Silakan pilih gambar terlebih dahulu.')
    return
  }

  aiIsProcessing.value = true
  showToast('Memproses AI', 'Menghilangkan latar belakang di browser Anda...')

  // Post original image URI to Web Worker
  aiWorker.postMessage({
    type: 'remove-bg',
    data: {
      imageUri: aiOriginalUrl.value,
    },
  })
}

// Render RGBA output from BackgroundRemovalPipeline to a data URL
const renderOutput = (width, height, channels, imageData) => {
  // Create canvas with the RGBA result
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  // Build ImageData from the raw pixel array
  const imgData = ctx.createImageData(width, height)
  const pixels = imgData.data

  if (channels === 4) {
    for (let i = 0; i < imageData.length; i++) {
      pixels[i] = imageData[i]
    }
  } else if (channels === 3) {
    for (let i = 0; i < width * height; i++) {
      pixels[i * 4] = imageData[i * 3]
      pixels[i * 4 + 1] = imageData[i * 3 + 1]
      pixels[i * 4 + 2] = imageData[i * 3 + 2]
      pixels[i * 4 + 3] = 255
    }
  } else {
    for (let i = 0; i < imageData.length; i++) {
      pixels[i * 4] = 255
      pixels[i * 4 + 1] = 255
      pixels[i * 4 + 2] = 255
      pixels[i * 4 + 3] = imageData[i]
    }
  }
  ctx.putImageData(imgData, 0, 0)

  // Determine which canvas to export (with or without feathering)
  let exportCanvas = canvas

  if (feather.value > 0) {
    const alphaCanvas = document.createElement('canvas')
    alphaCanvas.width = width
    alphaCanvas.height = height
    const alphaCtx = alphaCanvas.getContext('2d')
    const alphaData = alphaCtx.createImageData(width, height)
    for (let i = 0; i < width * height; i++) {
      alphaData.data[i * 4] = 0
      alphaData.data[i * 4 + 1] = 0
      alphaData.data[i * 4 + 2] = 0
      alphaData.data[i * 4 + 3] = pixels[i * 4 + 3]
    }
    alphaCtx.putImageData(alphaData, 0, 0)

    const blurredAlpha = document.createElement('canvas')
    blurredAlpha.width = width
    blurredAlpha.height = height
    const blurCtx = blurredAlpha.getContext('2d')
    blurCtx.filter = `blur(${feather.value}px)`
    blurCtx.drawImage(alphaCanvas, 0, 0)

    const finalCanvas = document.createElement('canvas')
    finalCanvas.width = width
    finalCanvas.height = height
    const finalCtx = finalCanvas.getContext('2d')
    finalCtx.drawImage(canvas, 0, 0)
    finalCtx.globalCompositeOperation = 'destination-in'
    finalCtx.drawImage(blurredAlpha, 0, 0)

    exportCanvas = finalCanvas
  }

  // Export using toBlob for better compression and memory efficiency
  const mimeType = outputFormat.value === 'webp' ? 'image/webp' : 'image/png'
  const quality = outputFormat.value === 'webp' ? outputQuality.value / 100 : undefined

  exportCanvas.toBlob(
    (blob) => {
      if (aiOutputUrl.value) URL.revokeObjectURL(aiOutputUrl.value)
      aiOutputUrl.value = URL.createObjectURL(blob)
      outputFileSize.value = blob.size

      aiIsProcessing.value = false
      pendingAiProcess.value = false
      showToast('Hapus BG Berhasil', 'Latar belakang berhasil dihilangkan!')
    },
    mimeType,
    quality,
  )
}

// Start Mock simulation (No 24MB download required)
const startMockBgremover = () => {
  aiMockActive.value = true
  let progress = 0
  aiModelStatusText.value = 'Menghubungkan ke repository model...'

  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 15) + 5
    if (progress >= 100) {
      progress = 100
      clearInterval(interval)
      aiModelStatusText.value = 'Model Siap (Simulasi)! Memproses gambar...'

      setTimeout(() => {
        // Mock transparency cutout of the Unsplash leaf
        aiOutputUrl.value =
          'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=800&q=80'
        showToast('Simulasi Selesai', 'Latar belakang berhasil diisolasi (Mode Simulasi).')
      }, 1500)
    }
    aiModelProgress.value = progress
    if (progress < 100) {
      aiModelStatusText.value = `Mengunduh model (Simulasi): ${progress}% (~${((progress / 100) * 6).toFixed(1)}MB / 6MB)`
    }
  }, 150)
}

const resetBgRemover = () => {
  aiFile.value = null
  aiMockActive.value = false
  aiOutputUrl.value = ''

  if (aiOriginalUrl.value) {
    URL.revokeObjectURL(aiOriginalUrl.value)
    aiOriginalUrl.value = ''
  }

  aiModelProgress.value = 0
  aiModelStatusText.value = '0% (Menunggu Gambar / Aktivasi)'
  aiIsProcessing.value = false
  pendingAiProcess.value = false
  
  lastResultData.value = null
  lastResultWidth.value = 0
  lastResultHeight.value = 0
  lastResultChannels.value = 4
}

const downloadBgOutput = () => {
  if (!aiOutputUrl.value) return
  const ext = outputFormat.value === 'webp' ? 'webp' : 'png'
  const a = document.createElement('a')
  a.href = aiOutputUrl.value
  a.download = `wcompress_no_bg_${Date.now()}.${ext}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  showToast('Unduhan Dimulai', `File ${ext.toUpperCase()} transparan berhasil disimpan.`)
}

onUnmounted(() => {
  if (aiWorker) {
    aiWorker.terminate()
  }
  if (aiOriginalUrl.value) URL.revokeObjectURL(aiOriginalUrl.value)
  if (aiOutputUrl.value && aiOutputUrl.value.startsWith('blob:'))
    URL.revokeObjectURL(aiOutputUrl.value)
})

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

// Watch feather, format, and quality to re-render on cached result
const reRender = () => {
  if (lastResultData.value) {
    renderOutput(lastResultWidth.value, lastResultHeight.value, lastResultChannels.value, lastResultData.value)
  }
}

watch(feather, reRender)
watch(outputFormat, reRender)
watch(outputQuality, reRender)
</script>

<template>
  <div id="panel-bgremover" class="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
    <!-- Left Info Panel (5 Cols) -->
    <div
      class="md:col-span-5 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-6 backdrop-blur-sm"
    >
      <div class="flex items-center justify-between pb-4 border-b border-slate-800">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <span class="w-1.5 h-4 bg-brand-500 rounded"></span>
          AI Background Remover
        </h3>
      </div>

      <!-- AI Loading / Connection Card -->
      <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
        <div class="flex justify-between items-center">
          <span class="text-xs font-bold text-slate-300 font-mono">Xenova MODNet</span>

          <!-- Badges -->
          <span
            v-if="!aiIsModelLoaded && !aiIsLoadingModel"
            class="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded uppercase"
          >
            Perlu Aktivasi
          </span>
          <span
            v-if="aiIsLoadingModel"
            class="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded uppercase animate-pulse"
          >
            Mengunduh...
          </span>
          <span
            v-if="aiIsModelLoaded && !aiIsLoadingModel"
            class="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase"
          >
            Siap Offline
          </span>
        </div>

        <p class="text-xs text-slate-400 leading-relaxed">
          Model AI dijalankan sepenuhnya secara lokal menggunakan WebAssembly. Pengunduhan awal
          sebesar <b class="text-slate-200">~6MB</b> diperlukan. File otomatis di-cache oleh
          browser sehingga kunjungan berikutnya berjalan instan.
        </p>

        <!-- Progress Bar -->
        <div class="space-y-1.5 pt-2">
          <div class="flex justify-between text-[11px] font-semibold">
            <span class="text-slate-400 text-[10px]">Unduhan Model AI</span>
            <span
              class="text-slate-300 font-mono text-[10px] max-w-[150px] truncate"
              :title="aiModelStatusText"
            >
              {{ aiModelStatusText }}
            </span>
          </div>
          <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              class="h-full bg-brand-500 rounded-full transition-all duration-300"
              :style="{ width: aiModelProgress + '%' }"
            ></div>
          </div>
        </div>

        <!-- Activate Model Button -->
        <button
          v-if="!aiIsModelLoaded"
          type="button"
          @click="activateAi"
          :disabled="aiIsLoadingModel"
          class="w-full mt-2 py-2 px-3 rounded-lg text-xs font-bold text-center border cursor-pointer transition-all"
          :class="[
            aiIsLoadingModel
              ? 'border-slate-800 text-slate-500 bg-slate-900/40 cursor-not-allowed'
              : 'border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300',
          ]"
        >
          {{ aiIsLoadingModel ? 'Menghubungkan...' : 'Aktifkan AI (Unduh Model)' }}
        </button>
      </div>

      <!-- Input Selector for BG Remover -->
      <div class="space-y-2">
        <label class="text-xs font-semibold text-slate-300 uppercase tracking-wider"
          >Unggah Gambar</label
        >
        <div
          @click="triggerAiFileInput"
          @dragover.prevent
          @drop.prevent="handleAiFileUpload"
          class="border-2 border-dashed border-slate-800 hover:border-brand-500/50 bg-slate-950/20 hover:bg-slate-900/10 transition-all rounded-xl p-6 text-center cursor-pointer group relative"
        >
          <input
            type="file"
            ref="aiFileInput"
            @change="handleAiFileUpload"
            class="hidden"
            accept="image/*"
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            </div>
            <div class="space-y-0.5">
              <p class="text-xs text-slate-300 font-medium">
                Drag & drop gambarmu atau <span class="text-brand-400 group-hover:underline">telusuri</span>
              </p>
              <p class="text-[10px] text-slate-500">Mendukung JPEG, PNG, WEBP s.d 15MB</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Edge Smoothing Slider -->
      <div class="space-y-3">
        <div class="flex justify-between">
          <label class="text-xs font-semibold text-slate-300 uppercase tracking-wider"
            >Feather (Kehalusan)</label
          >
          <span class="text-xs font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded"
            >{{ feather }}px</span
          >
        </div>
        <input
          type="range"
          min="0"
          max="10"
          v-model.number="feather"
          class="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
        />
      </div>

      <!-- Output Format -->
      <div class="space-y-3">
        <label class="text-xs font-semibold text-slate-300 uppercase tracking-wider"
          >Format Output</label
        >
        <div class="flex gap-2">
          <button
            type="button"
            @click="outputFormat = 'webp'"
            :class="[
              'flex-1 py-2 px-3 rounded-lg text-xs font-bold text-center border cursor-pointer transition-all',
              outputFormat === 'webp'
                ? 'border-brand-500/50 bg-brand-500/15 text-brand-300'
                : 'border-slate-800 bg-slate-950/40 text-slate-500 hover:border-slate-700',
            ]"
          >
            WebP <span class="text-[9px] opacity-60">(Lebih Kecil)</span>
          </button>
          <button
            type="button"
            @click="outputFormat = 'png'"
            :class="[
              'flex-1 py-2 px-3 rounded-lg text-xs font-bold text-center border cursor-pointer transition-all',
              outputFormat === 'png'
                ? 'border-brand-500/50 bg-brand-500/15 text-brand-300'
                : 'border-slate-800 bg-slate-950/40 text-slate-500 hover:border-slate-700',
            ]"
          >
            PNG <span class="text-[9px] opacity-60">(Lossless)</span>
          </button>
        </div>
      </div>

      <!-- Quality Slider (WebP only) -->
      <div v-if="outputFormat === 'webp'" class="space-y-3">
        <div class="flex justify-between">
          <label class="text-xs font-semibold text-slate-300 uppercase tracking-wider"
            >Kualitas WebP</label
          >
          <span class="text-xs font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded"
            >{{ outputQuality }}%</span
          >
        </div>
        <input
          type="range"
          min="10"
          max="100"
          step="5"
          v-model.number="outputQuality"
          class="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
        />
      </div>

      <div
        class="text-xs text-slate-500 bg-slate-950/40 p-3 rounded-lg border border-slate-800/40 flex items-start gap-2"
      >
        <svg
          class="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span
          >Output dikonversi ke
          <b class="text-slate-300">{{ outputFormat === 'webp' ? 'WebP' : 'PNG' }} Transparan</b>.
          {{ outputFormat === 'webp' ? 'WebP menghasilkan file 5-10x lebih kecil dari PNG.' : 'PNG lossless, cocok untuk editing lebih lanjut.' }}</span
        >
      </div>
    </div>

    <!-- Right Simulation Area (7 Cols) -->
    <div
      class="md:col-span-7 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-6 backdrop-blur-sm h-full"
    >
      <!-- Display Grid -->
      <div
        class="relative flex-grow min-h-[350px] rounded-xl border border-slate-800 overflow-hidden transparency-grid flex items-center justify-center select-none group"
      >
        <!-- Fallback State (No Image loaded) -->
        <div
          v-if="!aiOriginalUrl"
          class="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-4 bg-slate-950"
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <div class="space-y-1">
            <p class="text-sm font-semibold text-slate-300">Hapus Background AI</p>
            <p class="text-xs text-slate-500 max-w-xs">
              Gunakan simulasi tombol di bawah untuk mencoba visual pemotongan instan, atau
              upload gambar Anda di panel kiri.
            </p>
          </div>
          <button
            type="button"
            @click="startMockBgremover"
            class="px-5 py-2.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-lg shadow-lg shadow-brand-500/10 transition-all flex items-center gap-2 cursor-pointer border border-brand-500/20"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Mulai Simulasi Hapus BG
          </button>
        </div>

        <!-- Original Image (when waiting / processing) -->
        <div
          v-else-if="aiOriginalUrl && !aiOutputUrl"
          class="absolute inset-0 p-4 flex flex-col items-center justify-center bg-slate-950/80"
        >
          <img
            :src="aiOriginalUrl"
            class="max-w-full max-h-[85%] object-contain opacity-70 transition-all duration-300"
            alt="Source Image"
          />

          <!-- Processing SpinnerOverlay -->
          <div
            v-if="aiIsProcessing"
            class="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center space-y-3 backdrop-blur-xs"
          >
            <div
              class="w-10 h-10 rounded-full border-4 border-slate-800 border-t-brand-500 animate-spin"
            ></div>
            <p class="text-xs font-semibold text-slate-300">AI sedang mengisolasi subjek...</p>
            <p class="text-[10px] text-slate-500">Proses ini memakan waktu 1-3 detik saja.</p>
          </div>

          <div v-else class="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
            <button
              type="button"
              @click="startActualBgRemoval"
              class="px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-500/20 flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95 transition-all"
            >
              <svg
                class="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2.5"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Proses Hapus Background
            </button>
          </div>
        </div>

        <!-- Visual Output of BG Remover -->
        <div
          v-else-if="aiOutputUrl"
          class="absolute inset-0 p-4 flex items-center justify-center"
        >
          <img
            :src="aiOutputUrl"
            class="max-w-full max-h-[85%] object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.6)] transition-all duration-300"
            alt="Cutout Output"
          />
          <div
            class="absolute left-4 top-4 bg-emerald-500/90 text-white text-[9px] uppercase font-bold tracking-wider px-2 py-1 rounded shadow"
          >
            Latar Belakang Dihapus
          </div>
        </div>
      </div>

      <!-- Control Buttons for Output -->
      <div class="flex gap-4 mt-6">
        <button
          type="button"
          @click="resetBgRemover"
          :disabled="!aiOriginalUrl"
          class="px-4 py-3 border border-slate-800 hover:border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Reset Gambar
        </button>

        <button
          type="button"
          :disabled="!aiOutputUrl"
          @click="downloadBgOutput"
          :class="[
            'flex-1 py-3 px-6 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2',
            aiOutputUrl
              ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer shadow-lg shadow-brand-500/15'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed',
          ]"
        >
          Unduh Hasil {{ outputFormat === 'webp' ? 'WebP' : 'PNG' }} Transparan
          <span v-if="outputFileSize" class="text-[10px] opacity-70">({{ formatSize(outputFileSize) }})</span>
        </button>
      </div>
    </div>
  </div>
</template>
