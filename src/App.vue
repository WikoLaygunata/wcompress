<script setup>
import { ref, computed, provide } from 'vue'
import ImageCompressor from './components/ImageCompressor.vue'
import BgRemover from './components/BgRemover.vue'
import PdfTools from './components/PdfTools.vue'
import qrisImage from './assets/qris.webp'
import logoImage from './assets/logo.png'

const tabComponents = { compressor: ImageCompressor, bgremover: BgRemover, pdftools: PdfTools }

// Navigation State
const currentTab = ref('compressor')

// Donate Modal State
const showDonateModal = ref(false)

// FAQ Modal State
const showFaqModal = ref(false)

// General Toasts State
const isToastVisible = ref(false)
const toastTitle = ref('')
const toastDesc = ref('')
const toastType = ref('success') // 'success' | 'warning' | 'info' | 'error'
let toastTimeout = null

const showToast = (title, desc, type = 'success') => {
  toastTitle.value = title
  toastDesc.value = desc
  toastType.value = type
  isToastVisible.value = true

  if (toastTimeout) {
    clearTimeout(toastTimeout)
  }

  toastTimeout = setTimeout(() => {
    isToastVisible.value = false
    toastTimeout = null
  }, 4000)
}

// FAQ / Guide State
const faqs = ref([
  {
    question: 'Bagaimana wcompress menjamin keamanan file saya?',
    answer: 'Semua proses pengerjaan (kompresi gambar, penghapusan background AI, pengolahan PDF) berjalan 100% lokal di browsermu menggunakan WebAssembly & JavaScript. Tidak ada file yang dikirim ke server. Kamu bahkan bisa mematikan koneksi internet setelah membuka web ini!',
    isOpen: false
  },
  {
    question: 'Mengapa hasil kompresi PDF mengubah teks menjadi gambar?',
    answer: 'Kami menggunakan metode Client-Side Rasterization (mengubah halaman PDF menjadi gambar lalu menyusunnya kembali). Hal ini membuat ukuran file berkurang drastis dan aman dari masalah font, namun teks di PDF hasil kompresi tidak bisa disalin (copy-paste). Sangat cocok untuk scan dokumen, ijazah, atau portofolio.',
    isOpen: false
  },
  {
    question: 'Apakah fitur AI Hapus BG benar-benar berjalan secara lokal?',
    answer: 'Ya! Kami menggunakan library Transformers.js. Pada pemakaian pertama, browsermu akan mengunduh model AI Xenova MODNet (~25MB). Setelah itu, model akan disimpan di cache lokal browsermu sehingga pemakaian selanjutnya berjalan instan dan 100% offline tanpa menggunakan internet.',
    isOpen: false
  },
  {
    question: 'Format gambar apa saja yang didukung oleh wcompress?',
    answer: 'Kami mendukung format gambar populer seperti JPEG, PNG, WEBP, dan format modern lainnya. Kamu bisa mengompresinya, menghapus backgroundnya secara presisi, atau menggabungkannya menjadi satu file PDF secara instan.',
    isOpen: false
  }
])

const toggleFaq = (index) => {
  faqs.value[index].isOpen = !faqs.value[index].isOpen
}

// Provide toast method to child components
provide('showToast', showToast)
</script>

