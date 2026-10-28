import { Component, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
const projects = [
 {name:'Candor', kind:'Evidence / research', description:'Earnings-call reports connected to timestamped transcript evidence.', architecture:'Audio → timestamped transcripts → sentiment and audio features → cited reports. Readers can inspect supporting passages. Executive baselines and outcome backtesting remain unfinished.', tech:'React · TypeScript · FastAPI · faster-whisper · FinBERT', form:0},
 {name:'ReRoute AI', kind:'Travel / orchestration', description:'Trip disruption recovery with a deterministic approval policy.', architecture:'Disruption events → itinerary impact → ranked alternatives → policy approval → recovery. WebSockets stream progress; an LLM explains decisions. Flight data is simulated by default.', tech:'React · FastAPI · WebSockets · SQLAlchemy', form:1},
 {name:'Evallq', kind:'Models / evaluation', description:'Compare model responses with automated judge scores and experiment history.', architecture:'Prompts fan out to model providers; a judge scores responses across quality dimensions. Results feed saved experiments and comparisons. Automated scores require interpretation, not blind trust.', tech:'Python · FastAPI · SQLAlchemy · JavaScript · Chart.js', form:2},
 {name:'Placement Portal', kind:'Campus / workflow', description:'A shared recruitment workflow for students, companies, and administrators.', architecture:'Role-based access connects student registration, company approval, recruitment drives, eligibility checks, and administrator analytics.', tech:'Vue · Flask · SQLAlchemy · Celery', form:3},
 {name:'FraudShield', kind:'Safety / messaging', description:'Scam-message analysis with red flags and suggested next steps.', architecture:'A submitted message is analyzed through Gemini into structured scam indicators, explanations, and suggested actions. The API includes authentication and persisted analysis. Output is model guidance, not a guarantee.', tech:'Python · FastAPI · Gemini · SQLAlchemy', form:4},
 {name:'LearnWise', kind:'Learning / organization', description:'A student workspace connecting academics and personal learning content.', architecture:'React routes connect to Express controllers and services for student, academic, and user-created content. The interface organizes learning tasks in one workspace.', tech:'React · TypeScript · Express', form:5},
]
function Sculpture({form, reducedMotion}:{form:number;reducedMotion:boolean}) {
 const group=useRef<THREE.Group>(null)
 useFrame(({clock})=>{if(group.current&&!reducedMotion){group.current.rotation.y=Math.sin(clock.elapsedTime*.35)*.12;group.current.position.y=Math.sin(clock.elapsedTime*.6)*.055}})
 const pieces=Array.from({length:form===4?7:5},(_,i)=>i)
 return <group ref={group} rotation={[.2,-.25,0]}>{pieces.map(i=>{
 const x=form===1?(i-2)*.72:form===2?(i-2)*.64:form===4?Math.sin(i/7*Math.PI*2)*1.05:0
 const y=form===1?Math.sin(i*1.5)*.6:form===2?-.6+i*.17:form===4?Math.cos(i/7*Math.PI*2)*1.05:(i-2)*.28
 return <mesh key={i} position={[x,y,form===0||form===5?i*.13:0]} rotation={[form===5?0:.1,form===5?(i-2)*.18:0,form===1?.35:0]}>
 {form===4?<sphereGeometry args={[.36,24,16]}/>:<boxGeometry args={form===2?[.42,.6+i*.32,.35]:form===1?[.7,.18,.4]:form===3?[2.3-i*.35,1.5-i*.22,.12]:[2.5,.10,1.4]}/>}
 <meshStandardMaterial color={i%2?'#F5E7BD':'#A83D49'} roughness={.38} metalness={.12}/></mesh>
 })}</group>
}
class ArtworkBoundary extends Component<{children:ReactNode},{failed:boolean}> {
 state={failed:false}
 static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?<span className="art-fallback">Architecture study · 3D unavailable</span>:this.props.children}
}
function Artwork({form,reducedMotion}:{form:number;reducedMotion:boolean}) {return <div className={`project-art art-${form}`} aria-hidden="true"><ArtworkBoundary><Canvas dpr={[1,1.25]} frameloop={reducedMotion?'demand':'always'} camera={{position:[0,1,5.4],fov:40}} fallback={<span>Architecture study</span>}><ambientLight intensity={1.7}/><directionalLight position={[3,5,4]} intensity={3}/><Sculpture form={form} reducedMotion={reducedMotion}/></Canvas></ArtworkBoundary></div>}
export default function Projects({reducedMotion}:{reducedMotion:boolean}) {
 const [active,setActive]=useState(0);const project=projects[active]
 return <section id="work" className="projects" aria-labelledby="projects-title"><header className="projects-heading"><span>01 / SELECTED WORK</span><h2 id="projects-title">SELECTED PROJECTS</h2><p>A collection of AI and software systems I've built, each solving a real problem.</p></header><div className="project-list">{projects.map((p,i)=><article className={`project-item ${active===i?'selected':''}`} key={p.name}><Artwork form={p.form} reducedMotion={reducedMotion}/><div className="project-caption"><span>0{i+1} / {p.kind}</span><h3>{p.name}</h3><p>{p.description}</p><button aria-pressed={active===i} aria-controls="project-detail" onClick={()=>setActive(i)}>{active===i?'Selected':'Select project'} <span aria-hidden="true">↗</span></button><a href="#project-detail" onClick={()=>setActive(i)}>Inspect details ↓</a></div></article>)}</div><section id="project-detail" className="project-detail" aria-labelledby="detail-title"><div aria-live="polite"><span>IN FOCUS / {project.kind}</span><h2 id="detail-title">{project.name}</h2><p>{project.architecture}</p><p className="project-tech">{project.tech}</p></div><Artwork form={project.form} reducedMotion={reducedMotion}/></section></section>
}
