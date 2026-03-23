const video = document.getElementById('video');
const loader = document.getElementById('loader');
const container = document.getElementById('video-container');

// UI Elements
const uiEmoji = document.getElementById('emotion-emoji');
const uiText = document.getElementById('emotion-text');
const uiConfidenceFill = document.getElementById('confidence-fill');
const uiConfidenceVal = document.getElementById('confidence-value');
const uiAllEmotions = document.getElementById('all-emotions');

const emotionMap = {
    neutral: '😐',
    happy: '😄',
    sad: '😢',
    angry: '😠',
    fearful: '😨',
    disgusted: '🤢',
    surprised: '😲'
};

// Initialize detailed bars
Object.keys(emotionMap).forEach(emotion => {
    const item = document.createElement('div');
    item.className = 'emotion-item';
    item.innerHTML = `
        <div class="emotion-item-label">
            <span>${emotionMap[emotion]}</span> ${emotion}
        </div>
        <div class="emotion-item-bar-container">
            <div class="emotion-item-bar" id="bar-${emotion}"></div>
        </div>
        <div class="emotion-item-value" id="val-${emotion}">0%</div>
    `;
    uiAllEmotions.appendChild(item);
});

async function loadModels() {
    try {
        // Models are hosted in the local 'models' folder
        // We only need the tinyFaceDetector and faceExpressionNet
        const MODEL_URL = './models';
        console.log('Loading models...');
        
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        
        console.log('Models loaded.');
        startVideo();
    } catch (e) {
        console.error('Error loading models:', e);
        loader.innerHTML = `<p style="color:red">Failed to load models. Check console.</p>`;
    }
}

function startVideo() {
    console.log('Requesting camera access...');
    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => {
            console.log('Camera access granted.');
            video.srcObject = stream;
        })
        .catch(err => {
            console.error('Error accessing webcam:', err);
            loader.innerHTML = `<p style="color:red">Webcam access denied or unavailable.</p>`;
        });
}

video.addEventListener('play', () => {
    console.log('Video playing. Setting up canvas...');
    loader.style.display = 'none';
    
    const canvas = faceapi.createCanvasFromMedia(video);
    container.appendChild(canvas);
    
    // Match dimensions to video
    let displaySize = { width: video.clientWidth, height: video.clientHeight };
    faceapi.matchDimensions(canvas, displaySize);

    // Update dimensions on resize
    window.addEventListener('resize', () => {
        displaySize = { width: video.clientWidth, height: video.clientHeight };
        faceapi.matchDimensions(canvas, displaySize);
    });

    setInterval(async () => {
        if(video.paused || video.ended) return;

        // Run detection
        const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceExpressions();
            
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detections) {
            // Because the frontend video is mirrored via CSS scaleX(-1),
            // if we draw boxes we'd need to mirror coordinates, but letting face-api handle it
            // directly without drawing boxes looks cleaner! Wait, we can draw them:
            // But let's skip drawing boxes so the UI looks more "sleek" and focus on the side panel.

            updateDashboard(detections.expressions);
        }
    }, 100); // 10 fps
});

function updateDashboard(expressions) {
    // Find highest emotion
    let maxEmotion = 'neutral';
    let maxVal = 0;
    
    for (const [emotion, val] of Object.entries(expressions)) {
        if (val > maxVal) {
            maxVal = val;
            maxEmotion = emotion;
        }
        
        // Update bars
        const pct = Math.round(val * 100);
        document.getElementById(`bar-${emotion}`).style.width = `${pct}%`;
        document.getElementById(`val-${emotion}`).textContent = `${pct}%`;
    }
    
    // Update main UI main display
    if (maxVal > 0.1) { // Threshold
        uiEmoji.textContent = emotionMap[maxEmotion];
        uiText.textContent = maxEmotion;
        
        const confidencePct = Math.round(maxVal * 100);
        uiConfidenceFill.style.width = `${confidencePct}%`;
        const uiConfidenceValue = document.getElementById('confidence-value');
        uiConfidenceValue.textContent = `${confidencePct}%`;
        
        // Change UI accent color slightly based on emotion
        const rTheme = document.documentElement;
        if(maxEmotion === 'happy') {
            rTheme.style.setProperty('--accent-purple', '#22c55e'); // Greenish
            rTheme.style.setProperty('--accent-blue', '#10b981');
        } else if (maxEmotion === 'sad') {
            rTheme.style.setProperty('--accent-purple', '#3b82f6'); // Blueish
            rTheme.style.setProperty('--accent-blue', '#0ea5e9');
        } else if (maxEmotion === 'angry') {
            rTheme.style.setProperty('--accent-purple', '#ef4444'); // Redish
            rTheme.style.setProperty('--accent-blue', '#f97316');
        } else {
            // Default
            rTheme.style.setProperty('--accent-purple', '#a855f7');
            rTheme.style.setProperty('--accent-blue', '#3b82f6');
        }
    }
}

// Start sequence
loadModels();
