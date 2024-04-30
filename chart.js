class Chart {
  constructor(container, samples, options) {
    this.samples = samples;
    // this.options = options;
    this.axesLabels = options.axesLabels;
    this.styles = options.styles;

    this.canvas = document.createElement('canvas');
    this.canvas.width = options.size;
    this.canvas.height = options.size;
    this.canvas.style.backgroundColor = 'white';
    container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');

    this.margin = options.size * 0.1;
    this.transparency = 0.5;

    this.pixelBounds = this.#getPixelBounds();
    this.dataBounds = this.#getDataBounds();

    this.#draw();
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
    this.#drawSamples();
    ctx.globalAlpha = 1;

  }

  #drawSamples() {
    const {ctx, samples, dataBounds, pixelBounds} = this;
    for (const sample of samples) {
      const {point} = sample;
      const pixelLocation = [
        math.remap(dataBounds.left, dataBounds.right, pixelBounds.left, pixelBounds.right, point[0]),
        math.remap(dataBounds.top, dataBounds.bottom, pixelBounds.top, pixelBounds.bottom, point[1])
      ];
      graphics.drawPoint(ctx, pixelLocation);
    }
  }
}