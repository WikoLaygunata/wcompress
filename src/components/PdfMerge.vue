<script setup>
import { ref, onUnmounted, inject, computed } from 'vue'
import { PDFDocument } from 'pdf-lib'

const showToast = inject('showToast')

// ─── STATE ───
const pdfFiles = ref([]) // { id, name, size, file, pageCount }
const isMerging = ref(false)
const currentProcessingItem = ref(0)
const mergedPdfBlob = ref(null)
const mergedPdfUrl = ref('')
const mergedPdfSize = ref(0)
const fileInput = ref(null)

let fileIdCounter = 0

// ─── HELPERS ───
const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

const totalSize = computed(() => pdfFiles.value.reduce((sum, f) => sum + f.size, 0))
const totalPages = computed(() => pdfFiles.value.reduce((sum, f) => sum + f.pageCount, 0))

// ─── LOGIC ───
const triggerInput = () => fileInput.value?.click()

const handleUpload = async (e) => {
  const files = e.target.files || e.dataTransfer?.files
  if (!files || files.length === 0) return

  let addedCount = 0

  for (const file of files) {
    if (file.type !== 'application/pdf') continue

    try {
      // Read page count quickly using pdf-lib
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
      
      if (pdfDoc.isEncrypted) {
        throw new Error('Dokumen dilindungi kata sandi')
      }
      
      const pageCount = pdfDoc.getPageCount()

      pdfFiles.value.push({
        id: ++fileIdCounter,
        name: file.name,
        size: file.size,
        file: file,
        pageCount: pageCount,
      })
      addedCount++
    } catch (err) {
      console.error(`Gagal memuat ${file.name}:`, err)
      showToast('Peringatan', `Gagal membaca ${file.name}, mungkin karena enkripsi.`, 'warning')
    }
  }

  if (addedCount > 0) {
    showToast('File Ditambahkan', `${addedCount} PDF berhasil diunggah.`)
  }

  if (fileInput.value) fileInput.value.value = ''
  
  // Reset previous result if any
  if (mergedPdfUrl.value) {
    URL.revokeObjectURL(mergedPdfUrl.value)
    mergedPdfUrl.value = ''
    mergedPdfBlob.value = null
    mergedPdfSize.value = 0
  }
}

const removeFile = (id) => {
  const idx = pdfFiles.value.findIndex((f) => f.id === id)
  if (idx !== -1) {
    pdfFiles.value.splice(idx, 1)
  }
  
  if (mergedPdfUrl.value) {
    URL.revokeObjectURL(mergedPdfUrl.value)
    mergedPdfUrl.value = ''
    mergedPdfBlob.value = null
    mergedPdfSize.value = 0
  }
}

const moveFile = (fromIdx, direction) => {
  const toIdx = fromIdx + direction
  if (toIdx < 0 || toIdx >= pdfFiles.value.length) return
  const temp = pdfFiles.value[fromIdx]
  pdfFiles.value[fromIdx] = pdfFiles.value[toIdx]
  pdfFiles.value[toIdx] = temp
  pdfFiles.value = [...pdfFiles.value]
  
  if (mergedPdfUrl.value) {
    URL.revokeObjectURL(mergedPdfUrl.value)
    mergedPdfUrl.value = ''
    mergedPdfBlob.value = null
    mergedPdfSize.value = 0
  }
}

