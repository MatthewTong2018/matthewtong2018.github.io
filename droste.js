const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('upload');
const zoomSlider = document.getElementById('zoom');
const twistSlider = document.getElementById('twist');
const zoomView = document.getElementById('view-zoom');
const twistView = document.getElementById('view-twist');
const downloadBtn = document.getElementById('download');

let sourceImage = null;
let sourceCanvas = document.createElement('canvas');
let sourceCtx = sourceCanvas.getContext('2d');
let sourceData = null;

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            sourceImage = img;
            canvas.width = img.width;
            canvas.height = img.height;
            sourceCanvas.width = img.width;
            sourceCanvas.height = img.height;
            sourceCtx.drawImage(img, 0, 0);
            sourceData = sourceCtx.getImageData(0, 0, img.width, img.height);
            render();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

function render() {
    if (!sourceData) return;
    const width = canvas.width;
    const height = canvas.height;
    const outputData = ctx.createImageData(width, height);
    const sw = sourceCanvas.width;
    const sh = sourceCanvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const scx = sw / 2;
    const scy = sh / 2;
    
    const zoom = parseFloat(zoomSlider.value);
    const twist = parseFloat(twistSlider.value);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dx = x - cx;
            const dy = y - cy;
            if (dx === 0 && dy === 0) continue;
            
            const r = Math.sqrt(dx * dx + dy * dy);
            const theta = Math.atan2(dy, dx);
            
            const lnR = Math.log(r);
            const expR = lnR * zoom - theta * twist;
            const expTheta = lnR * twist + theta * zoom;
            
            const wR = Math.exp(expR);
            const u = wR * Math.cos(expTheta);
            const v = wR * Math.sin(expTheta);
            
            let sx = (u + scx) % sw;
            sx = (sx + sw) % sw;
            let sy = (v + scy) % sh;
            sy = (sy + sh) % sh;
            
            const sx1 = Math.floor(sx);
            const sy1 = Math.floor(sy);
            const sx2 = (sx1 + 1) % sw;
            const sy2 = (sy1 + 1) % sh;
            const fx = sx - sx1;
            const fy = sy - sy1;
            
            const idx1 = (sy1 * sw + sx1) * 4;
            const idx2 = (sy1 * sw + sx2) * 4;
            const idx3 = (sy2 * sw + sx1) * 4;
            const idx4 = (sy2 * sw + sx2) * 4;
            
            for (let c = 0; c < 4; c++) {
                const c1 = sourceData.data[idx1 + c];
                const c2 = sourceData.data[idx2 + c];
                const c3 = sourceData.data[idx3 + c];
                const c4 = sourceData.data[idx4 + c];
                
                const t1 = c1 * (1 - fx) + c2 * fx;
                const t2 = c3 * (1 - fx) + c4 * fx;
                const cFinal = t1 * (1 - fy) + t2 * fy;
                
                outputData.data[(y * width + x) * 4 + c] = cFinal;
            }
        }
    }
    ctx.putImageData(outputData, 0, 0);
}

zoomSlider.addEventListener('input', () => {
    zoomView.textContent = parseFloat(zoomSlider.value).toFixed(2);
    render();
});

twistSlider.addEventListener('input', () => {
    twistView.textContent = parseFloat(twistSlider.value).toFixed(2);
    render();
});

downloadBtn.addEventListener('click', () => {
    if (!sourceImage) return;
    const link = document.createElement('a');
    link.download = 'droste.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
});
