import { Component, useMemo, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { GLProps } from '@react-three/fiber'
import * as THREE from 'three'

export const FABRIC_VERSION = 'glsl-flowing-checks-v5'
export interface SurfacePointer { x: number; y: number; active: boolean }
interface Props { reducedMotion: boolean; pointer: RefObject<SurfacePointer>; onFailure: (reason: string) => void; onReady: (status: string) => void }
type DebugMode = 'exaggerated' | 'wireframe' | ''
const requestedDebug = new URLSearchParams(location.search).get('fabricDebug')
const debugMode: DebugMode = import.meta.env.DEV && (requestedDebug === 'exaggerated' || requestedDebug === 'wireframe') ? requestedDebug : ''

const vertexShader = /* glsl */`
uniform float uTime;
uniform vec3 uPointer;
uniform float uExaggeration;
uniform float uScroll;
varying vec2 vRest;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCurvature;

vec3 drape(vec2 p) {
  float t = uTime;
  // Landscape interpretation of the reference: a continuous horizontal
  // sweep gently bends the rows, while the rest-space checker stays attached.
  float sweep = .43*p.x + .23*sin(.29*p.x-t*.12) - t*.18;
  float crossWave = .48*p.y + .16*sin(.24*p.x+t*.10);
  vec2 xy = p + vec2(.18*sin(crossWave+t*.13),
                     .72*sin(sweep) + .14*sin(.78*p.x+.26*p.y+t*.15));
  float pointerDistance=length(p-uPointer.xy);
  float pointerWave=.22*uPointer.z*exp(-pointerDistance*pointerDistance/7.0)
                    *cos(pointerDistance*2.1-t*1.6);
  float z=(.38*sin(sweep+.55) + .18*cos(crossWave-t*.16)
           + .08*sin(.65*p.x-.51*p.y+t*.12) + pointerWave)*uExaggeration;
  float roll=sin(uScroll*3.14159265);
  z += roll * 1.6 * sin(p.y*.65-p.x*.24-uScroll*6.0);
  xy.y += roll*.45*sin(p.x*.5+uScroll*4.0);
  return vec3(xy, z*(1.0-uScroll*.85));
}
void main() {
  vec3 p=drape(position.xy);
  float e=.018;
  vec3 dx=drape(position.xy+vec2(e,0.))-drape(position.xy-vec2(e,0.));
  vec3 dy=drape(position.xy+vec2(0.,e))-drape(position.xy-vec2(0.,e));
  vec3 n=normalize(cross(dx,dy));
  // A finite-difference curvature term helps the key light read ridges at rest.
  float center=drape(position.xy).z;
  float lap=drape(position.xy+vec2(.12,0.)).z+drape(position.xy-vec2(.12,0.)).z
           +drape(position.xy+vec2(0.,.12)).z+drape(position.xy-vec2(0.,.12)).z-4.*center;
  vec4 world=modelMatrix*vec4(p,1.);
  vRest=position.xy;
  vWorld=world.xyz;
  vNormal=normalize(mat3(modelMatrix)*n);
  vCurvature=lap;
  gl_Position=projectionMatrix*viewMatrix*world;
}
`

const fragmentShader = /* glsl */`
uniform float uTime;
uniform float uScroll;
varying vec2 vRest;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCurvature;
void main() {
  // The material grid stays fixed in cloth rest space. Its visible distortion
  // comes from the exact nonlinear mapping used to move the surface vertices.
  vec2 checkCoord=vRest/1.90;
  float parity=cos(3.14159265*checkCoord.x)*cos(3.14159265*checkCoord.y);
  float edge=max(fwidth(parity)*.72,.001);
  float cream=smoothstep(-edge,edge,parity);
  vec3 oxblood=vec3(.19,.012,.027);
  vec3 butter=vec3(.96,.82,.59);
  vec3 base=mix(oxblood,butter,cream);
  base=mix(base,vec3(.96,.82,.59),smoothstep(.35,1.,uScroll));
  vec3 n=normalize(gl_FrontFacing?vNormal:-vNormal);
  vec3 viewDir=normalize(cameraPosition-vWorld);
  vec3 keyDir=normalize(vec3(-.48,.62,.88));
  float diffuse=max(dot(n,keyDir),0.);
  float fill=max(dot(n,normalize(vec3(.45,-.2,.88))),0.);
  vec3 halfDir=normalize(keyDir+viewDir);
  float satin=pow(max(dot(n,halfDir),0.),18.);
  float sheen=pow(max(dot(n,halfDir),0.),72.);
  float valley=clamp(-vCurvature*.075,0.,.32);
  float ridge=clamp(vCurvature*.055,0.,.22);
  vec3 color=base*(.76+.19*diffuse+.08*fill-valley+ridge);
  color+=vec3(.99,.86,.66)*(satin*.045+sheen*.015);
  // Fine stationary fibers belong to the fabric coordinates, never the screen.
  float grain=fract(sin(dot(floor(vRest*160.),vec2(127.1,311.7)))*43758.5453);
  color*=.985+.03*grain;
  gl_FragColor=vec4(color,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(245.,231.,189.)/255.,smoothstep(.8,1.,uScroll));
}
`

function Fabric({ reducedMotion, pointer, status, onReady }: Props & { status: RefObject<HTMLOutputElement | null> }) {
  const { viewport, gl } = useThree()
  const announced = useRef(false)
  const material = useRef<THREE.ShaderMaterial>(null)
  const time = useRef(0)
  const smoothPointer = useMemo(() => new THREE.Vector2(), [])
  const targetPointer = useMemo(() => new THREE.Vector2(), [])
  const exaggeration = debugMode === 'exaggerated' ? 1.28 : 1
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uScroll: { value: 0 }, uPointer: { value: new THREE.Vector3() },
    uExaggeration: { value: exaggeration },
  }), [exaggeration])
  useFrame((_, delta) => {
    if (!reducedMotion) time.current += Math.min(delta, .08)
    material.current?.uniforms.uScroll && (material.current.uniforms.uScroll.value=reducedMotion?0:Math.max(0,Math.min(1,window.scrollY/(window.innerHeight*.7))))
    const p=pointer.current
    targetPointer.set(p.x*viewport.width/2,p.y*viewport.height/2)
    smoothPointer.lerp(targetPointer,1-Math.exp(-delta*2.4))
    if (!material.current) return
    material.current.uniforms.uTime.value=time.current
    material.current.uniforms.uPointer.value.set(smoothPointer.x,smoothPointer.y,p.active&&!reducedMotion?1:0)
    const canvas=gl.domElement
    if(import.meta.env.DEV){canvas.dataset.time=time.current.toFixed(3)}
    if(status.current)status.current.value=`${FABRIC_VERSION} | ${debugMode||'animated'} | draw awaiting`
  })
  const markShaderDraw = (renderer: THREE.WebGLRenderer) => {
    renderer.domElement.dataset.shaderFrame=FABRIC_VERSION
    if(!announced.current){announced.current=true;onReady(`${FABRIC_VERSION} — shader drew a frame`)}
    if(status.current) status.current.value=`${FABRIC_VERSION} | ${debugMode||'animated'} | shader frame ${renderer.info.render.frame}`
  }
  return <mesh frustumCulled={false} onAfterRender={markShaderDraw}>
    <planeGeometry args={[56,40,240,180]} />
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} wireframe={debugMode==='wireframe'} side={THREE.DoubleSide} toneMapped />
  </mesh>
}
class Boundary extends Component<{children:ReactNode;onFailure:(reason:string)=>void},{failed:boolean}>{
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(error:Error){console.error(`[${FABRIC_VERSION}] scene mount failed`,error);this.props.onFailure(`scene mount error: ${error.message}`)}
  render(){return this.state.failed?null:this.props.children}
}
type RendererFactory = Extract<GLProps, (...args: any[]) => any>
const createDiagnosticRenderer: RendererFactory = defaults => {
  const canvas = defaults.canvas as HTMLCanvasElement
  let creationError = ''
  const rememberContextError = (event: Event) => {
    creationError = (event as WebGLContextEvent).statusMessage || 'browser reported a WebGL2 context creation error'
  }
  canvas.addEventListener('webglcontextcreationerror', rememberContextError, { once: true })
  const attributes: WebGLContextAttributes = {
    alpha: true, antialias: false, depth: true, stencil: false,
    premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'default',
    failIfMajorPerformanceCaveat: false,
  }
  let context: WebGL2RenderingContext | null
  try {
    context = canvas.getContext('webgl2', attributes)
  } catch (error) {
    throw new Error(`canvas.getContext('webgl2') threw: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!context) {
    const detail = creationError ? `; ${creationError}` : ''
    throw new Error(`canvas.getContext('webgl2') returned null${detail}`)
  }
  try {
    const renderer = new THREE.WebGLRenderer({ ...defaults, canvas, context, ...attributes })
    canvas.dataset.webgl2 = `${context.getParameter(context.VERSION)}; ${context.getParameter(context.RENDERER)}`
    return renderer
  } catch (error) {
    context.getExtension('WEBGL_lose_context')?.loseContext()
    throw new Error(`WebGL2 context exists but Three.js renderer setup failed: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    canvas.removeEventListener('webglcontextcreationerror', rememberContextError)
  }
}

export default function Checkerboard(props:Props){
  const status=useRef<HTMLOutputElement>(null)
  return <>
    {debugMode&&<output ref={status} className="fabric-debug-status">Waiting for {FABRIC_VERSION}</output>}
    <Boundary onFailure={props.onFailure}><Canvas aria-hidden="true" gl={createDiagnosticRenderer} dpr={[1,1.5]} frameloop={props.reducedMotion?'demand':'always'} camera={{position:[0,0,11],fov:42,near:.1,far:60}} onCreated={({gl})=>{
      gl.setClearColor('#7E1020')
      gl.domElement.dataset.renderer=FABRIC_VERSION
      gl.debug.checkShaderErrors=true
      gl.debug.onShaderError=(context,program,vertexShader,fragmentShader)=>{
        const diagnostics={program:context.getProgramInfoLog(program),vertex:context.getShaderInfoLog(vertexShader),fragment:context.getShaderInfoLog(fragmentShader)}
        console.error(`[${FABRIC_VERSION}] GLSL compilation/link failed`,diagnostics)
        props.onFailure(`GLSL compilation/link failed: ${diagnostics.program || diagnostics.vertex || diagnostics.fragment || 'see console'}`)
      }
      gl.domElement.addEventListener('webglcontextlost',()=>{console.error(`[${FABRIC_VERSION}] WebGL context lost`);props.onFailure('WebGL context lost')},{once:true})
      if(import.meta.env.DEV)console.info(`[${FABRIC_VERSION}] WebGL context created`,{canvas:gl.domElement.width+'×'+gl.domElement.height})
      props.onReady(`WebGL2 ready: ${gl.domElement.dataset.webgl2}; awaiting shader draw`)
    }} fallback="WebGL unavailable.">
      <ambientLight intensity={0}/>
      <Fabric {...props} status={status} onReady={props.onReady}/>
    </Canvas></Boundary>
  </>
}
