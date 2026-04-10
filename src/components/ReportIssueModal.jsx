import { useEffect, useMemo, useRef, useState } from 'react'
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

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

function ReportIssueModal({ isOpen, onClose }) {
  const fileInputRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoBase64, setPhotoBase64] = useState('')
  const [loadingLocation, setLoadingLocation] = useState(false)
  const [location, setLocation] = useState({ lat: null, lng: null, address: '' })
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [category, setCategory] = useState('Other')
  const [severity, setSeverity] = useState('Low')
  const [description, setDescription] = useState('')
  const [aiLetter, setAiLetter] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const fetchLocation = async () => {
      if (!navigator.geolocation) return
      setLoadingLocation(true)
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
          } catch {
            setLocation({ lat, lng, address: `${lat}, ${lng}` })
          } finally {
            setLoadingLocation(false)
          }
        },
        () => setLoadingLocation(false),
        { enableHighAccuracy: true, timeout: 12000 }
      )
    }

    fetchLocation()
  }, [isOpen])

  const uploadFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPhotoFile(file)
    setPreviewUrl(URL.createObjectURL(file))

    const reader = new FileReader()
    reader.onloadend = () => setPhotoBase64(String(reader.result))
    reader.readAsDataURL(file)
  }

  const runGeminiAnalysis = async () => {
    if (!photoFile) return
    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY
    if (!geminiApiKey) return

    setAnalysisLoading(true)
    try {
      const base64 = photoBase64.split(',')[1]
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Classify issue, severity, concise description and formal city complaint letter as JSON.' }, { inline_data: { mime_type: photoFile.type, data: base64 } }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      )
      const data = await response.json()
      const parsed = JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
      setCategory(CATEGORIES.includes(parsed.category) ? parsed.category : 'Other')
      setSeverity(['Low', 'Medium', 'Critical'].includes(parsed.severity) ? parsed.severity : 'Medium')
      setDescription(parsed.description || '')
      setAiLetter(parsed.ai_letter || '')
    } catch (error) {
      console.error(error)
    } finally {
      setAnalysisLoading(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!photoBase64 || !location.lat || !location.lng) return

    setSubmitLoading(true)
    try {
      const reportRef = doc(collection(db, 'reports'))
      await setDoc(reportRef, {
        id: reportRef.id,
        photo_base64: photoBase64,
        location,
        category,
        severity,
        description,
        ai_analysis: description,
        ai_letter: aiLetter,
        upvotes: 0,
        status: 'Open',
        timestamp: serverTimestamp(),
      })
      onClose()
    } catch (error) {
      console.error(error)
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
      <div className="fixed inset-0 z-50 bg-civic-night/65 backdrop-blur-md" onClick={onClose} />
      <section className="fixed inset-0 z-[55] flex items-center justify-center px-4 py-8">
        <form onSubmit={handleSubmit} className="glass-card relative max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-3xl border-white/20 p-6 md:p-8">
          <div className="mb-6 flex items-start justify-between gap-6">
            <div>
              <h2 className="text-2xl font-semibold text-white">Report an Issue</h2>
              <p className="mt-2 text-sm text-white/65">Upload a photo and let AI help draft your civic report.</p>
            </div>
            <button type="button" className="text-white/60 transition hover:text-white" onClick={onClose}>✕</button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="relative flex min-h-72 w-full items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 transition hover:bg-white/10">
                {previewUrl ? <img src={previewUrl} alt="Issue preview" className="h-full max-h-96 w-full rounded-xl object-cover" /> : <div className="text-center"><p className="text-base font-medium text-white">Drag/drop or click image</p></div>}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={(event) => uploadFile(event.target.files?.[0])} className="hidden" />

              <div className="glass-card rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Detected location</p>
                <p className="mt-2 text-sm text-white/80">{loadingLocation ? 'Detecting location...' : location.address || 'Unknown location'}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">AI Analysis</p>
                  <button type="button" disabled={!photoFile || analysisLoading} onClick={runGeminiAnalysis} className="rounded-full border border-civic-electric/60 bg-civic-electric/20 px-4 py-1.5 text-xs font-semibold text-civic-mist transition hover:bg-civic-electric/30 disabled:opacity-40">{analysisLoading ? 'Analyzing…' : 'Run analysis'}</button>
                </div>
                <div className="mt-4 space-y-3">
                  {analysisLoading ? skeleton : <><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">{category}</span><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${SEVERITY_STYLES[severity] || SEVERITY_STYLES.Medium}`}>{severity}</span></div><TypewriterText text={aiLetter || 'Run AI analysis to auto-generate the complaint letter.'} /></>}
                </div>
              </div>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-white/50">Issue description</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-civic-electric" placeholder="Describe what is happening and why it needs city attention." required />
              </label>

              <button type="submit" disabled={submitLoading || !photoBase64 || !location.lat || !location.lng} className="w-full rounded-2xl bg-civic-electric px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50">{submitLoading ? 'Publishing report…' : 'Submit report'}</button>
            </div>
          </div>
        </form>
      </section>
    </>
  )
}

export default ReportIssueModal
