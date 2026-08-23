// Toolkit screenshot crop only: accept every non-empty selection. This file
// is separate from Tibia Mirror's native selector and must not inherit its
// minimum-region constraint or its native mirror state.
const minimum = 1;
const magnifierSize = 200;
const magnifierSample = 48;
const selector = document.querySelector('#selector');
const selectionEl = document.querySelector('#selection');
const instruction = document.querySelector('#instruction');
const size = document.querySelector('#size');
const actions = document.querySelector('#actions');
const magnifier = document.querySelector('#magnifier');
const magnifierCanvas = document.querySelector('#magnifier-canvas');
const magnifierContext = magnifierCanvas.getContext('2d');
const state = { rect:null, mode:'idle', start:null, original:null, handle:'' };
const magnifierState = { preview:null, image:null, ready:false };

function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
const selectorParams = new URLSearchParams(window.location.search);
const allowedBounds = (() => {
  const rawX = Number(selectorParams.get('allowedX'));
  const rawY = Number(selectorParams.get('allowedY'));
  const rawWidth = Number(selectorParams.get('allowedWidth'));
  const rawHeight = Number(selectorParams.get('allowedHeight'));
  const x = clamp(Number.isFinite(rawX) ? rawX : 0, 0, Math.max(0, innerWidth - 1));
  const y = clamp(Number.isFinite(rawY) ? rawY : 0, 0, Math.max(0, innerHeight - 1));
  const width = clamp(Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : innerWidth - x, 1, innerWidth - x);
  const height = clamp(Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : innerHeight - y, 1, innerHeight - y);
  return { x, y, width, height };
})();
const allowedRight = () => allowedBounds.x + allowedBounds.width;
const allowedBottom = () => allowedBounds.y + allowedBounds.height;
function point(event) { return { x:clamp(event.clientX,allowedBounds.x,allowedRight()), y:clamp(event.clientY,allowedBounds.y,allowedBottom()) }; }
function normalized(a,b) { const x=Math.min(a.x,b.x), y=Math.min(a.y,b.y); return {x,y,width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)}; }

function placeMagnifier(cursor) {
  const gap = 28;
  const right = cursor.x + gap;
  const left = cursor.x - magnifierSize - gap;
  const x = right + magnifierSize <= innerWidth ? right : Math.max(8, left);
  const below = cursor.y + gap;
  const above = cursor.y - magnifierSize - gap;
  const y = below + magnifierSize <= innerHeight ? below : Math.max(8, above);
  magnifier.style.left = `${Math.round(clamp(x, 8, Math.max(8, innerWidth - magnifierSize - 8)))}px`;
  magnifier.style.top = `${Math.round(clamp(y, 8, Math.max(8, innerHeight - magnifierSize - 8)))}px`;
}

function updateMagnifier(cursor) {
  if (!magnifierState.ready || !magnifierState.preview || !magnifierState.image) return;
  const preview = magnifierState.preview;
  const image = magnifierState.image;
  const sourceX = cursor.x / Math.max(1, preview.displayWidth) * image.naturalWidth;
  const sourceY = cursor.y / Math.max(1, preview.displayHeight) * image.naturalHeight;
  const sourceWidth = Math.max(1, magnifierSample / Math.max(1, preview.displayWidth) * image.naturalWidth);
  const sourceHeight = Math.max(1, magnifierSample / Math.max(1, preview.displayHeight) * image.naturalHeight);
  const sx = clamp(sourceX - sourceWidth / 2, 0, Math.max(0, image.naturalWidth - sourceWidth));
  const sy = clamp(sourceY - sourceHeight / 2, 0, Math.max(0, image.naturalHeight - sourceHeight));
  magnifierContext.save();
  magnifierContext.imageSmoothingEnabled = false;
  magnifierContext.clearRect(0, 0, magnifierCanvas.width, magnifierCanvas.height);
  magnifierContext.drawImage(image, sx, sy, sourceWidth, sourceHeight, 0, 0, magnifierCanvas.width, magnifierCanvas.height);
  magnifierContext.restore();
  placeMagnifier(cursor);
  magnifier.hidden = false;
}

