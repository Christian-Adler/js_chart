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

    this.ctx = this.canvas.getContext('2d');

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
      if (dragInfo.dragging) {
        dragInfo.end = this.#getMouse(evt, true);
        dragInfo.offset = math.scale(
            math.subtract(dragInfo.start, dragInfo.end),
            dataTrans.scale
        );
        const newOffset = math.add(dataTrans.offset, dragInfo.offset);
        this.#updateDataBounds(newOffset, dataTrans.scale);
      }

      // in pixel space
      const pLoc = this.#getMouse(evt);
      const pPoints = this.samples.map(s => math.remapPoint(this.dataBounds, this.pixelBounds, s.point));
      const index = math.getNearest(pLoc, pPoints);
      const nearest = this.samples[index];
      const dist = math.distance(pPoints[index], pLoc);
      if (dist < this.margin / 2)
        this.hoveredSample = nearest;
      else
        this.hoveredSample = null;
      this.#draw();
    };
    canvas.onmouseup = (evt) => {
      dataTrans.offset = math.add(dataTrans.offset, dragInfo.offset);
      dragInfo.dragging = false;
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
      this.#draw();
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
    this.#drawSamples(this.samples);
    ctx.globalAlpha = 1;

    if (this.hoveredSample)
      this.#emphasizeSamples(this.hoveredSample);
    if (this.selectedSample)
      this.#emphasizeSamples(this.selectedSample, "yellow");

    this.#drawAxis();
  }

  selectSample(sample) {
    this.selectedSample = sample;
    this.#draw();
  }

  #emphasizeSamples(sample, color = 'white') {
    const pLoc = math.remapPoint(this.dataBounds, this.pixelBounds, sample.point);
    const grd = this.ctx.createRadialGradient(...pLoc, 0, ...pLoc, this.margin);
    grd.addColorStop(0, color);
    grd.addColorStop(1, 'rgba(255,255,255,0');
    graphics.drawPoint(this.ctx, pLoc, grd, this.margin * 2);
    this.#drawSamples([sample]);
  }

  #drawAxis() {
    const {ctx, canvas, axesLabels, margin} = this;
    const {left, right, top, bottom} = this.pixelBounds;

    ctx.clearRect(0, 0, canvas.width, margin);
    ctx.clearRect(0, 0, margin, canvas.height);
    ctx.clearRect(this.canvas.width - margin, 0, margin, this.canvas.height);
    ctx.clearRect(0, this.canvas.height - margin, this.canvas.width, margin);

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

  #drawSamples(samples) {
    const {ctx, dataBounds, pixelBounds} = this;
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