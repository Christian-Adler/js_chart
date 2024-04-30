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
  }
}