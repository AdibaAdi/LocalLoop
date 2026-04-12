function Hero({ onReportClick }) {
  return (
    <section className="relative overflow-hidden bg-[#0D1F0F] px-6 pb-24 pt-20" style={{ background: 'radial-gradient(ellipse at center, #1a3a1a 0%, #0A0A0A 70%)' }}>
      <div className="hero-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(circle_at_center,black_35%,transparent_85%)]" />
      <div className="hero-grid pointer-events-none absolute inset-0 animate-drift opacity-15" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-civic-electric/25 blur-3xl animate-pulseSoft" />

      <div className="relative mx-auto max-w-4xl text-center">
        <p className="mb-5 inline-flex rounded-full border border-civic-electric/50 bg-civic-electric/10 px-4 py-1 text-sm font-medium text-civic-mist">Built for safer, stronger communities</p>
        <h1 className="text-balance text-4xl font-semibold leading-tight text-white md:text-6xl">Your neighborhood. Your voice. <span className="text-civic-electric">Fixed.</span></h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[#6B7280]">Report local issues, rally your neighbors, and help city teams resolve what matters most.</p>

        <div className="relative mt-10 inline-flex">
          <span className="pointer-events-none absolute inset-0 rounded-full bg-civic-electric/45 blur-2xl" />
          <button
            type="button"
            onClick={onReportClick}
            className="relative rounded-full bg-civic-electric px-8 py-3 text-base font-semibold text-white shadow-glow transition duration-300 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_0_35px_rgba(34,197,94,0.7)]"
          >
            Report an Issue
          </button>
        </div>
      </div>
    </section>
  )
}

export default Hero
