import useFadeInOnView from '../hooks/useFadeInOnView'

const STEPS = [
  { title: 'Step 1', text: '📸 Spot an issue in your Chicago neighborhood' },
  { title: 'Step 2', text: '🤖 Gemini AI analyzes and drafts your city report' },
  { title: 'Step 3', text: '🏛️ Chicago city departments get notified automatically' },
]

function StepCard({ title, text, index }) {
  const { elementRef, isVisible } = useFadeInOnView(0.25)

  return (
    <article
      ref={elementRef}
      style={{ transitionDelay: `${index * 120}ms` }}
      className={`glass-card rounded-2xl border-white/20 p-6 transition-all duration-700 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}
    >
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm text-civic-mist">{text}</p>
    </article>
  )
}

function HowItWorks() {
  return (
    <section className="bg-[#111811] px-6 pb-16 pt-2">
      <div className="mx-auto w-full max-w-5xl">
        <h2 className="text-center text-3xl font-semibold text-white md:text-4xl">How it Works</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <StepCard key={step.title} {...step} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default HowItWorks
