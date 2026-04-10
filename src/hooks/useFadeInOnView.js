import { useEffect, useRef, useState } from 'react'

function useFadeInOnView(threshold = 0.2) {
  const elementRef = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const node = elementRef.current
    if (!node || isVisible) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (!entry.isIntersecting) return
        setIsVisible(true)
        observer.disconnect()
      },
      { threshold }
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [isVisible, threshold])

  return { elementRef, isVisible }
}

export default useFadeInOnView
