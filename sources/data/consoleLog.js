import * as THREE from 'three/webgpu'

const text = `
██╗███████╗███████╗██╗   ██╗███████╗    ███╗   ███╗ █████╗ ██████╗ ████████╗██╗███╗   ██╗███████╗███████╗
██║██╔════╝██╔════╝██║   ██║██╔════╝    ████╗ ████║██╔══██╗██╔══██╗╚══██╔══╝██║████╗  ██║██╔════╝╚══███╔╝
██║█████╗  ███████╗██║   ██║███████╗    ██╔████╔██║███████║██████╔╝   ██║   ██║██╔██╗ ██║█████╗    ███╔╝ 
██║██╔══╝  ╚════██║██║   ██║╚════██║    ██║╚██╔╝██║██╔══██║██╔══██╗   ██║   ██║██║╚██╗██║██╔══╝   ███╔╝  
██║███████╗███████║╚██████╔╝███████║    ██║ ╚═╝ ██║██║  ██║██║  ██║   ██║   ██║██║ ╚████║███████╗███████╗
╚═╝╚══════╝╚══════╝ ╚═════╝ ╚══════╝    ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝

╔═ Intro ═══════════════╗
║ Jesús Martínez's Portfolio
║ Welcome to my 3D interactive portfolio!
╚═══════════════════════╝

╔═ Socials ═══════════════╗
║ Name           ⇒ Jesús Martínez
║ Role           ⇒ Creative Developer
╚═══════════════════════╝

╔═ Debug ═══════════════╗
║ You can access the debug mode by adding #debug at the end of the URL and reloading.
║ Press [V] to toggle the free camera.
╚═══════════════════════╝

╔═ Three.js ════════════╗
║ Three.js is the library I’m using to render this 3D world (release: ${THREE.REVISION})
║ https://threejs.org/
╚═══════════════════════╝

╔═ Tech Stack ══════════╗
║ Rapier (Physics library)  ⇒ https://rapier.rs/
║ Howler.js (Audio library) ⇒ https://howlerjs.com/
║ Amatic SC (Fonts)         ⇒ https://fonts.google.com/specimen/Amatic+SC
║ Nunito (Fonts)            ⇒ https://fonts.google.com/specimen/Nunito?query=Nunito
╚═══════════════════════╝
`
let finalText = ''
let finalStyles = []
const stylesSet = {
    letter: 'color: #ffffff; font: 400 1em monospace;',
    pipe: 'color: #D66FFF; font: 400 1em monospace;',
}
let currentStyle = null
for(let i = 0; i < text.length; i++)
{
    const char = text[i]

    const style = char.match(/[╔║═╗╚╝╔╝]/) ? 'pipe' : 'letter'
    if(style !== currentStyle)
    {
        currentStyle = style
        finalText += '%c'

        finalStyles.push(stylesSet[currentStyle])
    }
    finalText += char
}

export default [finalText, ...finalStyles]