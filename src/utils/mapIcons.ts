import type { Map } from 'maplibre-gl';

const addArrowIcon = (map: Map) => {
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

const addTrainIcon = (map: Map) => {
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

const addStarIcon = (map: Map) => {
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
        let x: number;
        let y: number;
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

const addBusIcon = (map: Map) => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.clearRect(0, 0, size, size);
        ctx.strokeStyle = 'black';
        ctx.fillStyle = 'black';
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Pole
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(32, 34);
        ctx.lineTo(32, 58);
        ctx.stroke();

        // Big sign board
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(10, 8, 44, 28, 4);
        } else {
            ctx.rect(10, 8, 44, 28);
        }
        ctx.fill();

        if (map.hasImage('bus-icon')) map.removeImage('bus-icon');
        const imageData = ctx.getImageData(0, 0, size, size);
        map.addImage('bus-icon', imageData, { sdf: true });
    }
};

const addPosIcons = (map: Map) => {
    const size = 64;

    // Helper to add canvas as image
    const registerIcon = (name: string, draw: (ctx: CanvasRenderingContext2D) => void) => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, size, size);
            draw(ctx);
            if (map.hasImage(name)) map.removeImage(name);
            map.addImage(name, ctx.getImageData(0, 0, size, size), { sdf: false });
        }
    };

    // 1. Ticket Machine (Ticket Icon: Emerald circle badge + ticket outline with notch)
    registerIcon('pos-machine-icon', (ctx) => {
        ctx.fillStyle = '#10b981'; // Emerald
        ctx.beginPath();
        ctx.arc(32, 32, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // White Ticket symbol inside
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(19, 23, 26, 18, 3);
        } else {
            ctx.rect(19, 23, 26, 18);
        }
        ctx.fill();

        // Ticket notch line
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(28, 23);
        ctx.lineTo(28, 41);
        ctx.stroke();
    });

    // 2. Info Center (Cyan Circle + clean "i" symbol inside)
    registerIcon('pos-info-icon', (ctx) => {
        ctx.fillStyle = '#06b6d4'; // Cyan
        ctx.beginPath();
        ctx.arc(32, 32, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // White 'i' dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(32, 22, 3, 0, Math.PI * 2);
        ctx.fill();

        // White 'i' stem
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(29, 28, 6, 14, 1.5);
        } else {
            ctx.rect(29, 28, 6, 14);
        }
        ctx.fill();
    });

    // 3. Office / Counter (Purple Circle + Classic counter / bank columns design)
    registerIcon('pos-office-icon', (ctx) => {
        ctx.fillStyle = '#8b5cf6'; // Purple
        ctx.beginPath();
        ctx.arc(32, 32, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';

        // Roof / Pediment
        ctx.beginPath();
        ctx.moveTo(32, 19);
        ctx.lineTo(19, 26);
        ctx.lineTo(45, 26);
        ctx.closePath();
        ctx.fill();

        // Base
        ctx.fillRect(19, 41, 26, 3);

        // Columns
        ctx.fillRect(21, 28, 4, 11);
        ctx.fillRect(30, 28, 4, 11);
        ctx.fillRect(39, 28, 4, 11);
    });
};

export const addAllIcons = (map: Map) => {
    addArrowIcon(map);
    addTrainIcon(map);
    addBusIcon(map);
    addStarIcon(map);
    addPosIcons(map);
};