async function initializeMagnifier() {
  try {
    const preview = await window.screenVisionApi.preview.get();
    if (!preview?.dataUrl || !preview.imageWidth || !preview.imageHeight) return;
    const image = new Image();
    image.onload = () => {
      magnifierState.preview = preview;
      magnifierState.image = image;
      magnifierState.ready = true;
      updateMagnifier({
        x:clamp(Number(preview.initialCursor?.x) || 0, allowedBounds.x, allowedRight()),
        y:clamp(Number(preview.initialCursor?.y) || 0, allowedBounds.y, allowedBottom())
      });
    };
    image.src = preview.dataUrl;
  } catch {
    // The screenshot selector remains fully usable if the optional preview is unavailable.
  }
}

function draw(rect) { state.rect=rect; selectionEl.hidden=false; selectionEl.style.left=`${rect.x}px`; selectionEl.style.top=`${rect.y}px`; selectionEl.style.width=`${rect.width}px`; selectionEl.style.height=`${rect.height}px`; size.hidden=false; size.textContent=`${Math.round(rect.width)} x ${Math.round(rect.height)}`; size.style.left=`${rect.x+8}px`; size.style.top=`${Math.max(8,rect.y-31)}px`; actions.hidden=false; actions.style.left=`${Math.max(8,rect.x+rect.width-84)}px`; actions.style.top=`${Math.max(8,rect.y-46)}px`; }
function finish() { if (!state.rect || state.rect.width<minimum || state.rect.height<minimum) { state.rect=null; selectionEl.hidden=true; actions.hidden=true; size.hidden=true; instruction.textContent='Clique e arraste para selecionar uma área.'; } else { instruction.textContent='Ajuste pelos quadrados verdes e confirme ou cancele.'; } state.mode='idle'; state.start=null; state.original=null; state.handle=''; }
function resize(origin, handle, current) {
  let {x,y,width,height}=origin;
  const right=x+width;
  const bottom=y+height;
  if (handle.includes('west')) {
    x=clamp(current.x,allowedBounds.x,right-minimum);
    width=right-x;
  }
  if (handle.includes('east')) width=clamp(current.x-x,minimum,allowedRight()-x);
  if (handle.includes('north')) {
    y=clamp(current.y,allowedBounds.y,bottom-minimum);
    height=bottom-y;
  }
  if (handle.includes('south')) height=clamp(current.y-y,minimum,allowedBottom()-y);
  return {x,y,width,height};
}

selector.addEventListener('pointerdown',(event)=>{ if(event.button!==0 || event.target.closest('#actions'))return; if(event.clientX<allowedBounds.x || event.clientX>allowedRight() || event.clientY<allowedBounds.y || event.clientY>allowedBottom())return; const handle=event.target.closest('[data-handle]')?.dataset.handle; const p=point(event); updateMagnifier(p); if(handle&&state.rect){state.mode='resize';state.handle=handle;state.start=p;state.original={...state.rect};} else if(event.target.closest('#selection')&&state.rect){state.mode='move';state.start=p;state.original={...state.rect};} else {state.mode='draw';state.start=p;state.rect={x:p.x,y:p.y,width:0,height:0}; actions.hidden=true; instruction.textContent='Arraste para selecionar a área.';} selector.setPointerCapture(event.pointerId); event.preventDefault(); });
selector.addEventListener('pointermove',(event)=>{ const p=point(event); updateMagnifier(p); if(state.mode==='idle')return; if(state.mode==='draw')draw(normalized(state.start,p)); else if(state.mode==='move'){const dx=p.x-state.start.x,dy=p.y-state.start.y;draw({...state.original,x:clamp(state.original.x+dx,allowedBounds.x,allowedRight()-state.original.width),y:clamp(state.original.y+dy,allowedBounds.y,allowedBottom()-state.original.height)});} else draw(resize(state.original,state.handle,p)); });
selector.addEventListener('pointerup',(event)=>{ if(state.mode!=='idle'){try{selector.releasePointerCapture(event.pointerId)}catch{} finish();} });
document.querySelector('#cancel').addEventListener('click',()=>window.screenVisionApi.selection.cancel());
document.querySelector('#confirm').addEventListener('click',()=>{if(state.rect?.width>=minimum&&state.rect?.height>=minimum)window.screenVisionApi.selection.complete({captureBounds:state.rect});});
document.addEventListener('keydown',(event)=>{if(event.key==='Escape')window.screenVisionApi.selection.cancel(); if(event.key==='Enter'&&state.rect)document.querySelector('#confirm').click();});

void initializeMagnifier();
