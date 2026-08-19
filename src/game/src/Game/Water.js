import {
	Color,
	FrontSide,
	Matrix4,
	Mesh,
	PerspectiveCamera,
	Plane,
	PlaneGeometry,
	RepeatWrapping,
	ShaderMaterial,
	TextureLoader,
	UniformsLib,
	UniformsUtils,
	Vector3,
	Vector4,
	WebGLRenderTarget
} from 'three';

/**
 * A basic flat, reflective water effect tuned to look like a calm lake.
 *
 * Note that this class can only be used with {@link WebGLRenderer}.
 * When using {@link WebGPURenderer}, use {@link WaterMesh}.
 *
 * References:
 *
 * - [Flat mirror for three.js]{@link https://github.com/Slayvin}
 * - [An implementation of water shader based on the flat mirror]{@link https://home.adelphi.edu/~stemkoski/}
 * - [Water shader explanations in WebGL]{@link http://29a.ch/slides/2012/webglwater/ }
 *
 * @augments Mesh
 * @three_import import { Water } from 'three/addons/objects/Water.js';
 */
class Water extends Mesh {

	/**
	 * Constructs a new water instance.
	 *
	 * @param {BufferGeometry} geometry - The water's geometry.
	 * @param {Water~Options} [options] - The configuration options.
	 */
	constructor( geometry, options = {} ) {

		if ( geometry === undefined || geometry === null ) {
			geometry = new PlaneGeometry( 2400, 2400, 128, 128 );
		}

		super( geometry );

		/**
		 * This flag can be used for type testing.
		 *
		 * @type {boolean}
		 * @readonly
		 * @default true
		 */
		this.isWater = true;

		const scope = this;

		const textureWidth = options.textureWidth !== undefined ? options.textureWidth : 512;
		const textureHeight = options.textureHeight !== undefined ? options.textureHeight : 512;

		const clipBias = options.clipBias !== undefined ? options.clipBias : 0.0;
		const alpha = options.alpha !== undefined ? options.alpha : 1.0;
		const time = options.time !== undefined ? options.time : 0.0;
		let normalSampler = options.waterNormals !== undefined ? options.waterNormals : null;
		if ( ! normalSampler ) {
			normalSampler = new TextureLoader().load(
				'textures/waternormals.jpg',
				function ( texture ) {
					texture.wrapS = texture.wrapT = RepeatWrapping;
				}
			);
		}
		const sunDirection = options.sunDirection !== undefined ? options.sunDirection : new Vector3( 0.70707, 0.70707, 0.0 );
		const sunColor = new Color( options.sunColor !== undefined ? options.sunColor : 0xffffff );
		const waterColor = new Color( options.waterColor !== undefined ? options.waterColor : 0x0f6b86 );
		const eye = options.eye !== undefined ? options.eye : new Vector3( 0, 0, 0 );
		const distortionScale = options.distortionScale !== undefined ? options.distortionScale : 12.0;
		const side = options.side !== undefined ? options.side : FrontSide;
		const fog = options.fog !== undefined ? options.fog : false;

		const waveScale = options.waveScale !== undefined ? options.waveScale : 1.6;
		const waveSpeed = options.waveSpeed !== undefined ? options.waveSpeed : 0.5;

		const waveA = options.waveA !== undefined ? options.waveA : new Vector4( 1.0, 0.4, 0.35, 32.0 );
		const waveB = options.waveB !== undefined ? options.waveB : new Vector4( 0.4, 1.0, 0.25, 22.0 );
		const waveC = options.waveC !== undefined ? options.waveC : new Vector4( -0.6, 0.8, 0.20, 14.0 );
		const disableReflection = options.disableReflection !== undefined ? options.disableReflection : true;

		//

		const mirrorPlane = new Plane();
		const normal = new Vector3();
		const mirrorWorldPosition = new Vector3();
		const cameraWorldPosition = new Vector3();
		const rotationMatrix = new Matrix4();
		const lookAtPosition = new Vector3( 0, 0, - 1 );
		const clipPlane = new Vector4();

		const view = new Vector3();
		const target = new Vector3();
		const q = new Vector4();

		const textureMatrix = new Matrix4();

		const mirrorCamera = new PerspectiveCamera();
		mirrorCamera.name = 'mirrorCamera';

		const renderTarget = new WebGLRenderTarget( textureWidth, textureHeight );

		// Throttle: only re-render the reflection every N frames.
		// Camera/matrix/clipPlane setup runs every frame so orientation stays correct.
		let _reflectionFrameCount = 0;
		const _waterWorldPos = new Vector3();

		const mirrorShader = {

			name: 'MirrorShader',

			uniforms: UniformsUtils.merge( [
				UniformsLib[ 'fog' ],
				UniformsLib[ 'lights' ],
				{
					'normalSampler': { value: null },
					'mirrorSampler': { value: null },
					'alpha': { value: 1.0 },
					'time': { value: 0.0 },
					'size': { value: 1.0 },
					'distortionScale': { value: 2.0 },
					'textureMatrix': { value: new Matrix4() },
					'sunColor': { value: new Color( 0x7F7F7F ) },
					'sunDirection': { value: new Vector3( 0.70707, 0.70707, 0 ) },
					'eye': { value: new Vector3() },
					'waterColor': { value: new Color( 0x555555 ) },
					'waveScale': { value: 1.0 },
					'waveSpeed': { value: 0.35 },
					'waveA': { value: new Vector4() },
					'waveB': { value: new Vector4() },
					'waveC': { value: new Vector4() }
				}
			] ),

			vertexShader: /* glsl */`
				uniform mat4 textureMatrix;
				uniform float time;

				varying vec4 mirrorCoord;
				varying vec4 worldPosition;

				#include <common>
				#include <fog_pars_vertex>
				#include <shadowmap_pars_vertex>
				#include <logdepthbuf_pars_vertex>

				uniform vec4 waveA;
				uniform vec4 waveB;
				uniform vec4 waveC;

				// Gerstner Wave adapted for horizontal (XZ) plane:
				// wave.xy = direction, wave.z = steepness, wave.w = wavelength
				// Phase uses p.xz, displacement applies to x (horizontal), y (up), z (horizontal)
				vec3 GerstnerWave (vec4 wave, vec3 p) {
					float steepness = wave.z;
					float wavelength = wave.w;
					float k = 2.0 * PI / wavelength;
					float c = sqrt(9.8 / k);
					vec2 d = normalize(wave.xy);
					float f = k * (dot(d, p.xz) - c * time);
					float a = steepness / k;

					return vec3(
						d.x * (a * cos(f)),
						a * sin(f),
						d.y * (a * cos(f))
					);
				}

				void main() {
					vec3 p = position.xyz;
					p += GerstnerWave(waveA, position.xyz);
					p += GerstnerWave(waveB, position.xyz);
					p += GerstnerWave(waveC, position.xyz);

					mirrorCoord = modelMatrix * vec4( p, 1.0 );
					worldPosition = mirrorCoord.xyzw;
					mirrorCoord = textureMatrix * mirrorCoord;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );

					#include <beginnormal_vertex>
					#include <defaultnormal_vertex>
					#include <logdepthbuf_vertex>
					#include <fog_vertex>
					#include <shadowmap_vertex>
				}`,

			fragmentShader: /* glsl */`
				uniform sampler2D mirrorSampler;
				uniform float alpha;
				uniform float time;
				uniform float size;
				uniform float distortionScale;
				uniform sampler2D normalSampler;
				uniform vec3 sunColor;
				uniform vec3 sunDirection;
				uniform vec3 eye;
				uniform vec3 waterColor;

				varying vec4 mirrorCoord;
				varying vec4 worldPosition;

				vec4 getNoise( vec2 uv ) {
					vec2 uv0 = ( uv / 103.0 ) + vec2(time / 17.0, time / 29.0);
					vec2 uv1 = uv / 107.0-vec2( time / -19.0, time / 31.0 );
					vec2 uv2 = uv / vec2( 8907.0, 9803.0 ) + vec2( time / 101.0, time / 97.0 );
					vec2 uv3 = uv / vec2( 1091.0, 1027.0 ) - vec2( time / 109.0, time / -113.0 );
					vec4 noise = texture2D( normalSampler, uv0 ) +
						texture2D( normalSampler, uv1 ) +
						texture2D( normalSampler, uv2 ) +
						texture2D( normalSampler, uv3 );
					return noise * 0.5 - 1.0;
				}

				void sunLight( const vec3 surfaceNormal, const vec3 eyeDirection, float shiny, float spec, float diffuse, inout vec3 diffuseColor, inout vec3 specularColor ) {
					vec3 reflection = normalize( reflect( -sunDirection, surfaceNormal ) );
					float direction = max( 0.0, dot( eyeDirection, reflection ) );
					specularColor += pow( direction, shiny ) * sunColor * spec;
					diffuseColor += max( dot( sunDirection, surfaceNormal ), 0.0 ) * sunColor * diffuse;
				}

				#include <common>
				#include <packing>
				#include <bsdfs>
				#include <fog_pars_fragment>
				#include <logdepthbuf_pars_fragment>
				#include <lights_pars_begin>
				#include <shadowmap_pars_fragment>
				#include <shadowmask_pars_fragment>

				void main() {

					#include <logdepthbuf_fragment>
					vec4 noise = getNoise( worldPosition.xz * size );
					vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.2, 1.0, 1.2 ) );

					vec3 diffuseLight = vec3(0.0);
					vec3 specularLight = vec3(0.0);

					vec3 worldToEye = eye - worldPosition.xyz;
					vec3 eyeDirection = normalize( worldToEye );
					sunLight( surfaceNormal, eyeDirection, 120.0, 2.5, 0.5, diffuseLight, specularLight );

					// COLOR BASE: Deep ocean turquoise blue #0f6b86
					vec3 scatter = ( 0.65 + 0.35 * max( 0.0, dot( surfaceNormal, vec3(0.0, 1.0, 0.0) ) ) ) * waterColor;
					vec3 albedo = ( scatter + sunColor * diffuseLight * 0.12 ) * getShadowMask() + specularLight * 0.35;

					// ── ONDAS DE ORILLA OVALADAS EN LOS 4 LADOS (NORTE, SUR, ESTE, OESTE) ──────
					vec2 cityPos = worldPosition.xz - vec2(-260.0, 0.0);
					float sideX = abs(cityPos.x);
					float sideZ = abs(cityPos.y);
					float maxDist = max(sideX, sideZ);

					// Wide and soft oval-shaped curves (low frequency)
					float ovalX = sin(worldPosition.x * 0.022 + time * 1.3);
					float ovalZ = sin(worldPosition.z * 0.022 - time * 1.1);

					// Forma de arco ovalado pulido
					float arcX = sign(ovalX) * pow(abs(ovalX), 1.3);
					float arcZ = sign(ovalZ) * pow(abs(ovalZ), 1.3);

					// Select the appropriate oval curve based on the side of the map (North/South or East/West)
					float ovalOffset = (sideX > sideZ) ? (arcZ * 24.0) : (arcX * 24.0);

					// Marea que sube suavemente la curva y se devuelve
					float tideMotion = sin(time * 1.4) * 16.0;
					float shoreDist = maxDist + ovalOffset + tideMotion;

					// White foam on the shore marking the oval shoreline of the waves
					float shoreFoam = smoothstep(778.0, 738.0, shoreDist) * smoothstep(708.0, 738.0, shoreDist);
					float crestFoam = smoothstep(0.28, 0.68, noise.y * 0.5 + 0.5);

					vec3 foamColor = vec3(0.94, 0.97, 1.0); // Espuma marina blanca brillante
					float totalFoam = max(crestFoam * 0.35, shoreFoam * 0.72);

					albedo = mix(albedo, foamColor, totalFoam);

					vec3 outgoingLight = albedo;
					gl_FragColor = vec4( outgoingLight, alpha );

					#include <tonemapping_fragment>
					#include <colorspace_fragment>
					#include <fog_fragment>
				}`

		};

		const material = new ShaderMaterial( {
			name: mirrorShader.name,
			uniforms: UniformsUtils.clone( mirrorShader.uniforms ),
			vertexShader: mirrorShader.vertexShader,
			fragmentShader: mirrorShader.fragmentShader,
			lights: true,
			side: side,
			fog: fog
		} );

		// Clave para que NO se vea el fondo: el material solo es "transparent" si de verdad
		// pediste alpha < 1. Si alpha es 1 (default), el agua queda 100% opaca y bloquea
		// completely whatever is below (terrain, lake bottom, etc.). In addition we force
		// depthWrite/depthTest para asegurar el orden correcto de renderizado.
		material.transparent = alpha < 1.0;
		material.depthWrite = true;
		material.depthTest = true;

		material.uniforms[ 'mirrorSampler' ].value = renderTarget.texture;
		material.uniforms[ 'textureMatrix' ].value = textureMatrix;
		material.uniforms[ 'alpha' ].value = alpha;
		material.uniforms[ 'time' ].value = time;
		material.uniforms[ 'normalSampler' ].value = normalSampler;
		material.uniforms[ 'sunColor' ].value = sunColor;
		material.uniforms[ 'waterColor' ].value = waterColor;
		material.uniforms[ 'sunDirection' ].value = sunDirection;
		material.uniforms[ 'distortionScale' ].value = distortionScale;
		material.uniforms[ 'waveScale' ].value = waveScale;
		material.uniforms[ 'waveSpeed' ].value = waveSpeed;
		material.uniforms[ 'waveA' ].value = waveA;
		material.uniforms[ 'waveB' ].value = waveB;
		material.uniforms[ 'waveC' ].value = waveC;

		material.uniforms[ 'eye' ].value = eye;

		scope.material = material;

		scope.onBeforeRender = function ( renderer, scene, camera ) {

			eye.setFromMatrixPosition( camera.matrixWorld );
			if ( disableReflection ) return;
			if ( camera.name === 'mirrorCamera' ) return;

			mirrorWorldPosition.setFromMatrixPosition( scope.matrixWorld );
			cameraWorldPosition.setFromMatrixPosition( camera.matrixWorld );

			rotationMatrix.extractRotation( scope.matrixWorld );

			normal.set( 0, 0, 1 );
			normal.applyMatrix4( rotationMatrix );

			view.subVectors( mirrorWorldPosition, cameraWorldPosition );

			// Avoid rendering when mirror is facing away

			if ( view.dot( normal ) > 0 ) return;

			view.reflect( normal ).negate();
			view.add( mirrorWorldPosition );

			rotationMatrix.extractRotation( camera.matrixWorld );

			lookAtPosition.set( 0, 0, - 1 );
			lookAtPosition.applyMatrix4( rotationMatrix );
			lookAtPosition.add( cameraWorldPosition );

			target.subVectors( mirrorWorldPosition, lookAtPosition );
			target.reflect( normal ).negate();
			target.add( mirrorWorldPosition );

			mirrorCamera.position.copy( view );
			mirrorCamera.up.set( 0, 1, 0 );
			mirrorCamera.up.applyMatrix4( rotationMatrix );
			mirrorCamera.up.reflect( normal );
			mirrorCamera.lookAt( target );

			mirrorCamera.far = Math.min(camera.far, 250); // Limitar plano lejano de reflejos a 250 unidades para optimizar frustum culling

			mirrorCamera.updateMatrixWorld();
			mirrorCamera.projectionMatrix.copy( camera.projectionMatrix );

			// Update the texture matrix
			textureMatrix.set(
				0.5, 0.0, 0.0, 0.5,
				0.0, 0.5, 0.0, 0.5,
				0.0, 0.0, 0.5, 0.5,
				0.0, 0.0, 0.0, 1.0
			);
			textureMatrix.multiply( mirrorCamera.projectionMatrix );
			textureMatrix.multiply( mirrorCamera.matrixWorldInverse );

			// Now update projection matrix with new clip plane, implementing code from: http://www.terathon.com/code/oblique.html
			// Paper explaining this technique: http://www.terathon.com/lengyel/Lengyel-Oblique.pdf
			mirrorPlane.setFromNormalAndCoplanarPoint( normal, mirrorWorldPosition );
			mirrorPlane.applyMatrix4( mirrorCamera.matrixWorldInverse );

			clipPlane.set( mirrorPlane.normal.x, mirrorPlane.normal.y, mirrorPlane.normal.z, mirrorPlane.constant );

			const projectionMatrix = mirrorCamera.projectionMatrix;

			q.x = ( Math.sign( clipPlane.x ) + projectionMatrix.elements[ 8 ] ) / projectionMatrix.elements[ 0 ];
			q.y = ( Math.sign( clipPlane.y ) + projectionMatrix.elements[ 9 ] ) / projectionMatrix.elements[ 5 ];
			q.z = - 1.0;
			q.w = ( 1.0 + projectionMatrix.elements[ 10 ] ) / projectionMatrix.elements[ 14 ];

			// Calculate the scaled plane vector
			clipPlane.multiplyScalar( 2.0 / clipPlane.dot( q ) );

			// Replacing the third row of the projection matrix
			projectionMatrix.elements[ 2 ] = clipPlane.x;
			projectionMatrix.elements[ 6 ] = clipPlane.y;
			projectionMatrix.elements[ 10 ] = clipPlane.z + 1.0 - clipBias;
			projectionMatrix.elements[ 14 ] = clipPlane.w;

			eye.setFromMatrixPosition( camera.matrixWorld );

			// Render — throttled: the reflection texture is refreshed every
			// frameSkip frames; intermediate frames reuse the previous
			// texture. Camera/matrix setup above runs every frame so the water
			// surface orientation is always correct.
			_reflectionFrameCount ++;

			// Calculate dynamic frame skip based on distance to main camera
			// Optimized: lower frequencies (~10fps max at close range) since the water is very calm
			let frameSkip = 8;
			if ( camera ) {
				scope.getWorldPosition( _waterWorldPos );
				const dist = camera.position.distanceTo( _waterWorldPos );
				if ( dist > 300 ) {
					frameSkip = 60; // Muy lejos: actualiza cada ~1 segundo a 60fps
				} else if ( dist > 150 ) {
					frameSkip = 24; // Lejos: actualiza cada 24 frames (~0.4s)
				} else if ( dist > 70 ) {
					frameSkip = 12; // Distancia media: actualiza cada 12 frames
				} else {
					frameSkip = 6;  // Cerca: actualiza cada 6 frames (~10fps)
				}
			}

			if ( _reflectionFrameCount % frameSkip === 0 ) {

				const currentRenderTarget = renderer.getRenderTarget();

				const currentXrEnabled = renderer.xr.enabled;
				const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;

				scope.visible = false;

				// Hide rain during water reflection rendering
				const rainPoints = scene.getObjectByName( 'rainPoints' );
				const prevRainVisible = rainPoints ? rainPoints.visible : false;
				if ( rainPoints ) {
					rainPoints.visible = false;
				}

				renderer.xr.enabled = false; // Avoid camera modification and recursion
				renderer.shadowMap.autoUpdate = false; // Avoid re-computing shadows

				renderer.setRenderTarget( renderTarget );

				renderer.state.buffers.depth.setMask( true ); // make sure the depth buffer is writable so it can be properly cleared, see #18897

				if ( renderer.autoClear === false ) renderer.clear();
				renderer.render( scene, mirrorCamera );

				scope.visible = true;

				if ( rainPoints ) {
					rainPoints.visible = prevRainVisible;
				}

				renderer.xr.enabled = currentXrEnabled;
				renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;

				renderer.setRenderTarget( currentRenderTarget );

				// Restore viewport

				const viewport = camera.viewport;

				if ( viewport !== undefined ) {

					renderer.state.viewport( viewport );

				}

			}

		};

	}

}

