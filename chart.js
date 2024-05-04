class Chart {
  constructor(container, samples, options, onClick = null) {
    this.samples = samples;
    // this.options = options;
    this.axesLabels = options.axesLabels;
    this.styles = options.styles;
    this.icon = options.icon;
    this.onClick = onClick;

    this.canvas = document.createElement('canvas');
    this.canvas.width = options.size;
    this.canvas.height = options.size;
    this.canvas.style.backgroundColor = 'white';
    container.appendChild(this.canvas);

    this.canvasLayer = document.createElement('canvas');
    this.canvasLayer.classList.add('layer');
    this.canvasLayer.width = options.size;
    this.canvasLayer.height = options.size;
    this.canvasLayer.style.backgroundColor = 'transparent';
    container.appendChild(this.canvasLayer);

    this.ctx = this.canvas.getContext('2d');
    this.ctxLayer = this.canvasLayer.getContext('2d');

    this.margin = options.size * 0.1;
    this.transparency = options.transparency || 1;

    this.dataTrans = {
      offset: [0, 0],
      scale: 1 // zoom
    };
    this.dragInfo = {
      start: [0, 0],
      end: [0, 0],
      offset: [0, 0],
      dragging: false
    };

    this.mouseInfo = {dLoc: null, pLoc: null};

    this.hoveredSample = null;
    this.selectedSample = null;

    this.pixelBounds = this.#getPixelBounds();
    this.dataBounds = this.#getDataBounds();
    this.defaultDataBounds = this.#getDataBounds(); // backup

    this.#draw();

    this.#addEventListeners();

  }

  #addEventListeners() {
    const {canvas, dataTrans, dragInfo} = this;
    canvas.onmousedown = (evt) => {
      dragInfo.start = this.#getMouse(evt, true);
      dragInfo.dragging = true;
      dragInfo.end = [0, 0];
      dragInfo.offset = [0, 0];
    };
    canvas.onmousemove = (evt) => {
      let fullRedraw = false;

      this.mouseInfo.dLoc = this.#getMouse(evt, true);

      if (dragInfo.dragging) {
        dragInfo.end = this.mouseInfo.dLoc;
        dragInfo.offset = math.scale(
            math.subtract(dragInfo.start, dragInfo.end),
            dataTrans.scale
        );
        const newOffset = math.add(dataTrans.offset, dragInfo.offset);
        this.#updateDataBounds(newOffset, dataTrans.scale);
        fullRedraw = true;
      }

      // in pixel space
      this.mouseInfo.pLoc = this.#getMouse(evt);
      const pPoints = this.samples.map(s => math.remapPoint(this.dataBounds, this.pixelBounds, s.point));
      const index = math.getNearest(this.mouseInfo.pLoc, pPoints);
      const nearest = this.samples[index];
      const dist = math.distance(pPoints[index], this.mouseInfo.pLoc);
      if (dist < this.margin / 2)
        this.hoveredSample = nearest;
      else
        this.hoveredSample = null;


      if (fullRedraw)
        this.#draw();
      else
        this.#drawLayer();
    };
    canvas.onmouseup = (/*evt*/) => {
      dataTrans.offset = math.add(dataTrans.offset, dragInfo.offset);
      dragInfo.dragging = false;
    };
    canvas.onmouseout = (_) => {
      this.mouseInfo.dLoc = null;
      this.mouseInfo.pLoc = null;
      this.#drawLayer();
    };
    canvas.onwheel = (evt) => {
      const dir = Math.sign(evt.deltaY);
      const step = dataTrans.scale * 0.05;
      dataTrans.scale += dir * step;
      dataTrans.scale = Math.max(0.01, Math.min(3, dataTrans.scale));

      this.#updateDataBounds(dataTrans.offset, dataTrans.scale);
      this.#draw();
      evt.preventDefault();
      return false;
    };

    canvas.onclick = () => {
      if (!math.equals(dragInfo.offset, [0, 0]))
        return;
      if (this.hoveredSample) {
        // click again on the same -> deselect
        if (this.selectedSample === this.hoveredSample) {
          this.selectedSample = null;
        } else {
          this.selectedSample = this.hoveredSample;
        }
      } else {
        this.selectedSample = null;
      }
      if (this.onClick)
        this.onClick(this.selectedSample);
      this.#drawLayer();
    };
  }

  #updateDataBounds(offset, scale) {
    const {dataBounds, defaultDataBounds: def} = this;
    dataBounds.left = def.left + offset[0];
    dataBounds.right = def.right + offset[0];
    dataBounds.top = def.top + offset[1];
    dataBounds.bottom = def.bottom + offset[1];

    const center = [(dataBounds.left + dataBounds.right) / 2, (dataBounds.top + dataBounds.bottom) / 2];
    dataBounds.left = math.lerp(center[0], dataBounds.left, scale);
    dataBounds.right = math.lerp(center[0], dataBounds.right, scale);
    dataBounds.top = math.lerp(center[1], dataBounds.top, scale);
    dataBounds.bottom = math.lerp(center[1], dataBounds.bottom, scale);
  }

  #getMouse(evt, dataSpace = false) {
    const rect = this.canvas.getBoundingClientRect();
    const pixelLoc = [evt.clientX - rect.left, evt.clientY - rect.top];
    if (dataSpace)
      return math.remapPoint(this.pixelBounds, this.defaultDataBounds, pixelLoc);
    return pixelLoc;
  }

  #getPixelBounds() {
    const {canvas, margin} = this;
    return {
      left: margin,
      right: canvas.width - margin,
      top: margin,
      bottom: canvas.height - margin
    };
  }

  #getDataBounds() {
    const {samples} = this;
    const x = samples.map(s => s.point[0]);
    const y = samples.map(s => s.point[1]);

    const minX = Math.min(...x);
    const maxX = Math.max(...x);
    const minY = Math.min(...y);
    const maxY = Math.max(...y);

    return {
      left: minX,
      right: maxX,
      top: maxY,
      bottom: minY
    };
  }

  #draw() {
    const {ctx, canvas} = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.globalAlpha = this.transparency;
    this.#drawSamples(ctx, this.samples);
    ctx.globalAlpha = 1;

    this.#drawLayer();

    this.#drawAxis();
  }

  #drawLayer() {
    const {ctxLayer: ctx, canvasLayer: canvas, margin} = this;
    const {left, right, top, bottom} = this.pixelBounds;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.hoveredSample)
      this.#emphasizeSamples(ctx, this.hoveredSample);
    if (this.selectedSample)
      this.#emphasizeSamples(ctx, this.selectedSample, "yellow");

    this.#clearMargin(ctx, canvas, margin);

    const pLoc = this.mouseInfo.pLoc;
    if (pLoc) {
      const circleRad = 8;
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'darkgray';

      ctx.beginPath();
      if (pLoc[0] > left + circleRad) {
        ctx.moveTo(left, pLoc[1]);
        ctx.lineTo(left - margin + pLoc[0] - circleRad, pLoc[1]);
      }
      if (pLoc[0] < right - circleRad) {
        ctx.moveTo(left - margin + pLoc[0] + circleRad, pLoc[1]);
        ctx.lineTo(right, pLoc[1]);
      }
      if (pLoc[1] > top + circleRad) {
        ctx.moveTo(pLoc[0], top);
        ctx.lineTo(pLoc[0], top - margin + pLoc[1] - circleRad);
      }
      if (pLoc[1] < bottom - circleRad) {
        ctx.moveTo(pLoc[0], top - margin + pLoc[1] + circleRad);
        ctx.lineTo(pLoc[0], bottom);
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(...pLoc, circleRad, 0, Math.PI * 2);
      ctx.stroke();

    }


    const dLoc = this.mouseInfo.dLoc;
    if (dLoc) {
      graphics.drawText(ctx, {
        text: math.formatNumber(dLoc[0], 2),
        loc: [canvas.width / 2, margin / 2],
        size: margin * 0.6
      });

      ctx.save();
      ctx.translate(right + margin / 2, canvas.height / 2);
      ctx.rotate(-Math.PI / 2);
      graphics.drawText(ctx, {
        text: math.formatNumber(dLoc[1], 2),
        loc: [0, 0],
        size: margin * 0.6
      });
      ctx.restore();
    }
  }

  selectSample(sample) {
    this.selectedSample = sample;
    this.#drawLayer();
  }

  #emphasizeSamples(ctx, sample, color = 'white') {
    const pLoc = math.remapPoint(this.dataBounds, this.pixelBounds, sample.point);
    const grd = ctx.createRadialGradient(...pLoc, 0, ...pLoc, this.margin);
    grd.addColorStop(0, color);
    grd.addColorStop(1, 'rgba(255,255,255,0');
    graphics.drawPoint(ctx, pLoc, grd, this.margin * 2);
    this.#drawSamples(ctx, [sample]);
  }

  #drawAxis() {
    const {ctx, canvas, axesLabels, margin} = this;
    const {left, right, top, bottom} = this.pixelBounds;
    this.#clearMargin(ctx, canvas, margin);

    graphics.drawText(ctx, {
      text: axesLabels[0],
      loc: [canvas.width / 2, bottom + margin / 2],
      size: margin * 0.6
    });

    ctx.save();
    ctx.translate(left - margin / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    graphics.drawText(ctx, {
      text: axesLabels[1],
      loc: [0, 0],
      size: margin * 0.6
    });
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.lineTo(right, bottom);
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'lightgrey';
    ctx.stroke();
    ctx.setLineDash([]); // reset

    const dataMin = math.remapPoint(this.pixelBounds, this.dataBounds, [left, bottom]);
    const dataMax = math.remapPoint(this.pixelBounds, this.dataBounds, [right, top]);
    graphics.drawText(ctx, {
      text: math.formatNumber(dataMin[0], 2),
      loc: [left, bottom],
      size: margin * 0.3,
      align: 'left',
      vAlign: 'top'
    });
    ctx.save();
    ctx.translate(left, bottom);
    ctx.rotate(-Math.PI / 2);
    graphics.drawText(ctx, {
      text: math.formatNumber(dataMin[1], 2),
      loc: [0, 0],
      size: margin * 0.3,
      align: 'left',
      vAlign: 'bottom'
    });
    ctx.restore();
    graphics.drawText(ctx, {
      text: math.formatNumber(dataMax[0], 2),
      loc: [right, bottom],
      size: margin * 0.3,
      align: 'right',
      vAlign: 'top'
    });
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(-Math.PI / 2);
    graphics.drawText(ctx, {
      text: math.formatNumber(dataMax[1], 2),
      loc: [0, 0],
      size: margin * 0.3,
      align: 'right',
      vAlign: 'bottom'
    });
    ctx.restore();
  }

  #clearMargin(ctx, canvas, margin) {
    ctx.clearRect(0, 0, canvas.width, margin);
    ctx.clearRect(0, 0, margin, canvas.height);
    ctx.clearRect(this.canvas.width - margin, 0, margin, this.canvas.height);
    ctx.clearRect(0, this.canvas.height - margin, this.canvas.width, margin);
  }

  #drawSamples(ctx, samples) {
    const {dataBounds, pixelBounds} = this;
    for (const sample of samples) {
      const {point, label} = sample;
      const pixelLoc = math.remapPoint(dataBounds, pixelBounds, point);

      switch (this.icon) {
        case 'text':
          graphics.drawText(ctx, {text: this.styles[label].text, loc: pixelLoc, size: 26});
          break;
        case 'image':
          graphics.drawImage(ctx, this.styles[label].image, pixelLoc);
          break;
        default:
          graphics.drawPoint(ctx, pixelLoc, this.styles[label].color);
          break;
      }
    }
  }

}