import useCountUpOnView from '../hooks/useCountUpOnView'

const Stat = ({ label, value }) => {
  const { count, elementRef } = useCountUpOnView(value)

  return (
    <article ref={elementRef} className="glass-card rounded-2xl px-8 py-7 text-center">
      <p className="text-4xl font-bold tracking-tight text-civic-electric">
        {count.toLocaleString()}
      </p>
      <p className="mt-2 text-sm uppercase tracking-[0.15em] text-white/70">{label}</p>
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
