import { createRouter, createWebHistory } from 'vue-router'
import ImageCompressor from '../components/ImageCompressor.vue'
import BgRemover from '../components/BgRemover.vue'
import PdfCompressor from '../components/PdfCompressor.vue'
import ImageToPdf from '../components/ImageToPdf.vue'
import PdfDismantle from '../components/PdfDismantle.vue'
import PdfMerge from '../components/PdfMerge.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: ImageCompressor,
      meta: { tab: 'compressor' },
    },
    {
      path: '/kompres-gambar',
      name: 'image-compressor',
      component: ImageCompressor,
      meta: { tab: 'compressor' },
    },
    {
      path: '/hapus-background',
      name: 'background-remover',
      component: BgRemover,
      meta: { tab: 'bgremover' },
    },
    {
      path: '/kompres-pdf',
      name: 'pdf-compress',
      component: PdfCompressor,
      meta: { tab: 'pdftools', pdfSubTab: 'compress' },
    },
    {
      path: '/gambar-ke-pdf',
      name: 'image-to-pdf',
      component: ImageToPdf,
      meta: { tab: 'pdftools', pdfSubTab: 'img2pdf' },
    },
    {
      path: '/pecah-pdf',
      name: 'pdf-dismantle',
      component: PdfDismantle,
      meta: { tab: 'pdftools', pdfSubTab: 'dismantle' },
    },
    {
      path: '/gabung-pdf',
      name: 'pdf-merge',
      component: PdfMerge,
      meta: { tab: 'pdftools', pdfSubTab: 'merge' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

export default router
