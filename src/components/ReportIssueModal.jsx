import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addDoc, collection, serverTimestamp, updateDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const CATEGORIES = ['Pothole', 'Flooding', 'Broken Light', 'Graffiti', 'Safety Hazard', 'Other']

const SEVERITY_STYLES = {
  Low: 'bg-emerald-500/20 text-emerald-200 border-emerald-300/30',
  Medium: 'bg-amber-500/20 text-amber-100 border-amber-300/30',
  Critical: 'bg-red-500/20 text-red-100 border-red-300/30',
}

function buildComplaintLetterTemplate(category, address, summary = '') {
  const safeAddress = address?.trim() || 'the reported location'
  const safeCategory = category?.trim() || 'infrastructure'
  const detailSentence =
    summary?.trim() ||
    `The attached photo shows a ${safeCategory.toLowerCase()} issue that appears to be affecting this area and nearby residents.`

  return `Dear Chicago Department of Transportation,

I am writing to report a serious infrastructure issue located at ${safeAddress} that requires immediate attention.

${detailSentence}
This issue poses a significant risk to public safety and requires prompt resolution. I kindly request that your department dispatch a maintenance team to assess and repair this issue at your earliest convenience.

Thank you for your attention to this matter.

Sincerely,
Concerned Resident`
}

function normalizeGeminiText(rawText) {
  if (!rawText) return '{}'

  return String(rawText)
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/`/g, '')
    .trim()
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

  const renderedLetter = useMemo(() => {
    const sourceLetter = aiLetter || buildComplaintLetterTemplate(category, location.address, description)
    return sourceLetter.replace(/\[ADDRESS\]/g, location.address || 'the reported location')
  }, [aiLetter, category, description, location.address])

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
                    text: `You are a civic reporting assistant. Analyze this image carefully.
Respond with ONLY valid JSON, no markdown, no backticks, no explanation:
{
  "category": "Pothole",
  "severity": "Medium",
  "summary": "Brief one sentence description of what you see",
  "complaint_letter": "Dear Chicago Department of Transportation,\\n\\nI am writing to report a serious infrastructure issue located at [ADDRESS] that requires immediate attention.\\n\\n[DETAILED DESCRIPTION OF ISSUE FROM IMAGE - 2-3 sentences]\\n\\nThis issue poses a significant risk to public safety and requires prompt resolution. I kindly request that your department dispatch a maintenance team to assess and repair this issue at your earliest convenience.\\n\\nThank you for your attention to this matter.\\n\\nSincerely,\\nConcerned Resident"
}
Replace [ADDRESS] with the actual detected address and
[DETAILED DESCRIPTION] with what Gemini actually sees in the image.`,
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
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
      const cleanedText = normalizeGeminiText(rawText)

      let parsed = {}
      let parseFailed = false

      try {
        parsed = JSON.parse(cleanedText)
      } catch (parseError) {
        console.warn('Gemini JSON parse failed, using fallback complaint letter:', parseError)
        parseFailed = true
      }

      const parsedCategory = CATEGORIES.includes(parsed.category) ? parsed.category : 'Other'
      const parsedSeverity = ['Low', 'Medium', 'Critical'].includes(parsed.severity) ? parsed.severity : 'Medium'
      const parsedSummary = (parsed.summary || '').trim()
      const parsedLetter = (parsed.complaint_letter || '').trim()

      setCategory(parsedCategory)
      setSeverity(parsedSeverity)
      setDescription(parsedSummary)
      setAiLetter(
        parseFailed || !parsedLetter
          ? buildComplaintLetterTemplate(parsedCategory, location.address, parsedSummary)
          : parsedLetter
      )
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
  }, [analysisLoading, location.address, photoBase64, photoFile])

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
        <form onSubmit={handleSubmit} className="glass-card relative max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-3xl border-[#22C55E]/25 p-6 md:p-8">
          {toast ? (
            <div className="mb-4 rounded-xl border border-emerald-300/30 bg-emerald-500/20 px-4 py-2 text-sm text-emerald-100">
              {toast}
            </div>
          ) : null}
          <div className="mb-6 flex items-start justify-between gap-6">
            <div>
              <h2 className="text-2xl font-semibold text-white">Report an Issue</h2>
              <p className="mt-2 text-sm text-civic-mist/75">Upload a photo and let AI help draft your civic report.</p>
            </div>
            <button type="button" className="text-civic-mist/70 transition hover:text-civic-mist" onClick={onClose}>✕</button>
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
                className="relative flex min-h-72 w-full items-center justify-center rounded-2xl border border-dashed border-[#22C55E]/35 bg-[#132918] p-4 transition hover:bg-[#86EFAC]/15"
              >
                {previewUrl ? <img src={previewUrl} alt="Issue preview" className="h-full max-h-96 w-full rounded-xl object-cover" /> : <div className="text-center"><p className="text-base font-medium text-white">Drag/drop or click image</p></div>}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={(event) => uploadFile(event.target.files?.[0])} className="hidden" />

              <div className="glass-card rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-civic-mist/65">Detected location</p>
                <p className="mt-2 text-sm text-civic-mist/85">{loadingLocation ? 'Detecting location...' : location.address || 'Unknown location'}</p>
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
                    className="mt-3 w-full rounded-xl border border-[#22C55E]/25 bg-[#132918] px-3 py-2 text-sm text-white outline-none transition focus:border-civic-electric"
                  />
                ) : null}
              </div>
            </div>

            <div className="space-y-4">
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-civic-mist/65">AI Analysis</p>
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
                        <span className="rounded-full border border-[#22C55E]/30 bg-[#132918] px-3 py-1 text-xs font-semibold text-civic-mist">{category}</span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${SEVERITY_STYLES[severity] || SEVERITY_STYLES.Medium}`}>{severity}</span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${analysisMode === 'manual' ? 'border-amber-300/40 bg-amber-500/20 text-amber-100' : 'border-[#22C55E]/45 bg-[#22C55E]/20 text-civic-mist'}`}>{analysisMode === 'manual' ? 'Manual' : 'AI'}</span>
                      </div>
                      {suggestedTitle ? (
                        <p className="text-sm text-civic-mist/85">
                          <span className="text-civic-mist/70">Suggested title:</span> {suggestedTitle}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setShowLetter((prev) => !prev)}
                        className="text-left text-sm font-medium text-civic-mist underline decoration-[#22C55E]/60 underline-offset-2"
                      >
                        📄 View AI-Generated Complaint Letter {showLetter ? '▲' : '▼'}
                      </button>
                      {showLetter ? (
                        <div className="space-y-2 rounded-xl border border-[#22C55E]/20 bg-[#132918] p-3">
                          <div className="max-h-64 overflow-y-auto rounded-lg border border-[#22C55E]/15 bg-[#0D1F0F]/80 p-3">
                            <p className="whitespace-pre-line text-sm leading-relaxed text-civic-mist/90">
                              {renderedLetter || 'Run AI analysis to auto-generate the full complaint letter.'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(renderedLetter)
                                setToast('📋 Complaint letter copied!')
                              } catch (copyError) {
                                console.error('Failed to copy letter:', copyError)
                                setToast('Unable to copy letter. Please copy manually.')
                              }
                            }}
                            className="rounded-lg border border-[#22C55E]/45 bg-[#22C55E]/20 px-3 py-1.5 text-xs font-semibold text-civic-mist transition hover:bg-[#86EFAC]/30"
                          >
                            📋 Copy Letter
                          </button>
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
                <span className="text-xs uppercase tracking-[0.2em] text-civic-mist/65">Category</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#22C55E]/25 bg-[#132918] px-4 py-3 text-sm text-white outline-none transition focus:border-civic-electric"
                >
                  {CATEGORIES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-civic-mist/65">Issue description</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} className="mt-2 w-full rounded-2xl border border-[#22C55E]/25 bg-[#132918] px-4 py-3 text-sm text-white outline-none transition focus:border-civic-electric" placeholder="Describe what is happening and why it needs city attention." required />
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