/**
 * Constructor options of `Water`.
 *
 * @typedef {Object} Water~Options
 * @property {number} [textureWidth=512] - The texture width. A higher value results in more clear reflections but is also more expensive.
 * @property {number} [textureHeight=512] - The texture height. A higher value results in more clear reflections but is also more expensive.
 * @property {number} [clipBias=0] - The clip bias.
 * @property {number} [alpha=1] - The alpha value. Keep at 1 so nothing below the water is visible.
 * @property {number} [time=0] - The time value.
 * @property {?Texture} [waterNormals=null] - The water's normal map (not used by the current procedural shader, kept for API compatibility).
 * @property {Vector3} [sunDirection=(0.70707,0.70707,0.0)] - The sun direction.
 * @property {number|Color|string} [sunColor=0xffffff] - The sun color.
 * @property {number|Color|string} [waterColor=0x7F7F7F] - The water color.
 * @property {Vector3} [eye] - The eye vector.
 * @property {number} [distortionScale=3.5] - How much the reflection gets distorted by the waves. Lower = calmer lake, higher = choppier water.
 * @property {number} [waveScale=1.0] - Overall size/frequency of the ripples.
 * @property {number} [waveSpeed=0.35] - How fast the ripples animate.
 * @property {(FrontSide|BackSide|DoubleSide)} [side=FrontSide] - The water material's `side` property.
 * @property {boolean} [fog=false] - Whether the water should be affected by fog or not.
 **/

export { Water };