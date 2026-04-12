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
  return (
    <section className="px-6 pb-20">
      <div className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-3">
        <Stat value={2341} label="issues reported" />
        <Stat value={891} label="resolved" />
        <Stat value={47} label="cities active" />
      </div>
    </section>
  )
}

export default StatsCounter
