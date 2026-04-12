import { useEffect, useMemo, useState } from 'react'
import useCountUpOnView from '../hooks/useCountUpOnView'

const Stat = ({ label, value }) => {
  const { count, elementRef } = useCountUpOnView(value)

  return (
    <article ref={elementRef} className="rounded-2xl border border-[rgba(34,197,94,0.15)] bg-[#1C1C1C] px-8 py-7 text-center shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
      <p className="text-4xl font-bold tracking-tight text-civic-electric">
        {count.toLocaleString()}
      </p>
      <p className="mt-2 text-sm uppercase tracking-[0.15em] text-civic-mist">{label}</p>
    </article>
  )
}

function StatsCounter() {
  const [mountedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 60_000)

    return () => window.clearInterval(intervalId)
  }, [])

  const minutesAgo = useMemo(() => Math.max(0, Math.floor((now - mountedAt) / 60_000)), [mountedAt, now])

  return (
    <section className="px-6 pb-20">
      <div className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-3">
        <Stat value={1247} label="Chicago issues reported" />
        <Stat value={634} label="resolved" />
        <Stat value={77} label="neighborhoods" />
      </div>
      <p className="mx-auto mt-3 w-full max-w-5xl text-center text-xs text-civic-mist/70">
        Last updated: {minutesAgo} {minutesAgo === 1 ? 'minute' : 'minutes'} ago
      </p>
    </section>
  )
}

export default StatsCounter
