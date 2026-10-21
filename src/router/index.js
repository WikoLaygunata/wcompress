import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      meta: { tab: 'compressor' },
    },
    {
      path: '/kompres-gambar',
      name: 'image-compressor',
      meta: { tab: 'compressor' },
    },
    {
      path: '/hapus-background',
      name: 'background-remover',
      meta: { tab: 'bgremover' },
    },
    {
      path: '/kompres-pdf',
      name: 'pdf-compress',
      meta: { tab: 'pdftools', pdfSubTab: 'compress' },
    },
    {
      path: '/gambar-ke-pdf',
      name: 'image-to-pdf',
      meta: { tab: 'pdftools', pdfSubTab: 'img2pdf' },
    },
    {
      path: '/pecah-pdf',
      name: 'pdf-dismantle',
      meta: { tab: 'pdftools', pdfSubTab: 'dismantle' },
    },
    {
      path: '/gabung-pdf',
      name: 'pdf-merge',
      meta: { tab: 'pdftools', pdfSubTab: 'merge' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

export default router
