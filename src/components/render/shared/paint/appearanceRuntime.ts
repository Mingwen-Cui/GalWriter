/** Standalone Web export counterpart of SurfaceLayers; no app dependencies. */
export const appearanceRuntimeScript = String.raw`
function gwAppearance(target,value,radius){
 if(!target||!value)return;
 queueMicrotask(function(){
  Array.from(target.children).filter(n=>n.dataset.gwAppearance).forEach(n=>n.remove());
  target.style.background='transparent';target.style.border='0';target.style.boxShadow='none';target.style.outline='0';
  if(getComputedStyle(target).position==='static')target.style.position='relative';
  const host=document.createElement('span');host.dataset.gwAppearance='true';host.setAttribute('aria-hidden','true');
  Object.assign(host.style,{position:'absolute',inset:'0',pointerEvents:'none',borderRadius:radius||'inherit',zIndex:'0'});
  function layer(){const node=document.createElement('span');Object.assign(node.style,{position:'absolute',inset:'0',borderRadius:'inherit'});return node;}
  (value.shadows||[]).slice().reverse().filter(s=>s.enabled).forEach(s=>{const n=layer();n.style.boxShadow=(s.inset?'inset ':'')+s.x+'px '+s.y+'px '+s.blur+'px '+s.spread+'px '+s.color;host.append(n);});
  const clip=layer();clip.style.overflow='hidden';host.append(clip);
  (value.fills||[]).slice().reverse().filter(f=>f.enabled).forEach(f=>{
   const n=f.type==='video'?document.createElement('video'):layer();Object.assign(n.style,{position:'absolute',inset:'0',width:'100%',height:'100%',opacity:String(f.opacity/100),backgroundSize:'cover',backgroundPosition:'center'});
   if(f.type==='video'){n.src=f.videoUrl||'';n.autoplay=true;n.loop=f.videoLoop!==false;n.muted=f.videoMuted!==false;n.playsInline=true;n.style.objectFit=f.videoFit==='fit'?'contain':'cover';}
   else if(f.type==='image')n.style.backgroundImage='url('+JSON.stringify(f.imageUrl||'')+')';
   else if(f.type==='gradient'){const stops=(f.gradientStops&&f.gradientStops.length?f.gradientStops:[{color:f.gradientStart,alpha:100,position:0},{color:f.gradientEnd,alpha:100,position:100}]).slice().sort((a,b)=>a.position-b.position).map(s=>{const c=/^#[a-f0-9]{6}$/i.test(s.color)?s.color+Math.round(Math.max(0,Math.min(100,s.alpha))*2.55).toString(16).padStart(2,'0'):s.color;return c+' '+s.position+'%';}).join(',');n.style.backgroundImage=f.gradientShape==='radial'?'radial-gradient(circle,'+stops+')':f.gradientShape==='diamond'?'conic-gradient(from '+f.gradientAngle+'deg,'+stops+')':'linear-gradient('+f.gradientAngle+'deg,'+stops+')';}
   else n.style.background=f.color;clip.append(n);
  });
  (value.strokes||[]).slice().reverse().filter(s=>s.enabled).forEach(s=>{const n=layer();n.style.inset=(s.position==='outside'?-s.width:s.position==='center'?-s.width/2:0)+'px';n.style.border=s.width+'px solid '+s.color;n.style.boxSizing='border-box';host.append(n);});
  Array.from(target.childNodes).forEach(n=>{if(n.nodeType===3&&n.textContent.trim()){const text=document.createElement('span');text.textContent=n.textContent;n.replaceWith(text);}});
  Array.from(target.children).forEach(n=>{if(n.style){if(!n.style.position)n.style.position='relative';if(!n.style.zIndex)n.style.zIndex='1';}});
  target.prepend(host);
 });
}
`;
