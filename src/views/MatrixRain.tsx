import { useEffect, useRef } from 'react'

const GLYPHS =
  'ｦｧｨｩｪｫｬｭｮｯｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789<>*+-=:.¦'

function pick() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? '0'
}

type Column = {
  y: number
  speed: number
  glyphs: string[]
}

export function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let raf = 0
    let running = true
    let cols: Column[] = []
    let fontSize = 18
    let last = 0

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      fontSize = w < 700 ? 15 : 18
      const count = Math.max(24, Math.ceil(w / fontSize))
      const rows = Math.ceil(h / fontSize) + 18
      cols = Array.from({ length: count }, () => ({
        y: Math.random() * rows * -1,
        speed: 0.45 + Math.random() * 1.15,
        glyphs: Array.from({ length: 12 + Math.floor(Math.random() * 22) }, pick),
      }))
      ctx.fillStyle = '#010301'
      ctx.fillRect(0, 0, w, h)
    }

    const draw = (t: number) => {
      if (!running) return
      raf = requestAnimationFrame(draw)
      if (document.hidden) return
      if (t - last < 32) return
      last = t

      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.fillStyle = 'rgba(0, 4, 0, 0.14)'
      ctx.fillRect(0, 0, w, h)
      ctx.font = `${fontSize}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`
      ctx.textBaseline = 'top'

      for (let i = 0; i < cols.length; i++) {
        const col = cols[i]
        const x = i * fontSize
        const head = col.y

        for (let tIdx = 0; tIdx < col.glyphs.length; tIdx++) {
          const row = head - tIdx
          const y = row * fontSize
          if (y < -fontSize || y > h) continue
          if (Math.random() > 0.96) col.glyphs[tIdx] = pick()
          const ch = col.glyphs[tIdx]
          if (tIdx === 0) {
            ctx.shadowColor = '#7cff9a'
            ctx.shadowBlur = 10
            ctx.fillStyle = '#e8ffe9'
          } else if (tIdx < 3) {
            ctx.shadowBlur = 4
            ctx.shadowColor = '#00ff62'
            ctx.fillStyle = '#5dff7a'
          } else {
            ctx.shadowBlur = 0
            const fade = 1 - tIdx / col.glyphs.length
            const g = Math.floor(70 + fade * 140)
            ctx.fillStyle = `rgba(0, ${g}, ${Math.floor(20 + fade * 40)}, ${0.25 + fade * 0.75})`
          }
          ctx.fillText(ch, x, y)
        }

        col.y += col.speed
        if ((col.y - col.glyphs.length) * fontSize > h) {
          if (Math.random() > 0.96) {
            col.y = Math.random() * -24
            col.speed = 0.45 + Math.random() * 1.15
            col.glyphs = Array.from({ length: 12 + Math.floor(Math.random() * 22) }, pick)
          }
        }
      }
    }

    const onVis = () => {
      if (!document.hidden) last = 0
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()
    raf = requestAnimationFrame(draw)
    document.addEventListener('visibilitychange', onVis)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return <canvas className="gate-rain" ref={ref} aria-hidden />
}
