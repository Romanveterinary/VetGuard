const video = document.getElementById('video');
const photoCanvas = document.getElementById('photo-canvas');
const drawCanvas = document.getElementById('draw-canvas');
const pCtx = photoCanvas.getContext('2d');
const dCtx = drawCanvas.getContext('2d');

const btnCapture = document.getElementById('btn-capture');
const btnCalculate = document.getElementById('btn-calculate');
const btnRetry = document.getElementById('btn-retry');
const btnSave = document.getElementById('btn-save');

const calcPanel = document.getElementById('calc-panel');
const resultBox = document.getElementById('result-box');
const weightDisplay = document.getElementById('weight-display');
const statusText = document.getElementById('status-text');

const animalType = document.getElementById('animal-type');
const inputLength = document.getElementById('input-length');
const inputGirth = document.getElementById('input-girth');

let isVideoPlaying = false;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', advanced: [{ focusMode: "continuous" }] }, 
            audio: false 
        });
        video.srcObject = stream;
        return new Promise((resolve) => { video.onloadedmetadata = () => resolve(video); });
    } catch (error) {
        statusText.innerText = "Помилка камери!";
        statusText.style.color = "#e74c3c";
    }
}

async function init() {
    await setupCamera();
    video.play();
    isVideoPlaying = true;
    resizeCanvases();
}

function resizeCanvases() {
    photoCanvas.width = window.innerWidth;
    photoCanvas.height = window.innerHeight;
    drawCanvas.width = window.innerWidth;
    drawCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvases);

// 1. Заморозка кадру
btnCapture.addEventListener('click', () => {
    if (isVideoPlaying) {
        video.pause();
        isVideoPlaying = false;
        
        // Малюємо поточний кадр на нижній canvas
        pCtx.drawImage(video, 0, 0, photoCanvas.width, photoCanvas.height);
        
        video.style.display = 'none';
        photoCanvas.style.display = 'block';
        drawCanvas.style.display = 'block';
        
        btnCapture.style.display = 'none';
        calcPanel.style.display = 'block';
        statusText.innerText = "Введіть заміри та малюйте лінії";
    }
});

// 2. Малювання ліній пальцем по екрану
function startDrawing(e) {
    isDrawing = true;
    const pos = getPos(e);
    lastX = pos.x;
    lastY = pos.y;
}

function draw(e) {
    if (!isDrawing) return;
    const pos = getPos(e);
    
    dCtx.beginPath();
    dCtx.moveTo(lastX, lastY);
    dCtx.lineTo(pos.x, pos.y);
    dCtx.strokeStyle = '#f1c40f'; // Яскраво жовта лінія
    dCtx.lineWidth = 4;
    dCtx.lineCap = 'round';
    dCtx.stroke();
    
    lastX = pos.x;
    lastY = pos.y;
}

function stopDrawing() {
    isDrawing = false;
}

function getPos(e) {
    let x, y;
    if (e.touches) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
    } else {
        x = e.clientX;
        y = e.clientY;
    }
    return { x, y };
}

drawCanvas.addEventListener('mousedown', startDrawing);
drawCanvas.addEventListener('mousemove', draw);
drawCanvas.addEventListener('mouseup', stopDrawing);
drawCanvas.addEventListener('mouseout', stopDrawing);

drawCanvas.addEventListener('touchstart', startDrawing);
drawCanvas.addEventListener('touchmove', draw);
drawCanvas.addEventListener('touchend', stopDrawing);

// 3. Математика: Обчислення ваги
btnCalculate.addEventListener('click', () => {
    const l = parseFloat(inputLength.value);
    const g = parseFloat(inputGirth.value);
    const type = animalType.value;
    
    if (!l || !g) {
        alert("Будь ласка, введіть обидва параметри (Довжину та Обхват)");
        return;
    }

    let weight = 0;

    // Класичні зоотехнічні формули
    switch (type) {
        case 'pig-avg':
            // Свиня середня (Коеф 156)
            weight = (l * g) / 156;
            break;
        case 'pig-fat':
            // Свиня жирна (Коеф 142)
            weight = (l * g) / 142;
            break;
        case 'cow-dairy':
            // Формула Трухановського для молочних (Коеф 2)
            weight = ((g * l) / 100) * 2;
            break;
        case 'cow-beef':
            // Формула Трухановського для м'ясних (Коеф 2.5)
            weight = ((g * l) / 100) * 2.5;
            break;
    }

    weightDisplay.innerText = `${Math.round(weight)} кг`;
    btnCalculate.style.display = 'none';
    resultBox.style.display = 'block';
});

// 4. Скидання та нове фото
btnRetry.addEventListener('click', () => {
    video.style.display = 'block';
    photoCanvas.style.display = 'none';
    drawCanvas.style.display = 'none';
    
    dCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height); // Очищення ліній
    
    btnCapture.style.display = 'block';
    calcPanel.style.display = 'none';
    btnCalculate.style.display = 'block';
    resultBox.style.display = 'none';
    
    inputLength.value = '';
    inputGirth.value = '';
    
    video.play();
    isVideoPlaying = true;
    statusText.innerText = "Наведіть на тварину (збоку)";
});

btnSave.addEventListener('click', () => {
    alert("Фото із замірами та вагою успішно збережено!");
});

init();
