import type { Map } from 'maplibre-gl';


export const addArrowIcon = (map: Map) => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(32, 12);
        ctx.lineTo(18, 46);
        ctx.lineTo(32, 38);
        ctx.lineTo(46, 46);
        ctx.closePath();
        ctx.fill();

        if (map.hasImage('v-arrow-centered')) map.removeImage('v-arrow-centered');
        const imageData = ctx.getImageData(0, 0, size, size);
        map.addImage('v-arrow-centered', imageData, { sdf: true });
    }
};

// Removed canvas-based transfer logic in favor of native WebGL circles




export const addTrainIcon = (map: Map) => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.clearRect(0, 0, size, size);
        ctx.strokeStyle = 'black'; // for SDF mask
        ctx.fillStyle = 'black';
        ctx.lineWidth = 2 * (64 / 24);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const s = 64 / 24;

        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(4 * s, 3 * s, 16 * s, 16 * s, 2 * s);
        } else {
            ctx.rect(4 * s, 3 * s, 16 * s, 16 * s);
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(4 * s, 11 * s);
        ctx.lineTo(20 * s, 11 * s);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(12 * s, 3 * s);
        ctx.lineTo(12 * s, 11 * s);
        ctx.stroke();

        // Left leg
        ctx.beginPath();
        ctx.moveTo(8 * s, 19 * s);
        ctx.lineTo(6 * s, 22 * s);
        ctx.stroke();

        // Right leg
        ctx.beginPath();
        ctx.moveTo(16 * s, 19 * s);
        ctx.lineTo(18 * s, 22 * s);
        ctx.stroke();

        // Lights
        ctx.beginPath();
        ctx.arc(8 * s, 15 * s, 1 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(16 * s, 15 * s, 1 * s, 0, Math.PI * 2);
        ctx.fill();

        if (map.hasImage('train-icon')) map.removeImage('train-icon');
        const imageData = ctx.getImageData(0, 0, size, size);
        map.addImage('train-icon', imageData, { sdf: true });
    }
};

export const addStarIcon = (map: Map) => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = 'black'; // for SDF mask
        
        const cx = 32;
        const cy = 32;
        const spikes = 5;
        const outerRadius = 24;
        const innerRadius = 12;

        ctx.beginPath();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;

        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();

        if (map.hasImage('favorite-star')) map.removeImage('favorite-star');
        const imageData = ctx.getImageData(0, 0, size, size);
        map.addImage('favorite-star', imageData, { sdf: true });
    }
};

export const addAllIcons = (map: Map) => {
    addArrowIcon(map);
    addTrainIcon(map);
    addStarIcon(map);
};
