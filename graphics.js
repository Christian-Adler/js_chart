const graphics = {};
graphics.drawPoint = (ctx, loc, color = 'black', size = 8) => {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(...loc, size / 2, 0, Math.PI * 2);
  ctx.fill();
}

graphics.drawText = (ctx, {text, loc, align = 'center', vAlign = 'middle', size = 10, color = 'black'}) => {
  ctx.textAlign = align;
  ctx.textBaseline = vAlign;
  ctx.font = 'bold ' + size + 'px Courier';
  ctx.fillStyle = color;
  ctx.fillText(text, ...loc);
};

graphics.drawImage = (ctx, image, loc) => {
  ctx.beginPath();
  ctx.drawImage(image,
      loc[0] - image.width / 2,
      loc[1] - image.height / 2,
      image.width, image.height
  );
  ctx.fill();
};

graphics.generateImages = (styles, size = 20) => {
  for (const styleType of Object.keys(styles)) {
    const style = styles[styleType];
    const canvas = document.createElement("canvas");
    canvas.width = size + 10; // add a bit of padding
    canvas.height = size + 10;

    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = size + 'px Courier';

    if (style.color === 'red')
      ctx.filter = `
      brightness(2)
      contrast(0.3)
      sepia(1)
      brightness(0.7)
      hue-rotate(-45deg)
      saturate(3)
      contrast(3)
      `;
    else
      ctx.filter = 'grayscale(1)';

    ctx.fillText(style.text, canvas.width / 2, canvas.height / 2);
    style['image'] = new Image();
    style['image'].src = canvas.toDataURL();
  }
};