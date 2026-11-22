# Jesús Martínez — 3D Interactive WebGPU Portfolio

<img src="./static/readme/jesus's.png" alt="Jesus Martinez Portfolio Banner" width="100%" />

Interactive 3D portfolio built with **Three.js WebGPU / TSL**, **Rapier 3D Physics**, **GSAP**, **Howler**, and **Vite**.

- **Live Demo:** https://jesusmandev.github.io/portfolio-website/
- **Repository:** https://github.com/jesusmandev/portfolio-website

## Setup & Commands

1. Copy `.env.example` to `.env` if needed.
2. Install dependencies and run locally:

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production (dist/)
npm run build

# Deploy to GitHub Pages
npm run deploy
```

## Project Structure

```text
frontend-portfolio/
├── sources/         # Application source code, 3D world, TSL shaders, UI & styles
├── static/          # 3D models, textures, fonts, audio, CV & project assets
├── scripts/         # Asset compression utilities
├── vite.config.js   # Vite + WebAssembly configuration
├── package.json     # Dependencies and scripts
└── LICENSE          # MIT License
```

## License

MIT License — © 2026 Jesus Martinez
