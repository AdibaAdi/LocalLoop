import useFadeInOnView from '../hooks/useFadeInOnView'

const STEPS = [
  { icon: '📸', title: 'Snap', text: 'Take a photo of the issue and submit it in seconds.' },
  { icon: '🤖', title: 'AI Analyzes', text: 'Gemini categorizes severity and drafts a clear report.' },
  { icon: '🏛️', title: 'City Gets Notified', text: 'Your report is visible in the dashboard for civic action.' },
]

function StepCard({ icon, title, text, index }) {
  const { elementRef, isVisible } = useFadeInOnView(0.25)

  return (
    <article
      ref={elementRef}
      style={{ transitionDelay: `${index * 120}ms` }}
      className={`glass-card rounded-2xl border-white/20 p-6 transition-all duration-700 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}
    >
      <p className="text-3xl">{icon}</p>
      <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-white/70">{text}</p>
    </article>
  )
}

function HowItWorks() {
  return (
    <section className="px-6 pb-16">
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