<template>
  <div
    class="bg-darkBg text-slate-100 min-h-screen font-sans flex flex-col antialiased relative overflow-hidden"
  >
    <!-- Ambient Glow Effects -->
    <div
      class="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/5 rounded-full blur-[120px] pointer-events-none -z-10"
    ></div>
    <div
      class="absolute top-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[150px] pointer-events-none -z-10"
    ></div>
    <!-- Header / Navbar -->
    <header
      class="border-b border-slate-800/80 bg-darkBg/80 backdrop-blur sticky top-0 z-50 transition-all duration-300"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <img
            :src="logoImage"
            class="w-9 h-9 rounded-xl object-cover shadow-lg shadow-brand-500/15 border border-slate-800"
            alt="wcompress logo"
          />
          <div>
            <h1
              class="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent font-display"
            >
              wcompress
            </h1>
            <p class="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
              Client-Side File Engine
            </p>
          </div>
        </div>

        <!-- Badges & Links -->
        <div class="flex items-center gap-4">
          <div
            class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400"
          >
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            100% Aman & Diproses Lokal
          </div>
        </div>
      </div>
    </header>

    <!-- Main Container -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      <!-- Hero Section -->
      <div class="text-center max-w-2xl mx-auto space-y-3">
        <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-display">
          Kompres File Sepuasnya,
          <span class="bg-gradient-to-r from-brand-500 to-emerald-400 bg-clip-text text-transparent"
            >Tanpa Bayar</span
          >
        </h2>
        <p class="text-slate-400 text-sm sm:text-base leading-relaxed">
          Ubah format gambar, hapus background via AI, dan kompres dokumen PDF secara lokal langsung
          di browsermu tanpa mengirim sepeserpun data ke server. Cepat, privat, dan 100% gratis.
        </p>
      </div>

      <!-- Navigation Tabs -->
      <div
        class="flex p-1 max-w-xl mx-auto bg-slate-900/80 border border-slate-800 rounded-xl w-full"
      >
        <button
          @click="currentTab = 'compressor'"
          :class="[
            'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer sm:whitespace-nowrap',
            currentTab === 'compressor'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200',
          ]"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            />
          </svg>
          Kompresor
        </button>

        <button
          @click="currentTab = 'bgremover'"
          :class="[
            'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer sm:whitespace-nowrap',
            currentTab === 'bgremover'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200',
          ]"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
            />
          </svg>
          AI Hapus BG
        </button>

        <button
          @click="currentTab = 'pdftools'"
          :class="[
            'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer sm:whitespace-nowrap',
            currentTab === 'pdftools'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200',
          ]"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          Alat PDF
        </button>
      </div>

      <!-- Feature Tab Rendering -->
      <transition name="fade" mode="out-in">
        <keep-alive>
          <component :is="tabComponents[currentTab]" :key="currentTab" />
        </keep-alive>
      </transition>

    </main>

    <!-- Custom Toast Notification -->
    <div
      :class="[
        'fixed bottom-6 right-6 transform transition-all duration-300 bg-slate-900 border text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 max-w-sm z-[150] pointer-events-none',
        toastType === 'success' ? 'border-emerald-500/25' : '',
        toastType === 'warning' ? 'border-amber-500/25' : '',
        toastType === 'error' ? 'border-rose-500/25' : '',
        toastType === 'info' ? 'border-blue-500/25' : '',
        isToastVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0',
      ]"
    >
      <div
        :class="[
          'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
          toastType === 'success' ? 'bg-emerald-500/15 text-emerald-400' : '',
          toastType === 'warning' ? 'bg-amber-500/15 text-amber-400' : '',
          toastType === 'error' ? 'bg-rose-500/15 text-rose-400' : '',
          toastType === 'info' ? 'bg-blue-500/15 text-blue-400' : '',
        ]"
      >
        <!-- Success Icon -->
        <svg v-if="toastType === 'success'" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
        </svg>
        <!-- Warning Icon -->
        <svg v-else-if="toastType === 'warning'" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <!-- Error Icon -->
        <svg v-else-if="toastType === 'error'" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <!-- Info Icon -->
        <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <p class="text-xs font-bold text-white">{{ toastTitle }}</p>
        <p class="text-[10px] text-slate-400 mt-0.5 leading-tight">{{ toastDesc }}</p>
      </div>
    </div>

    <!-- Footer -->
    <footer class="border-t border-slate-900 bg-darkBg/30 mt-auto py-6">
      <div
        class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500"
      >
        <p>© 2026 wcompress.</p>
        <div class="flex items-center gap-4">
          <span
            >Dibuat oleh
            <a
              href="https://wikolaygunata.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              class="hover:text-slate-300"
              >Wiko Laygunata</a
            ></span
          >
          <span class="text-slate-700">|</span>
          <button
            @click="showFaqModal = true"
            class="flex items-center gap-1.5 hover:text-brand-400 text-slate-400 transition-colors font-semibold cursor-pointer"
          >
            <svg class="w-3.5 h-3.5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.2"
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            FAQ & Panduan
          </button>
          <span class="text-slate-700">|</span>
          <button
            @click="showDonateModal = true"
            class="flex items-center gap-1.5 hover:text-rose-400 text-slate-400 transition-colors font-semibold cursor-pointer"
          >
            <svg class="w-3.5 h-3.5 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                clip-rule="evenodd"
              />
            </svg>
            Dukung Saya
          </button>
        </div>
      </div>
    </footer>

    <!-- FAQ Modal -->
    <transition name="modal-fade">
      <div
        v-if="showFaqModal"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          @click="showFaqModal = false"
          class="absolute inset-0 bg-slate-950/75 backdrop-blur-md"
        ></div>

        <!-- Modal Card -->
        <div
          class="bg-slate-900 border border-slate-800/80 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl relative z-10 transform transition-all duration-300 border-t-2 border-t-brand-500"
        >
          <!-- Header -->
          <div class="p-4 border-b border-slate-800/60 flex items-center justify-between">
            <h3 class="font-bold text-sm text-white flex items-center gap-2">
              <svg class="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2.2"
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              FAQ & Panduan wcompress
            </h3>
            <button
              @click="showFaqModal = false"
              class="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800/50 cursor-pointer"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="p-5 overflow-y-auto max-h-[60vh] space-y-3 custom-scrollbar">
            <div
              v-for="(faq, idx) in faqs"
              :key="idx"
              class="bg-slate-950/40 border border-slate-800/60 rounded-xl overflow-hidden transition-all duration-300 hover:border-slate-800"
            >
              <button
                @click="toggleFaq(idx)"
                class="w-full flex items-center justify-between p-3.5 text-left font-bold text-xs text-slate-200 hover:text-white cursor-pointer select-none"
              >
                <span>{{ faq.question }}</span>
                <svg
                  :class="[
                    'w-3.5 h-3.5 text-slate-500 transition-transform duration-300 flex-shrink-0 ml-4',
                    faq.isOpen ? 'rotate-180 text-brand-400' : ''
                  ]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div
                :class="[
                  'transition-all duration-300 ease-in-out overflow-hidden',
                  faq.isOpen ? 'max-h-40 border-t border-slate-850 opacity-100' : 'max-h-0 opacity-0'
                ]"
              >
                <p class="p-3.5 text-xs text-slate-400 leading-relaxed bg-slate-950/20 font-medium">
                  {{ faq.answer }}
                </p>
              </div>
            </div>
          </div>

          <!-- Footer/Action -->
          <div class="p-4 bg-slate-950/40 border-t border-slate-800/60 flex justify-center">
            <button
              @click="showFaqModal = false"
              class="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl font-bold text-xs transition cursor-pointer active:scale-95"
            >
              Tutup Panduan
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Donate Modal -->
    <transition name="modal-fade">
      <div
        v-if="showDonateModal"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          @click="showDonateModal = false"
          class="absolute inset-0 bg-slate-950/75 backdrop-blur-md"
        ></div>

        <!-- Modal Card -->
        <div
          class="bg-slate-900 border border-slate-800/80 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative z-10 transform transition-all duration-300 border-t-2 border-t-rose-500"
        >
          <!-- Header -->
          <div class="p-4 border-b border-slate-800/60 flex items-center justify-between">
            <h3 class="font-bold text-sm text-white flex items-center gap-2">
              <svg class="w-4 h-4 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                  clip-rule="evenodd"
                />
              </svg>
              Dukung wcompress
            </h3>
            <button
              @click="showDonateModal = false"
              class="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800/50 cursor-pointer"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 flex flex-col items-center text-center space-y-4">
            <p class="text-xs text-slate-300 leading-relaxed max-w-[280px]">
              Dukungan Anda sangat berarti untuk membantu biaya server & pengembangan wcompress agar
              tetap gratis & tanpa iklan!
            </p>

            <!-- QRIS Image Container -->
            <div
              class="bg-white p-3 rounded-xl shadow-inner border border-slate-200 flex items-center justify-center relative overflow-hidden group"
            >
              <img
                :src="qrisImage"
                class="w-56 h-auto object-contain rounded"
                alt="QRIS Wiko Laygunata"
              />
            </div>

            <!-- Hint / Instruction -->
            <div class="space-y-1">
              <p class="text-[10px] font-bold text-rose-400 tracking-wide uppercase">QRIS / GPN</p>
              <p class="text-[10px] text-slate-400 leading-normal max-w-[240px]">
                Scan QRIS di atas menggunakan aplikasi perbankan atau e-wallet
              </p>
            </div>
          </div>

          <!-- Footer/Action -->
          <div class="p-4 bg-slate-950/40 border-t border-slate-800/60 flex justify-center">
            <button
              @click="showDonateModal = false"
              class="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl font-bold text-xs transition cursor-pointer active:scale-95"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

/* Modal Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .transform,
.modal-fade-leave-active .transform {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-enter-from .transform,
.modal-fade-leave-to .transform {
  transform: scale(0.95) translateY(8px);
}
</style>
