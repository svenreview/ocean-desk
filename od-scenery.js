// Ocean Desk 2.0 — original, self-contained SVG landscape illustrations.
// No stock photography, remote image requests, or per-scene data fetching.
(function(root){
  'use strict';
  const palettes={
    'santorini-terrace':['#88d2e8','#d6f2e4','#2e94ae','#15586c','#faf8ed'],
    'santorini-sunset':['#f2a287','#fde0b1','#ae798c','#425979','#fcdfb8'],
    'santorini-night':['#142944','#385f83','#1e4966','#102c47','#dfe9e9'],
    'bali-ocean-cafe':['#5fbfc7','#e3f4d0','#289ead','#146879','#f7e9bd'],
    'bali-sunset':['#e98c72','#f7cc93','#b77379','#395b70','#ffe2ae'],
    'bali-forest':['#9ac4a1','#d4ddab','#3e8168','#245346','#e0d2a7'],
    'jeju-coast':['#87cdd7','#ddede5','#338d9f','#1d6570','#c8d2b9'],
    'jeju-forest':['#b0c7ad','#e5ddba','#699984','#315c53','#ebddbc'],
    'jeju-rain':['#8fa8b6','#c1cdd0','#637f91','#355266','#d5d2c7']
  };
  const rect=(x,y,w,h,fill,extra='')=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+fill+'" '+extra+'/>';
  const path=(d,fill,extra='')=>'<path d="'+d+'" fill="'+fill+'" '+extra+'/>';
  function scenerySvg(scene){
    const p=palettes[scene];
    if(!p)return null;
    const [sky,light,sea,deep,detail]=p;
    const isNight=scene.endsWith('night');
    const isForest=scene.endsWith('forest');
    const isRain=scene.endsWith('rain');
    const isSunset=scene.endsWith('sunset');
    const region=scene.split('-')[0];
    const sunX=isSunset?850:270, sunY=isSunset?260:130;
    const skyGradient='<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="'+sky+'"/><stop offset="1" stop-color="'+light+'"/></linearGradient><linearGradient id="water" x2="0" y2="1"><stop stop-color="'+sea+'"/><stop offset="1" stop-color="'+deep+'"/></linearGradient></defs>';
    let shapes='';
    if(isForest || isRain){
      shapes+=path('M0 360 Q190 175 355 280 Q515 125 690 275 Q885 165 1200 320 L1200 675 H0Z',sea);
      shapes+=path('M0 480 Q235 270 490 420 Q770 265 1200 440 L1200 675 H0Z',deep,'opacity=".66"');
      for(let i=0;i<12;i++){
        const x=i*111-55,h=165+(i%4)*45;
        shapes+=rect(x,570-h,14,h,'#23483f','opacity=".65"');
        shapes+=path('M'+(x-47)+' '+(580-h)+' Q'+(x+7)+' '+(430-h)+' '+(x+65)+' '+(580-h)+'Z',i%3===0?sea:deep,'opacity=".9"');
      }
      if(isRain){
        shapes+=rect(0,0,1200,675,'#667d91','opacity=".13"');
        for(let i=0;i<42;i++){
          const x=(i*173)%1200,y=(i*79)%600;
          shapes+='<path d="M'+x+' '+y+' l-16 39" stroke="'+detail+'" stroke-width="2" opacity=".3"/>';
        }
      }
    }else{
      shapes+=rect(0,350,1200,325,'url(#water)');
      shapes+=path('M0 345 Q250 312 460 343 Q740 321 1200 340 L1200 405 Q900 385 690 407 Q290 376 0 407Z',light,'opacity=".42"');
      shapes+=path('M0 499 Q180 470 330 498 T690 495 T1200 495 L1200 675 H0Z',deep,'opacity=".2"');
      for(let i=0;i<8;i++){
        const x=50+i*170,y=425+(i%3)*58;
        shapes+='<path d="M'+x+' '+y+' q32 -9 76 0" stroke="'+detail+'" stroke-width="4" opacity=".24" fill="none" stroke-linecap="round"/>';
      }
      if(region==='jeju'){
        shapes+=path('M220 347 Q385 236 554 338 L620 360 H210Z',deep,'opacity=".65"');
        shapes+=path('M0 462 L100 425 175 452 245 417 294 466 350 452 398 482 0 530Z',deep);
      }
      if(region==='santorini'){
        shapes+=path('M880 345 L1015 277 1200 296 L1200 675 890 675Z',detail,'opacity=".9"');
        for(let i=0;i<5;i++){
          const x=915+i*55,y=266+(i%2)*20;
          shapes+=rect(x,y,65,103,'#fff8ed');
          shapes+=path('M'+x+' '+y+' q32 -48 65 0Z',i%2===0?'#3f8caf':'#80b6c5');
          shapes+=rect(x+27,y+42,16,27,'#3c849e','rx="7"');
        }
      }
      if(region==='bali'){
        shapes+=path('M0 430 Q110 355 225 411 L255 675 H0Z',deep,'opacity=".85"');
        const px=160;
        shapes+='<path d="M'+px+' 560 Q'+(px+5)+' 350 '+(px+90)+' 222" stroke="#34584a" stroke-width="24" fill="none"/>';
        for(let i=0;i<6;i++){
          const rot=-95+i*37;
          shapes+='<ellipse cx="'+(px+90)+'" cy="215" rx="115" ry="15" fill="#37745b" opacity=".82" transform="rotate('+rot+' '+(px+90)+' 215)"/>';
        }
      }
    }
    const stars=isNight?Array.from({length:24},(_,i)=>{
      const x=(i*223+67)%1160,y=(i*89+47)%265;
      return '<circle cx="'+x+'" cy="'+y+'" r="'+(i%3+1)+'" fill="#f8f3de" opacity=".74"/>';
    }).join(''):'';
    const lamp=isForest||isRain?
      rect(690,475,12,160,'#4b5146')+'<ellipse cx="696" cy="465" rx="54" ry="16" fill="'+detail+'" opacity=".68"/>':
      path('M620 640 L650 515 L680 640Z','#213b40','opacity=".45"');
    const sun='<circle cx="'+sunX+'" cy="'+sunY+'" r="'+(isNight?34:64)+'" fill="'+(isNight?'#e5e5d4':detail)+'" opacity="'+(isNight?'.78':'.82')+'"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img">'+skyGradient+rect(0,0,1200,675,'url(#sky)')+sun+stars+shapes+lamp+'</svg>';
  }
  function background(id){
    const svg=scenerySvg(id);
    return svg?'url("data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)+'")':null;
  }
  root.OD_SCENERY=Object.freeze({background,sceneIds:Object.freeze(Object.keys(palettes))});
})(window);