const mergePdfs = async () => {
  if (pdfFiles.value.length < 2 || isMerging.value) {
    showToast('Peringatan', 'Minimal butuh 2 file PDF untuk digabungkan.', 'warning')
    return
  }

  isMerging.value = true
  currentProcessingItem.value = 0
  showToast('Menggabungkan PDF', 'Sedang memproses penggabungan dokumen...', 'info')

  try {
    const mergedPdf = await PDFDocument.create()

    for (let i = 0; i < pdfFiles.value.length; i++) {
      const item = pdfFiles.value[i]
      currentProcessingItem.value = i + 1
      try {
        const arrayBuffer = await item.file.arrayBuffer()
        const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
        
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
        copiedPages.forEach((page) => mergedPdf.addPage(page))
      } catch (innerErr) {
        console.error(`Gagal memproses ${item.name}:`, innerErr)
        throw new Error(`Dokumen "${item.name}" gagal digabung, kemungkinan file dilindungi kata sandi (terenkripsi) penuh atau rusak.`)
      }

      // Beri jeda agar UI tidak macet
      await new Promise(resolve => setTimeout(resolve, 15))
    }

    const pdfBytes = await mergedPdf.save()
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })

    if (mergedPdfUrl.value) {
      URL.revokeObjectURL(mergedPdfUrl.value)
    }

    mergedPdfBlob.value = blob
    mergedPdfUrl.value = URL.createObjectURL(blob)
    mergedPdfSize.value = blob.size

    showToast('Berhasil', `${pdfFiles.value.length} dokumen berhasil digabungkan menjadi 1 PDF.`)
  } catch (err) {
    console.error('PDF merge error:', err)
    // Jika err memiliki message (dari throw new Error), tampilkan message tersebut
    const errorMsg = err.message || 'Terjadi kesalahan saat menggabungkan PDF.'
    showToast('Gagal', errorMsg, 'error')
  } finally {
    isMerging.value = false
  }
}

