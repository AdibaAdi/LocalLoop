import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addDoc, collection, serverTimestamp, updateDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const CATEGORIES = ['Pothole', 'Flooding', 'Broken Light', 'Graffiti', 'Safety Hazard', 'Other']

const SEVERITY_STYLES = {
  Low: 'bg-emerald-500/20 text-emerald-200 border-emerald-300/30',
  Medium: 'bg-amber-500/20 text-amber-100 border-amber-300/30',
  Critical: 'bg-red-500/20 text-red-100 border-red-300/30',
}

function TypewriterText({ text, speed = 12 }) {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    setDisplayed('')
    if (!text) return
    let index = 0
    const timer = setInterval(() => {
      index += 1
      setDisplayed(text.slice(0, index))
      if (index >= text.length) clearInterval(timer)
    }, speed)
    return () => clearInterval(timer)
  }, [text, speed])

  return <p className="whitespace-pre-line text-sm leading-relaxed text-white/80">{displayed}</p>
}

function ReportIssueModal({ isOpen, onClose, onSubmitSuccess }) {
  const fileInputRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoBase64, setPhotoBase64] = useState('')
  const [loadingLocation, setLoadingLocation] = useState(false)
  const [location, setLocation] = useState({ lat: null, lng: null, address: '' })
  const [locationFailed, setLocationFailed] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisQueued, setAnalysisQueued] = useState(false)
  const [category, setCategory] = useState('Other')
  const [severity, setSeverity] = useState('Low')
  const [description, setDescription] = useState('')
  const [aiLetter, setAiLetter] = useState('')
  const [suggestedTitle, setSuggestedTitle] = useState('')
  const [showLetter, setShowLetter] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [analysisMode, setAnalysisMode] = useState('auto')

  useEffect(() => {
    if (!isOpen) return

    const fallbackLocation = {
      address: 'Location unavailable - enter manually',
      lat: 0,
      lng: 0,
    }

    const fetchLocation = async () => {
      setLoadingLocation(true)
      if (!navigator.geolocation) {
        setLocation(fallbackLocation)
        setLocationFailed(true)
        setLoadingLocation(false)
        return
      }

      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          const lat = Number(coords.latitude.toFixed(6))
          const lng = Number(coords.longitude.toFixed(6))

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
            )
            const data = await response.json()
            setLocation({ lat, lng, address: data.display_name || `${lat}, ${lng}` })
            setLocationFailed(false)
          } catch {
            setLocation({ lat, lng, address: `${lat}, ${lng}` })
            setLocationFailed(false)
          } finally {
            setLoadingLocation(false)
          }
        },
        () => {
          setLocation(fallbackLocation)
          setLocationFailed(true)
          setLoadingLocation(false)
        },
        { timeout: 10000, maximumAge: 60000 }
      )
    }

    fetchLocation()
  }, [isOpen])

  const uploadFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setAnalysisQueued(false)
    setAnalysisMode('auto')
    setShowLetter(false)
    setAiLetter('')
    setSuggestedTitle('')
    setPhotoFile(file)
    setPreviewUrl(URL.createObjectURL(file))

    const reader = new FileReader()
    reader.onloadend = () => setPhotoBase64(String(reader.result))
    reader.readAsDataURL(file)
  }

  const runGeminiAnalysis = useCallback(async () => {
    if (!photoFile || !photoBase64 || analysisLoading) return
    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY
    if (!geminiApiKey) {
      setAnalysisMode('manual')
      return
    }

    setAnalysisLoading(true)
    try {
      const base64 = photoBase64.split(',')[1]
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Analyze this image of a neighborhood issue. Return JSON only:
{
  "category": "one of [Pothole, Flooding, Broken Light, Graffiti, Safety Hazard, Other]",
  "severity": "one of [Low, Medium, Critical]",
  "summary": "one sentence description of the issue",
  "complaint_letter": "a formal 3-paragraph complaint letter to the Chicago Department of Transportation or relevant city department",
  "suggested_title": "a short 5-8 word title for this report"
}`,
                  },
                  { inline_data: { mime_type: photoFile.type, data: base64 } },
                ],
              },
            ],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      )
      const data = await response.json()
      const parsed = JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
      setCategory(CATEGORIES.includes(parsed.category) ? parsed.category : 'Other')
      setSeverity(['Low', 'Medium', 'Critical'].includes(parsed.severity) ? parsed.severity : 'Medium')
      setDescription(parsed.summary || '')
      setAiLetter(parsed.complaint_letter || '')
      setSuggestedTitle(parsed.suggested_title || '')
      setShowLetter(true)
      setAnalysisQueued(true)
      setAnalysisMode('auto')
    } catch (error) {
      console.error('Gemini analysis failed:', error)
      setAnalysisMode('manual')
    } finally {
      setAnalysisLoading(false)
    }
  }, [analysisLoading, photoBase64, photoFile])

  useEffect(() => {
    if (!photoFile || !photoBase64 || analysisQueued) return
    const timer = setTimeout(() => {
      runGeminiAnalysis()
    }, 2000)
    return () => clearTimeout(timer)
  }, [photoFile, photoBase64, analysisQueued, runGeminiAnalysis])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(timer)
  }, [toast])

  const handleSubmit = async (event) => {
    event.preventDefault()
    console.log('Starting submit...')

    if (!photoBase64 || !description.trim()) {
      console.error('Submit blocked: photo and description are required')
      return
    }

    setSubmitLoading(true)

    const reportData = {
      photo_url: photoBase64,
      location,
      category,
      severity,
      description: description.trim(),
      ai_letter: aiLetter,
      complaint_letter: aiLetter,
      suggested_title: suggestedTitle,
      upvotes: 0,
      status: 'open',
      timestamp: serverTimestamp(),
      userId: auth.currentUser?.uid || 'anonymous',
      userName: auth.currentUser?.displayName || 'Anonymous',
    }

    console.log('db:', db)
    console.log('data:', reportData)

    try {
      const reportRef = await addDoc(collection(db, 'reports'), reportData)
      await updateDoc(reportRef, { id: reportRef.id })
      setToast('✅ Report submitted successfully!')
      onSubmitSuccess?.()
      onClose?.()
    } catch (e) {
      console.error('Firestore addDoc failed:', e)
      alert(e?.message || 'Failed to submit report')
    } finally {
      setSubmitLoading(false)
    }
  }

  const skeleton = useMemo(
    () => (
      <div className="space-y-2 animate-pulse">
        <div className="h-3 w-1/2 rounded bg-white/20" />
        <div className="h-3 rounded bg-white/15" />
        <div className="h-3 w-3/4 rounded bg-white/15" />
      </div>
    ),
    []
  )

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-civic-night/65 backdrop-blur-md" onClick={onClose} />
      <section className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-8">
        <form onSubmit={handleSubmit} className="glass-card relative max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-3xl border-white/20 p-6 md:p-8">
          {toast ? (
            <div className="mb-4 rounded-xl border border-emerald-300/30 bg-emerald-500/20 px-4 py-2 text-sm text-emerald-100">
              {toast}
            </div>
          ) : null}
          <div className="mb-6 flex items-start justify-between gap-6">
            <div>
              <h2 className="text-2xl font-semibold text-white">Report an Issue</h2>
              <p className="mt-2 text-sm text-white/65">Upload a photo and let AI help draft your civic report.</p>
            </div>
            <button type="button" className="text-white/60 transition hover:text-white" onClick={onClose}>✕</button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDrop={(event) => {
                  event.preventDefault()
                  uploadFile(event.dataTransfer.files?.[0])
                }}
                onDragOver={(event) => event.preventDefault()}
                className="relative flex min-h-72 w-full items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 transition hover:bg-white/10"
              >
                {previewUrl ? <img src={previewUrl} alt="Issue preview" className="h-full max-h-96 w-full rounded-xl object-cover" /> : <div className="text-center"><p className="text-base font-medium text-white">Drag/drop or click image</p></div>}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={(event) => uploadFile(event.target.files?.[0])} className="hidden" />

              <div className="glass-card rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Detected location</p>
                <p className="mt-2 text-sm text-white/80">{loadingLocation ? 'Detecting location...' : location.address || 'Unknown location'}</p>
                {locationFailed ? (
                  <input
                    type="text"
                    value={location.address}
                    onChange={(event) =>
                      setLocation((prev) => ({
                        ...prev,
                        address: event.target.value,
                      }))
                    }
                    placeholder="Enter your address manually"
                    className="mt-3 w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-civic-electric"
                  />
                ) : null}
              </div>
            </div>

            <div className="space-y-4">
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">AI Analysis</p>
                  <span className="rounded-full border border-civic-electric/40 bg-civic-electric/15 px-3 py-1 text-[11px] font-semibold text-civic-mist">Powered by Gemini ✨</span>
                  <span className="rounded-full border border-civic-electric/60 bg-civic-electric/20 px-4 py-1.5 text-xs font-semibold text-civic-mist">
                    {analysisLoading ? 'Analyzing…' : photoFile ? 'Auto-runs in 2s after upload' : 'Upload image to start'}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {analysisLoading ? (
                    <div className="rounded-xl border border-civic-electric/35 bg-civic-electric/10 p-4 text-sm font-medium text-civic-mist">
                      <p className="animate-pulse">🤖 Gemini is analyzing your photo<span className="inline-block w-8 animate-pulse">...</span></p>
                      <div className="mt-3">{skeleton}</div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">{category}</span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${SEVERITY_STYLES[severity] || SEVERITY_STYLES.Medium}`}>{severity}</span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${analysisMode === 'manual' ? 'border-amber-300/40 bg-amber-500/20 text-amber-100' : 'border-cyan-300/35 bg-cyan-500/20 text-cyan-100'}`}>{analysisMode === 'manual' ? 'Manual' : 'AI'}</span>
                      </div>
                      {suggestedTitle ? (
                        <p className="text-sm text-white/80">
                          <span className="text-white/55">Suggested title:</span> {suggestedTitle}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setShowLetter((prev) => !prev)}
                        className="text-left text-sm font-medium text-cyan-100 underline decoration-cyan-300/60 underline-offset-2"
                      >
                        📄 View AI-Generated Complaint Letter {showLetter ? '▲' : '▼'}
                      </button>
                      {showLetter ? (
                        <div className="rounded-xl border border-white/20 bg-white/5 p-3">
                          <TypewriterText text={aiLetter || 'Run AI analysis to auto-generate the full complaint letter.'} />
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setAnalysisQueued(false)
                          runGeminiAnalysis()
                        }}
                        disabled={!photoFile || !photoBase64 || analysisLoading}
                        className="rounded-xl border border-civic-electric/40 bg-civic-electric/15 px-3 py-2 text-xs font-semibold text-civic-mist transition hover:bg-civic-electric/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ✨ Regenerate
                      </button>
                    </>
                  )}
                </div>
              </div>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-white/50">Category</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-civic-night px-4 py-3 text-sm text-white outline-none transition focus:border-civic-electric"
                >
                  {CATEGORIES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-white/50">Issue description</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-civic-electric" placeholder="Describe what is happening and why it needs city attention." required />
              </label>

              <button type="submit" disabled={submitLoading || !description.trim()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-civic-electric px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70">{submitLoading ? <><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Saving report…</> : 'Submit report'}</button>
            </div>
          </div>
        </form>
      </section>
    </>
  )
}

export default ReportIssueModal
