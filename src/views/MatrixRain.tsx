import { useEffect, useRef } from 'react'

const GLYPHS =
  'ｦｧｨｩｪｫｬｭｮｯｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEFGHJKLMNPRSTUVWXYZ'

function pick() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? '0'
}

type Column = {
  y: number
  delay: number
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
    let fontSize = 16
    let stepX = 18
    let last = 0

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = false
      fontSize = w < 700 ? 14 : 15
      stepX = fontSize + 5
      const count = Math.max(16, Math.ceil(w / stepX))
      const rows = Math.ceil(h / fontSize) + 4
      cols = Array.from({ length: count }, () => ({
        y: Math.floor(Math.random() * rows),
        delay: Math.floor(Math.random() * 4),
        glyphs: Array.from({ length: 16 + Math.floor(Math.random() * 12) }, pick),
      }))
      ctx.fillStyle = '#010301'
      ctx.fillRect(0, 0, w, h)
      last = 0
    }

    const draw = (t: number) => {
      if (!running) return
      raf = requestAnimationFrame(draw)
      if (document.hidden) return
      if (t - last < 55) return
      last = t

      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const rows = Math.ceil(h / fontSize)
      ctx.fillStyle = 'rgba(0, 4, 0, 0.45)'
      ctx.fillRect(0, 0, w, h)
      ctx.font = `${fontSize}px "Menlo", "Hiragino Kaku Gothic ProN", "Yu Gothic", "MS Gothic", Consolas, monospace`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.shadowBlur = 0

      for (let i = 0; i < cols.length; i++) {
        const col = cols[i]
        const x = Math.round(i * stepX + stepX / 2)

        for (let tIdx = 0; tIdx < col.glyphs.length; tIdx++) {
          const row = col.y - tIdx
          if (row < 0 || row > rows) continue
          const y = Math.round(row * fontSize + fontSize / 2)
          if (Math.random() > 0.985) col.glyphs[tIdx] = pick()
          const ch = col.glyphs[tIdx]
          const fade = 1 - tIdx / col.glyphs.length
          if (tIdx === 0) ctx.fillStyle = '#f3fff4'
          else if (tIdx === 1) ctx.fillStyle = '#b6ffc2'
          else ctx.fillStyle = `rgba(80, ${Math.floor(160 + fade * 80)}, 90, ${0.7 + fade * 0.3})`
          ctx.fillText(ch, x, y)
        }

        if (col.delay > 0) {
          col.delay -= 1
          continue
        }
        col.y += 1
        if (col.y - col.glyphs.length > rows) {
          col.y = 0
          col.delay = 2 + Math.floor(Math.random() * 10)
          col.glyphs = Array.from({ length: 16 + Math.floor(Math.random() * 12) }, pick)
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
