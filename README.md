# Jesus Martinez — 3D Interactive Portfolio & Web Experience 👨‍💻

<img src="./public/readme/jesus's.png" alt="Jesus Martinez Portfolio Banner" width="100%" style="border-radius: 16px; margin: 16px 0;" />

Welcome to my interactive 3D Web Portfolio! An immersive, game-like web experience combining modern web development with a full 3D interactive city built with **Three.js**, **Rapier 3D Physics**, **React 19**, and **Tailwind CSS v4**.

🔗 **Live Demo**: [https://jesusmandev.github.io/portfolio-website/](https://jesusmandev.github.io/portfolio-website/)  
💻 **GitHub Repository**: [https://github.com/jesusmandev/portfolio-website](https://github.com/jesusmandev/portfolio-website)

---

## ✨ Highlights & Features

### 🎮 Interactive 3D World & Physics Engine
- **3D Character Locomotion & Physics**: Third-person character controller driven by **Rapier 3D** (`@dimforge/rapier3d-compat`) with collision detection, slope climbing, footstep sounds, and skeletal animations (Walk, Run, Jump, Dance, Wave, Crouch, Roll).
- **Procedural City Environment**: Built with custom Three.js lighting, dynamic day/night time cycles, water shaders, 3D buildings, trees, palms, ferris wheel, water tower, flags, and interactive landmarks.
- **Dynamic 3D Letters Ground Collision**: Dynamic 3D text meshes (`JESUSDEV.CO`, `FREELANCER`, `FRONTEND DEVELOPER`) with physics bodies that react to gravity and synthesize Web Audio API impact sounds upon hitting the ground.

### 📱 Full Mobile Responsiveness & Virtual Touch Controls
- **Smart Mobile Detection**: Utilizes `pointer: coarse` media queries, touch event support, and user-agent detection to strictly display touch controls on mobile devices (smartphones & tablets) while keeping the desktop view clean.
- **Virtual Touch Joystick**: On-screen 360° virtual joystick in the bottom-left corner for mobile character movement.
- **Touch Action Buttons**: Floating glassmorphic action buttons for Jump (🦘), Sprint Toggle (⚡), Dance (💃), Wave (👋), and Controls Guide (🎮).
- **Camera Touch Swipe**: Right-side screen swipe gesture for 360° camera rotation.
- **Direct Touch Interaction**: Touch/tap event handling on 3D signs, Rubik's cube, speaker, and HUD banners.

### 🔊 Procedural Web Audio Engine & 3D Speaker
- **3D Procedural Sound Engine**: Synthesizes realistic footstep audio, jump sounds, and 3D letter ground impacts via Web Audio API without relying on static sample files.
- **Interactive 3D Speaker / Radio**: Fully interactive 3D music player with volume control, track switching, proportional speaker cone vibration, 3D spatialized audio, and zero-GC floating musical note particle system. Solid Rapier physics collider prevents the character from clipping through.
- **Background Ambient Music**: Soft ambient audio loop (`musica uno.mp3` & `musica dos.mp3`) set to a subtle gain for background immersion.

### 🖼️ Interactive 3D Standees & Projects Gallery
- **3D Standees & Signboards**: Dynamic 2D canvas textures (`CanvasTexture`) rendered on high-fidelity 3D signboards displaying project previews (including Gemini Clone AI, etc.), live demo links, and code repository links.
- **3D Rubik's Cube & About Me**: Interactive 3D Rubik's cube with face rotation logic, shuffle algorithm, and camera transition opening the **About Me** glassmorphic window.

### 🌐 Modern UI & Internationalization
- **Glassmorphism Design System**: Modern dark mode UI with vibrant color accents, backdrop blur filters, and Framer Motion micro-interactions.
- **Multi-language Support (i18n)**: 5 languages supported (Spanish, English, French, German, Portuguese) with real-time switching and `localStorage` state persistence.
- **Curriculum Vitae Download Modal**: Modal for downloading CVs in both Spanish and English (`/cv/CV_JESUS MARTINEZ_ES.pdf`, `/cv/CV_JESUS_MARTINEZ_EN.pdf`).
- **Smooth Modal Scrolling**: Integrated **Lenis Scroll** for lag-free modal content scrolling.

---

## 🛠️ Tech Stack & Dependencies

### Core & Frameworks
- **React 19**: Modern UI component architecture.
- **Vite 7**: Ultra-fast build tool and dev server.
- **TypeScript & JavaScript (ESNext)**: Type safety and clean modular logic.

### 3D Graphics & Physics
- **Three.js (v0.183)**: 3D scene rendering, custom materials, lighting, GLTF model loading, and canvas textures.
- **@dimforge/rapier3d-compat**: WebAssembly-powered 3D physics engine for rigid bodies, character controllers, and colliders.
- **Three Mesh BVH**: Accelerated raycasting and spatial queries.
- **Postprocessing**: Advanced visual bloom and shader passes.

### Styling & Animation
- **Tailwind CSS v4 (`@tailwindcss/vite`)**: Next-gen utility-first styling.
- **Vanilla CSS**: Custom design tokens, glassmorphism overlays, and keyframe animations.
- **Framer Motion & Motion**: High-performance UI motion components.
- **Lenis**: Smooth scrolling engine inside modal overlays.

---

## 📁 Directory Structure

```
frontend-portfolio/
├── public/
│   ├── readme/            # README banner assets (jesus's.png)
│   ├── cv/                # Curriculum Vitae PDFs (ES & EN)
│   ├── projects/          # Project thumbnail images (gemini.png, etc.)
│   ├── personaje/         # 3D character GLB models & animations
│   ├── audios/            # Audio files for 3D speaker & background music
│   └── hello/             # Intro visual assets
├── src/
│   ├── components/        # React UI Components (Hero, AboutMe, CVModal, LocationNoticeToast, etc.)
│   ├── hooks/             # Custom React Hooks (useLanguage, etc.)
│   ├── game/              # 3D Game Engine Source Code
│   │   ├── src/
│   │   │   ├── Game.js                    # Main 3D Game loop & camera follow
│   │   │   ├── PhysicsCharacter.js        # Character controller & animation mixer
│   │   │   ├── ProceduralCityBuilder.js   # 3D city building & entity spawns
│   │   │   ├── MobileControlsManager.js   # Touch controls & joystick system
│   │   │   ├── ProceduralSound.js         # Web Audio API sound synthesis
│   │   │   ├── speaker.js                 # 3D Speaker music player
│   │   │   ├── rubikCube.js               # 3D Rubik's cube interaction
│   │   │   ├── ProjectSignManager.js      # 3D Project signboards & modal triggers
│   │   │   └── assets/                    # 3D models (joystick, flags, trees, skills, etc.)
│   │   └── Intro/                         # Loading screen & intro orchestrator
│   ├── App.jsx            # Main React Entrypoint
│   ├── index.css          # Global CSS & Tailwind imports
│   └── main.jsx           # Vite React Root
├── .vscode/               # Editor linting configuration
├── package.json           # Scripts and dependency declarations
└── vite.config.ts         # Vite configuration
```

---

## 💻 Local Setup & Development

### 1. Clone the repository
```bash
git clone https://github.com/jesusmandev/portfolio-website.git
cd portfolio-website
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run development server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to view the project.

### 4. Build for production
```bash
npm run build
```

### 5. Deploy to GitHub Pages
```bash
npm run deploy
```

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE.txt).

---

Designed & Built with ❤️ by **Jesus Martinez** - © 2026
