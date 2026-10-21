import { nextTick } from 'vue'

/**
 * Scrolls smoothly to a target element on mobile/tablet viewports (< 1024px)
 * where the controls and results/preview panels are stacked vertically.
 * 
 * @param {import('vue').Ref<HTMLElement>|HTMLElement} target - Vue ref or DOM element
 * @param {number} offset - Offset in pixels (default 80px to accommodate sticky header)
 */
export const scrollToPreview = (target, offset = 80) => {
  nextTick(() => {
    setTimeout(() => {
      if (typeof window === 'undefined') return
      const el = target && target.value !== undefined ? target.value : target
      if (window.innerWidth < 1024 && el && el.getBoundingClientRect) {
        const elementPosition = el.getBoundingClientRect().top + window.scrollY
        const offsetPosition = Math.max(0, elementPosition - offset)
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth',
        })
      }
    }, 80)
  })
}
