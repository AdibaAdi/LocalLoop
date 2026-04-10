import { useEffect, useMemo, useRef, useState } from 'react'
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../lib/firebase'

const CATEGORIES = ['Pothole', 'Flooding', 'Broken Light', 'Graffiti', 'Safety Hazard', 'Other']

const SEVERITY_STYLES = {
  Low: 'bg-emerald-500/20 text-emerald-200 border-emerald-300/30',
  Medium: 'bg-amber-500/20 text-amber-100 border-amber-300/30',
  Critical: 'bg-red-500/20 text-red-100 border-red-300/30',
}

const ANALYSIS_SKELETON = (
  <div className="space-y-3 animate-pulse">
    <div className="h-4 w-32 rounded bg-white/20" />
    <div className="h-3 w-full rounded bg-white/15" />
    <div className="h-3 w-4/5 rounded bg-white/15" />
    <div className="h-3 w-2/3 rounded bg-white/15" />
  </div>
)

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

function ConfettiOverlay({ show }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 26 }).map((_, index) => ({
        id: index,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 0.6}s`,
        duration: `${2.2 + Math.random() * 1.2}s`,
      })),
    []
  )

  if (!show) return null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="confetti-piece absolute top-0 block h-3 w-2 rounded-full"
          style={{ left: piece.left, animationDelay: piece.delay, animationDuration: piece.duration }}
        />
      ))}
    </div>
  )
}

function ReportIssueModal({ isOpen, onClose }) {
  const fileInputRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [loadingLocation, setLoadingLocation] = useState(false)
  const [location, setLocation] = useState({ lat: null, lng: null, address: '' })
  const [locationError, setLocationError] = useState('')
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [category, setCategory] = useState('Other')
  const [severity, setSeverity] = useState('Low')
  const [description, setDescription] = useState('')
  const [aiLetter, setAiLetter] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const fetchLocation = async () => {
      if (!navigator.geolocation) {
        setLocationError('Geolocation is not available in this browser.')
        return
      }

      setLoadingLocation(true)
      setLocationError('')

      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          const lat = Number(coords.latitude.toFixed(6))
          const lng = Number(coords.longitude.toFixed(6))
          const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

          try {
            let address = `${lat}, ${lng}`
            if (googleMapsApiKey) {
              const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleMapsApiKey}`
              )
              const data = await response.json()
              const candidate = data?.results?.[0]?.formatted_address
              if (candidate) address = candidate
            }
            setLocation({ lat, lng, address })
          } catch (error) {
            console.error('Reverse geocode failed', error)
            setLocation({ lat, lng, address: `${lat}, ${lng}` })
          } finally {
            setLoadingLocation(false)
          }
        },
        (error) => {
          setLoadingLocation(false)
          setLocationError(error.message || 'Unable to determine your location.')
        },
        { enableHighAccuracy: true, timeout: 12000 }
      )
    }

    fetchLocation()
  }, [isOpen])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!showConfetti) return
    const timer = setTimeout(() => setShowConfetti(false), 2500)
    return () => clearTimeout(timer)
  }, [showConfetti])

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl]
  )

  const uploadFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.')
      return
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPhotoFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setDragActive(false)
    uploadFile(event.dataTransfer.files?.[0])
  }

  const runGeminiAnalysis = async () => {
    if (!photoFile) return

    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY
    if (!geminiApiKey) {
      setCategory('Other')
      setSeverity('Medium')
      setAiLetter('Gemini key not configured. Add VITE_GEMINI_API_KEY to enable AI analysis.')
      return
    }

    setAnalysisLoading(true)

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(String(reader.result).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(photoFile)
      })

      const prompt = `You are helping LocalLoop process a city issue report. Return only valid JSON with keys: category, severity, description, ai_letter.
- category must be one of: ${CATEGORIES.join(' / ')}.
- severity must be one of: Low / Medium / Critical.
- description should be concise and factual, max 2 sentences.
- ai_letter should be a professional complaint letter addressed to the most relevant city department.
Use the image and location context: ${location.address || 'Unknown location'}.`

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: photoFile.type,
                      data: base64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        }
      )

      const data = await response.json()
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text
      const parsed = JSON.parse(content)

      const safeCategory = CATEGORIES.includes(parsed.category) ? parsed.category : 'Other'
      const safeSeverity = ['Low', 'Medium', 'Critical'].includes(parsed.severity)
        ? parsed.severity
        : 'Medium'

      setCategory(safeCategory)
      setSeverity(safeSeverity)
      setDescription(parsed.description || '')
      setAiLetter(parsed.ai_letter || '')
    } catch (error) {
      console.error('Gemini analysis failed', error)
      setAiLetter('AI analysis could not be completed. You can still submit manually.')
    } finally {
      setAnalysisLoading(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!photoFile || !location.lat || !location.lng) return

    setSubmitLoading(true)
    try {
      const reportRef = doc(collection(db, 'reports'))
      const extension = photoFile.name.split('.').pop() || 'jpg'
      const storageRef = ref(storage, `reports/${reportRef.id}.${extension}`)
      await uploadBytes(storageRef, photoFile)
      const photoUrl = await getDownloadURL(storageRef)

      await setDoc(reportRef, {
        id: reportRef.id,
        photo_url: photoUrl,
        location,
        category,
        severity,
        description,
        ai_letter: aiLetter,
        upvotes: 0,
        status: 'open',
        timestamp: serverTimestamp(),
      })

      setToast('🎉 Your report is live')
      setShowConfetti(true)
      onClose()
    } catch (error) {
      console.error('Submit report failed', error)
      alert('Submission failed. Please try again.')
    } finally {
      setSubmitLoading(false)
    }
  }

  if (!isOpen) {
    return toast ? (
      <div className="fixed bottom-6 right-6 z-[60] rounded-full border border-emerald-300/30 bg-emerald-500/20 px-5 py-3 text-sm font-semibold text-emerald-100 shadow-glass backdrop-blur-xl">
        {toast}
      </div>
    ) : null
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-civic-night/65 backdrop-blur-md" onClick={onClose} />
      <section className="fixed inset-0 z-[55] flex items-center justify-center px-4 py-8">
        <ConfettiOverlay show={showConfetti} />
        <form
          onSubmit={handleSubmit}
          className="glass-card relative max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-3xl border-white/20 p-6 md:p-8"
        >
          <div className="mb-6 flex items-start justify-between gap-6">
            <div>
              <h2 className="text-2xl font-semibold text-white">Report an Issue</h2>
              <p className="mt-2 text-sm text-white/65">Upload a photo and let AI help draft your civic report.</p>
            </div>
            <button type="button" className="text-white/60 transition hover:text-white" onClick={onClose}>
              ✕
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragActive(true)
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`relative flex min-h-72 w-full items-center justify-center rounded-2xl border border-dashed p-4 transition ${
                  dragActive ? 'border-civic-electric bg-civic-electric/10' : 'border-white/20 bg-white/5'
                }`}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="Issue preview" className="h-full max-h-96 w-full rounded-xl object-cover" />
                ) : (
                  <div className="text-center">
                    <p className="text-base font-medium text-white">Drag & drop photo here</p>
                    <p className="mt-2 text-sm text-white/65">or click to browse</p>
                  </div>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(event) => uploadFile(event.target.files?.[0])}
                className="hidden"
              />

              <div className="glass-card rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Detected location</p>
                {loadingLocation ? (
                  <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-white/20" />
                ) : locationError ? (
                  <p className="mt-2 text-sm text-red-200">{locationError}</p>
                ) : (
                  <p className="mt-2 text-sm text-white/80">{location.address || 'Waiting for location...'}</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">AI Analysis</p>
                  <button
                    type="button"
                    disabled={!photoFile || analysisLoading}
                    onClick={runGeminiAnalysis}
                    className="rounded-full border border-civic-electric/60 bg-civic-electric/20 px-4 py-1.5 text-xs font-semibold text-civic-mist transition hover:bg-civic-electric/30 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {analysisLoading ? 'Analyzing…' : 'Run analysis'}
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {analysisLoading ? (
                    ANALYSIS_SKELETON
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                          {category}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${SEVERITY_STYLES[severity] || SEVERITY_STYLES.Medium}`}
                        >
                          {severity}
                        </span>
                      </div>
                      <TypewriterText text={aiLetter || 'Run AI analysis to auto-generate the complaint letter.'} />
                    </>
                  )}
                </div>
              </div>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-white/50">Issue description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={5}
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-civic-electric"
                  placeholder="Describe what is happening and why it needs city attention."
                  required
                />
              </label>

              <button
                type="submit"
                disabled={submitLoading || !photoFile || !location.lat || !location.lng}
                className="w-full rounded-2xl bg-civic-electric px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitLoading ? 'Publishing report…' : 'Submit report'}
              </button>
            </div>
          </div>
        </form>
      </section>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] rounded-full border border-emerald-300/30 bg-emerald-500/20 px-5 py-3 text-sm font-semibold text-emerald-100 shadow-glass backdrop-blur-xl">
          {toast}
        </div>
      )}
    </>
  )
}

export default ReportIssueModal
