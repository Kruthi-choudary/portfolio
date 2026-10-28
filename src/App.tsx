import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { SurfacePointer } from './components/Checkerboard'
const Checkerboard = lazy(() => import('./components/Checkerboard'))
import Projects from './components/Projects'
const NAME = 'KRUTHI ANNANKI'
const destinations = ['Work', 'Skills', 'Achievements', 'Contact']
export default function App() {
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [fallback, setFallback] = useState(false)
  const [rendererStatus, setRendererStatus] = useState('Waiting for WebGL')
  const debugView = import.meta.env.DEV && ['exaggerated','wireframe'].includes(new URLSearchParams(window.location.search).get('fabricDebug') ?? '')
  const pointer = useRef<SurfacePointer>({ x: 0, y: 0, active: false })
  const onFailure = useCallback((reason: string) => { setFallback(true); setRendererStatus(`CSS FALLBACK — ${reason}`) }, [])
  const onReady = useCallback((status: string) => setRendererStatus(status), [])
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    const update = () => {
      const progress = Math.max(0, Math.min(1, window.scrollY / (window.innerHeight * .7)))
      document.documentElement.style.setProperty('--journey-progress', String(progress))
    }
    update(); window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  return <>
    <a className="skip-link" href="#work">Skip to selected work</a>
    <div className="hero-journey"><section className="hero" id="top" aria-labelledby="hero-title" onPointerMove={event => {
      if (event.pointerType === 'touch') return
      const rect = event.currentTarget.getBoundingClientRect()
      pointer.current = { x: (event.clientX - rect.left) / rect.width * 2 - 1, y: 1 - (event.clientY - rect.top) / rect.height * 2, active: true }
    }} onPointerLeave={() => { pointer.current.active = false }}>
      <div className={`fabric-background ${fallback ? 'is-fallback' : ''}`} aria-hidden="true">
        <div className="static-fabric" />
        {!fallback && <Suspense fallback={null}><Checkerboard reducedMotion={reducedMotion} pointer={pointer} onFailure={onFailure} onReady={onReady} /></Suspense>}
      </div>
      {debugView && <output className="fabric-debug-status" aria-live="polite">{rendererStatus}</output>}
      <div className="hero-shade" aria-hidden="true" />
      <header className="site-header">
        <a className="brand" href="#top"><span className="brand-name">KRUTHI ANNANKI</span></a>
        <nav aria-label="Main navigation">{destinations.map(label => <a key={label} href={`#${label.toLowerCase()}`}>{label}</a>)}</nav>
        <a className="connect" href="#contact">Let’s connect <span aria-hidden="true">↗</span></a>
      </header>
      <main className="hero-copy">
        <h1 id="hero-title" aria-label={NAME}><span aria-hidden="true">{Array.from(NAME).map((letter, index) => <span className={`letter ${letter === ' ' ? 'word-space' : ''}`} key={index} style={{ '--letter-index': index } as CSSProperties}>{letter === ' ' ? '\u00a0' : letter}</span>)}</span></h1>
        <div className="hero-introduction">
          <p className="hero-greeting">Hi, I'm Annanki Kruthi Choudary.</p>
          <p className="hero-description">I build AI-powered applications and software systems that solve real problems.</p>
        </div>
        <a className="explore-button" href="#work">EXPLORE MY WORK <span aria-hidden="true">↗</span></a>
      </main>
      <a className="scroll-indicator" href="#work"><span>SCROLL TO EXPLORE</span><span className="scroll-line" aria-hidden="true" /></a>
    </section></div>
    <Projects reducedMotion={reducedMotion} />
    <div className="future-sections">{destinations.slice(1).map(label=><div id={label.toLowerCase()} key={label}><span>{label}</span><p>Section to follow.</p></div>)}</div>
  </>
}
