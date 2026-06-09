<script setup>
import { ref, provide } from 'vue'
import ImageCompressor from './components/ImageCompressor.vue'
import BgRemover from './components/BgRemover.vue'

// Navigation State
const currentTab = ref('compressor')

// General Toasts State
const isToastVisible = ref(false)
const toastTitle = ref('')
const toastDesc = ref('')

const showToast = (title, desc) => {
  toastTitle.value = title
  toastDesc.value = desc
  isToastVisible.value = true
  setTimeout(() => {
    isToastVisible.value = false
  }, 4000)
}

// Provide toast method to child components
provide('showToast', showToast)
</script>

<template>
  <div class="bg-darkBg text-slate-100 min-h-screen font-sans flex flex-col antialiased">
    <!-- Header / Navbar -->
    <header
      class="border-b border-slate-800/80 bg-darkBg/80 backdrop-blur sticky top-0 z-50 transition-all duration-300"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-brand-500/20"
          >
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h1
              class="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent"
            >
              wcompress
            </h1>
            <p class="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
              Client-Side Image Engine
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
          <div
            class="px-2.5 py-1 text-xs font-semibold text-brand-500 bg-brand-500/10 rounded-md border border-brand-500/20 uppercase tracking-widest"
          >
            PROTOTYPE
          </div>
        </div>
      </div>
    </header>

    <!-- Main Container -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      <!-- Hero Section -->
      <div class="text-center max-w-2xl mx-auto space-y-3">
        <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Kompres Gambar Sepuasnya,
          <span class="bg-gradient-to-r from-brand-500 to-emerald-400 bg-clip-text text-transparent"
            >Tanpa Bayar</span
          >
        </h2>
        <p class="text-slate-400 text-sm sm:text-base leading-relaxed">
          Ubah format, perkecil resolusi, dan hapus background menggunakan AI secara lokal langsung
          di browsermu tanpa mengirim sepeserpun data ke server. Cepat, privat, dan 100% gratis.
        </p>
      </div>

      <!-- Navigation Tabs -->
      <div
        class="flex p-1 max-w-md mx-auto bg-slate-900/80 border border-slate-800 rounded-xl w-full sm:w-auto"
      >
        <button
          @click="currentTab = 'compressor'"
          :class="[
            'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer',
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
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 11-3-3 3 3 0 013 3z"
            />
          </svg>
          Kompresor Kustom
        </button>

        <button
          @click="currentTab = 'bgremover'"
          :class="[
            'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer',
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
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
          AI Hapus BG
        </button>
      </div>

      <!-- Feature Tab Rendering -->
      <transition name="fade" mode="out-in">
        <ImageCompressor v-if="currentTab === 'compressor'" />
        <BgRemover v-else-if="currentTab === 'bgremover'" />
      </transition>
    </main>

    <!-- Custom Toast Notification -->
    <div
      :class="[
        'fixed bottom-6 right-6 transform transition-all duration-300 bg-slate-900 border border-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 max-w-sm z-50 pointer-events-none',
        isToastVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0',
      ]"
    >
      <div
        class="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="3"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
      <div>
        <p class="text-xs font-bold">{{ toastTitle }}</p>
        <p class="text-[10px] text-slate-400 mt-0.5">{{ toastDesc }}</p>
      </div>
    </div>

    <!-- Footer -->
    <footer class="border-t border-slate-900 bg-darkBg/30 mt-auto py-6">
      <div
        class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500"
      >
        <p>© 2026 wcompress.</p>
        <div class="flex gap-4">
          Dibuat oleh
          <a href="https://wikolaygunata.vercel.app" target="_blank" class="hover:text-slate-300"
            >Wiko Laygunata</a
          >
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