const downloadMergedPdf = () => {
  if (!mergedPdfUrl.value) return
  const a = document.createElement('a')
  a.href = mergedPdfUrl.value
  a.download = `wcompress_merged_${Date.now()}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  showToast('Unduhan Dimulai', 'File PDF hasil gabungan berhasil disimpan.')
}

const resetMerge = () => {
  pdfFiles.value = []
  if (mergedPdfUrl.value) {
    URL.revokeObjectURL(mergedPdfUrl.value)
    mergedPdfUrl.value = ''
  }
  mergedPdfBlob.value = null
  mergedPdfSize.value = 0
  currentProcessingItem.value = 0
  if (fileInput.value) fileInput.value.value = ''
  showToast('Reset', 'Semua file PDF telah dihapus.')
}

onUnmounted(() => {
  if (mergedPdfUrl.value) URL.revokeObjectURL(mergedPdfUrl.value)
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
          Gabung Multi PDF
        </h3>
        <button
          v-if="pdfFiles.length > 0"
          @click="resetMerge"
          class="text-xs font-semibold text-rose-400 hover:text-rose-300 transition cursor-pointer"
        >
          Hapus Semua
        </button>
      </div>

      <!-- Upload Dropzone -->
      <div class="space-y-2">
        <label class="text-xs font-semibold text-slate-300 uppercase tracking-wider">Unggah File PDF</label>
        <div
          @click="triggerInput"
          @dragover.prevent
          @drop.prevent="handleUpload"
          class="border-2 border-dashed border-slate-800 hover:border-brand-500/50 bg-slate-950/20 hover:bg-slate-900/10 transition-all rounded-xl p-6 text-center cursor-pointer group relative"
        >
          <input
            type="file"
            ref="fileInput"
            @change="handleUpload"
            class="hidden"
            accept="application/pdf"
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </div>
            <div class="space-y-0.5">
              <p class="text-xs text-slate-300 font-medium">
                Drag & drop PDF atau
                <span class="text-brand-400 group-hover:underline">telusuri</span>
              </p>
              <p class="text-[10px] text-slate-500">Pilih banyak file sekaligus</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats Badge -->
      <div v-if="pdfFiles.length > 0" class="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-300">Total File</span>
          <span class="text-[10px] font-bold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded">{{ pdfFiles.length }} Dokumen</span>
        </div>
        <div class="flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>Total Halaman: {{ totalPages }}</span>
          <span>Estimasi Ukuran: {{ formatSize(totalSize) }}</span>
        </div>
      </div>

      <!-- Action Button -->
      <button
        type="button"
        :disabled="pdfFiles.length < 2 || isMerging"
        @click="mergePdfs"
        :class="[
          'w-full py-3 px-6 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg',
          pdfFiles.length > 1 && !isMerging
            ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer shadow-brand-500/15 hover:shadow-brand-500/25 hover:scale-[1.01] active:scale-[0.99]'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed',
        ]"
      >
        <svg v-if="isMerging" class="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <svg v-else class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        {{ isMerging ? `Menggabungkan ${currentProcessingItem} dari ${pdfFiles.length}...` : 'Gabungkan PDF' }}
      </button>
    </div>

    <!-- Right Panel (7 cols) -->
    <div
      class="md:col-span-7 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-6 backdrop-blur-sm h-full transition-all duration-300 hover:border-slate-700/60 hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)]"
    >
      <div class="flex items-center justify-between pb-4 border-b border-slate-800">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <span class="w-1.5 h-4 bg-brand-500 rounded"></span>
          {{ mergedPdfUrl ? 'Hasil Gabungan' : 'Daftar & Urutan File' }}
        </h3>
        <span
          v-if="mergedPdfUrl"
          class="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-medium"
        >
          Selesai Digabung
        </span>
      </div>

      <!-- Empty State -->
      <div
        v-if="pdfFiles.length === 0"
        class="flex-grow min-h-[300px] rounded-xl border border-slate-800 bg-slate-950 flex flex-col items-center justify-center text-center p-6 space-y-4"
      >
        <div class="w-16 h-16 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center shadow-inner">
          <svg class="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
        </div>
        <div class="space-y-1">
          <p class="text-sm font-semibold text-slate-300">Belum Ada File</p>
          <p class="text-xs text-slate-500 max-w-xs">Unggah setidaknya 2 file PDF untuk digabungkan.</p>
        </div>
      </div>

      <!-- Success State -->
      <div v-else-if="mergedPdfUrl" class="w-full flex-grow flex flex-col gap-6">
        <div class="flex-grow flex items-center justify-center bg-slate-950/80 rounded-xl border border-slate-800/80 p-6 text-center">
            <div class="space-y-4">
              <div class="w-20 h-20 mx-auto rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p class="text-lg font-bold text-white mb-1">Berhasil Digabungkan!</p>
                <p class="text-xs text-slate-400 mb-3">Dokumen PDF gabungan siap diunduh.</p>
                <p class="inline-flex items-center justify-center bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 gap-3">
                  <span>{{ totalPages }} Halaman</span>
                  <span class="w-px h-3 bg-slate-700"></span>
                  <span>{{ formatSize(mergedPdfSize) }}</span>
                </p>
              </div>
            </div>
        </div>

        <button
          type="button"
          @click="downloadMergedPdf"
          class="w-full py-3.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg bg-brand-600 hover:bg-brand-500 text-white cursor-pointer shadow-brand-500/15 hover:shadow-brand-500/25 active:scale-[0.99]"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Unduh PDF Gabungan
        </button>
      </div>

      <!-- File List (Before Merge) -->
      <div v-else class="flex-grow overflow-y-auto max-h-[500px] pr-1 space-y-2 custom-scrollbar">
        <div
          v-for="(pdf, idx) in pdfFiles"
          :key="pdf.id"
          class="flex items-center gap-4 p-3.5 bg-slate-950/60 border border-slate-800/60 rounded-xl group hover:border-slate-700/60 transition-all"
        >
          <!-- Sequence Badge -->
          <div class="w-6 h-6 rounded bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-slate-400 font-mono">
            {{ idx + 1 }}
          </div>

          <!-- File Icon -->
          <div class="w-10 h-10 rounded-lg flex items-center justify-center bg-rose-500/10 text-rose-400 flex-shrink-0">
             <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
             </svg>
          </div>

          <!-- Info -->
          <div class="flex-grow min-w-0">
            <p class="text-xs font-semibold text-slate-200 truncate">{{ pdf.name }}</p>
            <div class="flex items-center gap-2 mt-1">
               <span class="text-[10px] text-slate-500 font-mono">{{ formatSize(pdf.size) }}</span>
               <span class="w-1 h-1 rounded-full bg-slate-700"></span>
               <span class="text-[10px] text-brand-400 font-bold bg-brand-500/10 px-1.5 py-0.5 rounded">{{ pdf.pageCount }} Hal</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1.5 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              @click="moveFile(idx, -1)"
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
              @click="moveFile(idx, 1)"
              :disabled="idx === pdfFiles.length - 1"
              class="w-9 h-9 p-2 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Pindah ke bawah"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div class="w-px h-5 bg-slate-800 mx-1"></div>
            <button
              type="button"
              @click="removeFile(pdf.id)"
              class="w-9 h-9 p-2 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
              title="Hapus file"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
