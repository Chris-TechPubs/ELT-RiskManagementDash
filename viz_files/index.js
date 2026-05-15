(function () {
  // ── Looker Studio registration (required by SDK) ───────────────────────────
  function drawViz(data) {}
  try { dscc.subscribeToData(drawViz, { transform: dscc.objectTransform }); } catch (e) {}

  // ── Document setup ─────────────────────────────────────────────────────────
  document.documentElement.style.cssText = 'height:100%;margin:0;padding:0;';
  document.head.innerHTML =
    '<meta charset="UTF-8">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;600;700&display=swap" rel="stylesheet">' +
    '<style>' +
    '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }' +
    'html, body { width: 100%; height: 100%; background: #fff; font-family: \'Segoe UI\', Arial, sans-serif; overflow: hidden; }' +
    '#wrap { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 6px; }' +
    'svg { width: 100%; height: 100%; }' +
    '.risk-group { cursor: pointer; }' +
    ':root { --allegion-grey: #2D2D2E; --allegion-border: #3F3F40; --allegion-text: #E8EAED; --allegion-muted: #A8A8AA; }' +
    '#tooltip { position: fixed; display: none; z-index: 999; pointer-events: none; background: var(--allegion-grey); color: var(--allegion-text); padding: 20px 28px; border-radius: 14px; font-size: 26px; max-width: 580px; line-height: 1.6; border: 2px solid var(--allegion-border); box-shadow: 0 10px 40px rgba(0,0,0,0.6); }' +
    '.tt-row { display: flex; gap: 12px; align-items: baseline; }' +
    '.tt-id { font-weight: 700; color: #fff; font-size: 26px; white-space: nowrap; }' +
    '.tt-nm { color: #a8c0ff; font-size: 23px; }' +
    '.tt-div { margin: 10px 0 8px; border-top: 2px solid var(--allegion-border); }' +
    '.tt-stat { font-size: 22px; color: #ccd6ff; }' +
    '.tt-val { color: #ffd060; font-weight: 600; }' +
    '@keyframes dotSpin { 0% { transform: rotate(0deg); } 62% { transform: rotate(360deg); } 100% { transform: rotate(360deg); } }' +
    '.dot-spin { transform-box: fill-box; transform-origin: center; }' +
    '.dot-hover:hover .dot-spin { animation: dotSpin 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite; }' +
    '#risk-modal { display: none; position: fixed; inset: 0; z-index: 1000; align-items: center; justify-content: center; }' +
    '#risk-modal.open { display: flex; }' +
    '#risk-modal-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.55); cursor: pointer; }' +
    '#risk-modal-box { position: relative; z-index: 1; background: var(--allegion-grey); color: var(--allegion-text); border: 2px solid var(--allegion-border); border-radius: 16px; padding: 36px 44px; max-width: 700px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.7); font-family: \'Roboto\', sans-serif; }' +
    '#risk-modal-close { position: absolute; top: 16px; right: 20px; background: none; border: none; color: var(--allegion-muted); font-size: 28px; cursor: pointer; line-height: 1; }' +
    '#risk-modal-close:hover { color: #fff; }' +
    '#risk-modal-id { font-size: 15px; font-weight: 700; margin-bottom: 4px; }' +
    '#risk-modal-name { font-size: 26px; font-weight: 700; color: #fff; margin-bottom: 26px; }' +
    '.modal-field { margin-bottom: 20px; }' +
    '.modal-label { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--allegion-muted); margin-bottom: 5px; }' +
    '.modal-value { font-size: 20px; color: var(--allegion-text); line-height: 1.55; }' +
    '#risk-modal-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 22px; border-bottom: 2px solid var(--allegion-border); padding-bottom: 0; }' +
    '.modal-tab { padding: 8px 18px; border: 2px solid transparent; border-bottom: none; border-radius: 8px 8px 0 0; background: transparent; cursor: pointer; font-size: 16px; font-weight: 700; margin-bottom: -2px; transition: filter 0.15s, box-shadow 0.15s; }' +
    '.modal-tab:hover { filter: brightness(1.2); }' +
    '.modal-tab.active { color: #000 !important; box-shadow: 0 -4px 14px rgba(0,0,0,0.55), -2px -2px 6px rgba(0,0,0,0.3); border-bottom-color: transparent; }' +
    '.labels-off .label-box, .labels-off .label-text, .labels-off .conn-line { display: none; }' +
    '#zoom-ctrl { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); display: flex; gap: 5px; z-index: 200; background: rgba(255,255,255,0.92); padding: 4px 8px; border-radius: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.18); }' +
    '#zoom-ctrl button { height: 28px; border: 1px solid #ccc; border-radius: 14px; background: #fff; cursor: pointer; font-weight: 700; display: flex; align-items: center; justify-content: center; color: #333; padding: 0 10px; font-size: 13px; white-space: nowrap; }' +
    '#zoom-ctrl button.icon-btn { width: 28px; padding: 0; font-size: 17px; border-radius: 50%; }' +
    '#zoom-ctrl button:hover { background: #f0f4ff; border-color: #999; }' +
    '#zoom-ctrl button.active { background: #e8f0ff; border-color: #6699cc; color: #2255aa; }' +
    '#hm { cursor: grab; } #hm.panning { cursor: grabbing; }' +
    '</style>';

  document.body.innerHTML =
    '<div id="wrap"><svg id="hm" viewBox="0 0 1300 780" xmlns="http://www.w3.org/2000/svg">' +
    '<defs>' +
    '<linearGradient id="gDiag" gradientUnits="userSpaceOnUse" x1="130" y1="700" x2="730" y2="20">' +
    '<stop offset="0%" stop-color="#8BC34A"/><stop offset="25%" stop-color="#8BC34A"/>' +
    '<stop offset="46%" stop-color="#FFEE58"/><stop offset="61%" stop-color="#FF9800"/>' +
    '<stop offset="100%" stop-color="#E53935"/></linearGradient>' +
    '<clipPath id="chartClip"><rect x="130" y="20" width="600" height="680"/></clipPath>' +
    '</defs>' +
    '<g id="chart-inner"><g id="static-layer"></g>' +
    '<g clip-path="url(#chartClip)"><g id="risks-layer"></g></g></g>' +
    '<g id="legend-layer"></g></svg></div>' +
    '<div id="zoom-ctrl">' +
    '<button id="btn-zi" class="icon-btn" title="Zoom in">+</button>' +
    '<button id="btn-zr" class="icon-btn" title="Reset" style="font-size:12px">&#8962;</button>' +
    '<button id="btn-zo" class="icon-btn" title="Zoom out">&minus;</button>' +
    '<button id="label-toggle" title="Toggle labels">Labels</button>' +
    '</div>' +
    '<div id="risk-modal"><div id="risk-modal-overlay"></div>' +
    '<div id="risk-modal-box">' +
    '<button id="risk-modal-close">&#215;</button>' +
    '<div id="risk-modal-tabs"></div>' +
    '<div id="risk-modal-id"></div><div id="risk-modal-name"></div>' +
    '<div class="modal-field"><div class="modal-label">Definition</div><div id="modal-definition" class="modal-value"></div></div>' +
    '<div class="modal-field"><div class="modal-label">Risk Status</div><div id="modal-status" class="modal-value"></div></div>' +
    '<div class="modal-field"><div class="modal-label">Risk Owner</div><div id="modal-owner" class="modal-value"></div></div>' +
    '<div class="modal-field"><div class="modal-label">Manager(s)</div><div id="modal-managers" class="modal-value"></div></div>' +
    '</div></div>' +
    '<div id="tooltip"></div>';

  // ── Layout ─────────────────────────────────────────────────────────────────
  var P        = { x: 130, y: 20, w: 600, h: 680 };
  var FONT     = 'Roboto, Segoe UI, Arial, sans-serif';
  var AXIS_FONT = 'Antenna, Roboto, Segoe UI, Arial, sans-serif';
  var LB       = { xMin: P.x+2, yMin: P.y+2, xMax: P.x+P.w-2, yMax: P.y+P.h-2 };
  var LEG_X    = P.x + P.w + 30;
  var VR       = { xMin:0, xMax:5, yMin:0, yMax:5 };
  var RISKS    = [];

  function svgX(v) { return P.x + (v-VR.xMin)/(VR.xMax-VR.xMin)*P.w; }
  function svgY(v) { return P.y + (1-(v-VR.yMin)/(VR.yMax-VR.yMin))*P.h; }
  function dataX(sx){ return VR.xMin + (sx-P.x)/P.w*(VR.xMax-VR.xMin); }
  function dataY(sy){ return VR.yMin + (1-(sy-P.y)/P.h)*(VR.yMax-VR.yMin); }

  // ── SVG helpers ────────────────────────────────────────────────────────────
  var NS = 'http://www.w3.org/2000/svg';
  function mk(tag, a, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in a) e.setAttribute(k, a[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function mktxt(content, a, parent) {
    var e = mk('text', a, parent);
    e.textContent = content;
    return e;
  }

  // ── Category colours ───────────────────────────────────────────────────────
  var CAT_MAP = {
    'strategic':                '#FF6B35',
    'operational':              '#00BFA5',
    'technology/cybersecurity': '#C6FF00',
    'technology':               '#C6FF00',
    'human capital':            '#00E676',
    'governance/compliance':    '#FF80AB',
    'governance':               '#FF80AB',
    'environmental/external':   '#82B1FF',
    'environmental':            '#82B1FF',
    'financial':                '#FFD740',
  };
  var CAT_LABELS = [
    ['Strategic Risks',                '#FF6B35'],
    ['Operational Risks',              '#00BFA5'],
    ['Technology/Cybersecurity Risks', '#C6FF00'],
    ['Human Capital Risks',            '#00E676'],
    ['Governance / Compliance Risks',  '#FF80AB'],
    ['Environmental / External Risks', '#82B1FF'],
    ['Financial Risks',                '#FFD740'],
  ];
  function catColor(cat) {
    if (!cat) return '#555';
    var k = cat.toLowerCase().trim().replace(/\s*risks?\s*$/, '').trim();
    return CAT_MAP[k] || '#555';
  }

  var ID_TO_CAT = {};

  // ── Grouping ───────────────────────────────────────────────────────────────
  function snap(v) { return Math.round(v*2)/2; }
  function groupRisks(risks) {
    var map = new Map();
    risks.forEach(function(r) {
      var sl = snap(r.likelihood), ss = snap(r.severity);
      if (sl < VR.xMin-0.26 || sl > VR.xMax+0.26) return;
      if (ss < VR.yMin-0.26 || ss > VR.yMax+0.26) return;
      var key = sl+','+ss;
      if (!map.has(key)) map.set(key, { risks:[], likelihood:sl, severity:ss });
      map.get(key).risks.push(r);
    });
    return Array.from(map.values());
  }

  var MAX_PER_ROW = 3, CHAR_W = 6, ROW_H = 14, PAD_X = 4, PAD_Y = 3;
  function getLabelLayout(ids) {
    var rows = [];
    for (var i = 0; i < ids.length; i += MAX_PER_ROW)
      rows.push(ids.slice(i, i+MAX_PER_ROW));
    var maxChars = Math.max.apply(null, rows.map(function(r){ return r.join('  ').length; }));
    return { rows:rows, w:Math.max(32, maxChars*CHAR_W+PAD_X*2), h:rows.length*ROW_H+PAD_Y*2 };
  }

  var DOT_R = 10, VGAP = 11;

  function drawPieDot(cx, cy, categories, parent) {
    var R=DOT_R, SW=3, C=2*Math.PI*(R+SW/2);
    var unique = categories.map(function(c){ return catColor(c||''); })
                           .filter(function(v,i,a){ return a.indexOf(v)===i; });
    var N=unique.length, seg=C/N;
    mk('circle',{cx:cx,cy:cy,r:R,fill:'none',stroke:'#000','stroke-width':SW+2},parent);
    mk('circle',{cx:cx,cy:cy,r:R,fill:'#111827'},parent);
    mk('circle',{cx:cx,cy:cy,r:R,fill:'none',stroke:'rgba(255,255,255,0.25)','stroke-width':SW},parent);
    unique.forEach(function(col,i){
      mk('circle',{cx:cx,cy:cy,r:R,fill:'none',stroke:col,'stroke-width':SW,
        'stroke-dasharray':seg.toFixed(2)+' '+(C-seg).toFixed(2),
        'stroke-dashoffset':(C/4-i*seg).toFixed(2)},parent);
    });
  }

  function buildItems(groups) {
    var allDots = groups.map(function(g){ return {cx:svgX(g.likelihood),cy:svgY(g.severity)}; });
    var GAP=5, placedRects=[];

    function rectsOverlap(a,b){
      return Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>GAP &&
             Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>GAP;
    }
    function circleRectOverlap(dcx,dcy,r,rect){
      var nx=Math.max(rect.x,Math.min(rect.x+rect.w,dcx));
      var ny=Math.max(rect.y,Math.min(rect.y+rect.h,dcy));
      return (nx-dcx)*(nx-dcx)+(ny-dcy)*(ny-dcy)<(r+GAP)*(r+GAP);
    }
    function lineRectCross(cx,y1,y2,rect){
      var yLo=Math.min(y1,y2)+2,yHi=Math.max(y1,y2)-2;
      return cx>rect.x-1&&cx<rect.x+rect.w+1&&yHi>rect.y&&yLo<rect.y+rect.h;
    }
    function lineDotCross(cx,y1,y2,dcx,dcy){
      if(Math.abs(dcx-cx)>=DOT_R+GAP) return false;
      var yLo=Math.min(y1,y2)+2,yHi=Math.max(y1,y2)-2;
      return yHi>dcy-DOT_R&&yLo<dcy+DOT_R;
    }
    function isValid(rect,cx,cy){
      for(var i=0;i<placedRects.length;i++) if(rectsOverlap(rect,placedRects[i])) return false;
      for(var i=0;i<allDots.length;i++){
        var d=allDots[i];
        if(d.cx===cx&&d.cy===cy) continue;
        if(circleRectOverlap(d.cx,d.cy,DOT_R,rect)) return false;
      }
      var above=rect.y+rect.h<=cy;
      var dotEdge=above?cy-DOT_R:cy+DOT_R;
      var labelEdge=above?rect.y+rect.h:rect.y;
      var yMin=Math.min(dotEdge,labelEdge)+2,yMax=Math.max(dotEdge,labelEdge)-2;
      if(yMin<yMax){
        for(var i=0;i<placedRects.length;i++) if(lineRectCross(cx,yMin,yMax,placedRects[i])) return false;
        for(var i=0;i<allDots.length;i++){
          var d=allDots[i];
          if(d.cx===cx&&d.cy===cy) continue;
          if(lineDotCross(cx,yMin,yMax,d.cx,d.cy)) return false;
        }
      }
      return true;
    }
    function findValidY(cx,lw,lh,cy,dir){
      var lx=Math.max(LB.xMin,Math.min(LB.xMax-lw,cx-lw/2));
      var start=dir==='below'?cy+DOT_R+VGAP:cy-DOT_R-VGAP-lh;
      var limit=dir==='below'?LB.yMax-lh:LB.yMin;
      var step=dir==='below'?1:-1, y=start, iters=0;
      while((dir==='below'?y<=limit:y>=limit)&&iters++<800){
        var rect={x:lx,y:y,w:lw,h:lh};
        if(isValid(rect,cx,cy)) return y;
        var jump=lh+GAP;
        for(var i=0;i<placedRects.length;i++){
          var r=placedRects[i];
          if(Math.min(lx+lw,r.x+r.w)-Math.max(lx,r.x)<=GAP) continue;
          if(dir==='below'&&r.y>=y&&r.y<y+lh+GAP) jump=Math.min(jump,r.y+r.h+GAP-y);
          if(dir==='above'&&r.y+r.h<=y+lh&&r.y+r.h>y-GAP) jump=Math.min(jump,(y+lh)-r.y+GAP);
        }
        for(var i=0;i<allDots.length;i++){
          var d=allDots[i];
          if(d.cx===cx&&d.cy===cy) continue;
          if(Math.min(lx+lw,d.cx+DOT_R+GAP)-Math.max(lx,d.cx-DOT_R-GAP)<=0) continue;
          if(dir==='below'&&d.cy>=y-DOT_R-GAP&&d.cy<y+lh+DOT_R+GAP) jump=Math.min(jump,d.cy+DOT_R+GAP-y);
          if(dir==='above'&&d.cy+DOT_R+GAP>=y&&d.cy-DOT_R-GAP<y+lh) jump=Math.min(jump,(y+lh)-(d.cy-DOT_R-GAP));
        }
        y+=step*Math.max(1,Math.ceil(jump));
      }
      return null;
    }

    var ordered = groups.slice().sort(function(a,b){ return b.severity-a.severity; });
    var placed = ordered.map(function(g){
      var cx=svgX(g.likelihood),cy=svgY(g.severity);
      var ids=g.risks.map(function(r){ return r.id; });
      var layout=getLabelLayout(ids), lw=layout.w, lh=layout.h;
      var lx=Math.max(LB.xMin,Math.min(LB.xMax-lw,cx-lw/2));
      var yA=findValidY(cx,lw,lh,cy,'above'), yB=findValidY(cx,lw,lh,cy,'below');
      var ly;
      if(yA!==null&&yB!==null) ly=Math.abs(yA+lh/2-cy)<=Math.abs(yB+lh/2-cy)?yA:yB;
      else ly=yA!==null?yA:yB!==null?yB:Math.max(LB.yMin,cy-DOT_R-VGAP-lh);
      var rect={x:lx,y:ly,w:lw,h:lh};
      placedRects.push(rect);
      return {groups:[{risks:g.risks,cx:cx,cy:cy}],rows:layout.rows,rect:rect};
    });
    return groups.map(function(g){
      return placed.find(function(it){ return it.groups[0].cx===svgX(g.likelihood)&&it.groups[0].cy===svgY(g.severity); });
    });
  }

  function resolveCollisions(items){
    var GAP=5,MAX_ITER=500;
    for(var iter=0;iter<MAX_ITER;iter++){
      var moved=false;
      for(var i=0;i<items.length;i++){
        for(var j=i+1;j<items.length;j++){
          var a=items[i].rect,b=items[j].rect;
          var ox=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)+GAP;
          var oy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)+GAP;
          if(ox<=0||oy<=0) continue;
          moved=true;
          if(ox<=oy){ var p=ox/2; if(a.x+a.w/2<b.x+b.w/2){a.x-=p;b.x+=p;}else{a.x+=p;b.x-=p;} }
          else{ var p=oy/2; if(a.y+a.h/2<b.y+b.h/2){a.y-=p;b.y+=p;}else{a.y+=p;b.y-=p;} }
          for(var k=0;k<2;k++){
            var r=k===0?a:b;
            r.x=Math.max(LB.xMin,Math.min(LB.xMax-r.w,r.x));
            r.y=Math.max(LB.yMin,Math.min(LB.yMax-r.h,r.y));
          }
        }
      }
      if(!moved) break;
    }
  }

  function mergeClose(items){
    var MERGE_DIST=4,MAX_MERGE_IDS=6,MAX_DOT_DIST=80;
    function gap(a,b){
      var gx=Math.max(0,Math.max(a.x,b.x)-Math.min(a.x+a.w,b.x+b.w));
      var gy=Math.max(0,Math.max(a.y,b.y)-Math.min(a.y+a.h,b.y+b.h));
      return Math.sqrt(gx*gx+gy*gy);
    }
    function countIds(item){ return item.groups.reduce(function(n,g){ return n+g.risks.length; },0); }
    function buildMerged(a,b){
      var allGroups=a.groups.concat(b.groups);
      var allRisks=allGroups.reduce(function(arr,g){ return arr.concat(g.risks); },[]);
      var layout=getLabelLayout(allRisks.map(function(r){ return r.id; }));
      var avgX=(a.rect.x+a.rect.w/2+b.rect.x+b.rect.w/2)/2;
      var avgY=(a.rect.y+a.rect.h/2+b.rect.y+b.rect.h/2)/2;
      var lx=Math.max(LB.xMin,Math.min(LB.xMax-layout.w,avgX-layout.w/2));
      var ly=Math.max(LB.yMin,Math.min(LB.yMax-layout.h,avgY-layout.h/2));
      return {groups:allGroups,rows:layout.rows,rect:{x:lx,y:ly,w:layout.w,h:layout.h}};
    }
    var current=items.slice(),changed=true;
    while(changed){
      changed=false;
      var next=[],used=new Set();
      for(var i=0;i<current.length;i++){
        if(used.has(i)) continue;
        var merged=false;
        for(var j=i+1;j<current.length;j++){
          if(used.has(j)) continue;
          if(gap(current[i].rect,current[j].rect)<MERGE_DIST&&
             countIds(current[i])+countIds(current[j])<=MAX_MERGE_IDS&&
             current[i].groups.every(function(ga){ return current[j].groups.every(function(gb){
               var dx=ga.cx-gb.cx,dy=ga.cy-gb.cy;
               return Math.sqrt(dx*dx+dy*dy)<=MAX_DOT_DIST;
             }); })){
            next.push(buildMerged(current[i],current[j]));
            used.add(i);used.add(j);merged=true;changed=true;break;
          }
        }
        if(!merged) next.push(current[i]);
      }
      current=next;
    }
    return current;
  }

  function connAnchor(cx,cy,rect){
    var lx=rect.x,ly=rect.y,lw=rect.w,lh=rect.h;
    var dx=(lx+lw/2)-cx,dy=(ly+lh/2)-cy;
    if(Math.abs(dy)>=Math.abs(dx))
      return dy>0?{x:Math.max(lx,Math.min(lx+lw,cx)),y:ly}:{x:Math.max(lx,Math.min(lx+lw,cx)),y:ly+lh};
    return dx>0?{x:lx,y:Math.max(ly,Math.min(ly+lh,cy))}:{x:lx+lw,y:Math.max(ly,Math.min(ly+lh,cy))};
  }

  function updateGradientCoords(){
    var g=document.getElementById('gDiag');
    g.setAttribute('x1',svgX(0).toFixed(1)); g.setAttribute('y1',svgY(0).toFixed(1));
    g.setAttribute('x2',svgX(5).toFixed(1)); g.setAttribute('y2',svgY(5).toFixed(1));
  }

  function renderStatic(){
    updateGradientCoords();
    var layer=document.getElementById('static-layer');
    var x=P.x,y=P.y,w=P.w,h=P.h;
    mk('rect',{x:x,y:y,width:w,height:h,fill:'url(#gDiag)'},layer);
    var STEP=0.5,gcol='rgba(255,255,255,0.5)';
    function rangeTicks(lo,hi){
      var out=[],s=Math.ceil(lo/STEP)*STEP;
      for(var v=s;v<=hi+0.001;v+=STEP) out.push(parseFloat(v.toFixed(2)));
      return out;
    }
    rangeTicks(VR.xMin,VR.xMax).forEach(function(v){
      var sx=svgX(v); if(sx<x-1||sx>x+w+1) return;
      mk('line',{x1:sx,y1:y,x2:sx,y2:y+h,stroke:gcol,'stroke-width':v===Math.round(v)?1.0:0.4},layer);
      mktxt(v.toFixed(1),{x:sx,y:y+h+16,'text-anchor':'middle','font-size':10,fill:'#444','font-family':AXIS_FONT},layer);
    });
    rangeTicks(VR.yMin,VR.yMax).forEach(function(v){
      var sy=svgY(v); if(sy<y-1||sy>y+h+1) return;
      mk('line',{x1:x,y1:sy,x2:x+w,y2:sy,stroke:gcol,'stroke-width':v===Math.round(v)?1.0:0.4},layer);
      mktxt(v.toFixed(1),{x:x-8,y:sy+4,'text-anchor':'end','font-size':10,fill:'#444','font-family':AXIS_FONT},layer);
    });
    if(VR.xMin<=2.5&&VR.xMax>=2.5) mk('line',{x1:svgX(2.5),y1:y,x2:svgX(2.5),y2:y+h,stroke:'rgba(0,0,0,0.45)','stroke-width':2},layer);
    if(VR.yMin<=2.5&&VR.yMax>=2.5) mk('line',{x1:x,y1:svgY(2.5),x2:x+w,y2:svgY(2.5),stroke:'rgba(0,0,0,0.45)','stroke-width':2},layer);
    mk('rect',{x:x,y:y,width:w,height:h,fill:'none',stroke:'rgba(0,0,0,0.55)','stroke-width':1.5},layer);
    mktxt('Likelihood',{x:x+w/2,y:y+h+34,'text-anchor':'middle','font-size':13,'font-weight':600,fill:'#333','font-family':AXIS_FONT},layer);
    var sev=mktxt('Severity',{'text-anchor':'middle','font-size':13,'font-weight':600,fill:'#333','font-family':AXIS_FONT,transform:'rotate(-90,'+(x-44)+','+(y+h/2)+')'},layer);
    sev.setAttribute('x',x-44); sev.setAttribute('y',y+h/2);
  }

  function renderRisks(){
    var layer=document.getElementById('risks-layer');
    var groups=groupRisks(RISKS);
    var items=buildItems(groups);
    resolveCollisions(items);
    items=mergeClose(items);
    items.forEach(function(item){
      var lx=item.rect.x,ly=item.rect.y,lw=item.rect.w,lh=item.rect.h;
      var cats=item.groups.reduce(function(a,g){ return a.concat(g.risks.map(function(r){ return r.category||''; })); },[]);
      var freq={}; cats.forEach(function(c){ freq[c]=(freq[c]||0)+1; });
      var domCat=Object.entries(freq).sort(function(a,b){ return b[1]-a[1]; })[0]?.[0]||'';
      var borderCol=catColor(domCat);
      var g=mk('g',{class:'risk-group'},layer);
      mk('rect',{class:'label-box',x:lx,y:ly,width:lw,height:lh,rx:3,fill:'#2D2D2E',stroke:borderCol,'stroke-width':1.5},g);
      var allIds=item.groups.reduce(function(a,gr){ return a.concat(gr.risks.map(function(r){ return r.id; })); },[]);
      var layout=getLabelLayout(allIds);
      layout.rows.forEach(function(row,i){
        var textEl=mk('text',{class:'label-text',x:lx+lw/2,y:ly+PAD_Y+(i+0.82)*ROW_H,'text-anchor':'middle','font-size':9.5,'font-weight':700,'font-family':FONT},g);
        row.forEach(function(id,idx){
          var span=document.createElementNS(NS,'tspan');
          span.textContent=id; span.setAttribute('fill',catColor(ID_TO_CAT[id]||''));
          textEl.appendChild(span);
          if(idx<row.length-1){ var sep=document.createElementNS(NS,'tspan'); sep.textContent='  '; sep.setAttribute('fill','#aaa'); textEl.appendChild(sep); }
        });
      });
      item.groups.forEach(function(grp){
        var col=catColor(grp.risks[0]?.category||'');
        var anchor=connAnchor(grp.cx,grp.cy,item.rect);
        var dotG=mk('g',{class:'dot-hover'},g);
        if(Math.abs(grp.cx-svgX(2.5))<3){
          var mid={x:grp.cx+32,y:(grp.cy+anchor.y)/2};
          mk('path',{class:'conn-line',d:'M '+grp.cx+' '+grp.cy+' Q '+mid.x+' '+mid.y+' '+anchor.x+' '+anchor.y,stroke:col,'stroke-width':1.8,fill:'none',opacity:0.85},dotG);
        } else {
          mk('line',{class:'conn-line',x1:grp.cx,y1:grp.cy,x2:anchor.x,y2:anchor.y,stroke:col,'stroke-width':1.8,opacity:0.85},dotG);
        }
        var spinG=mk('g',{class:'dot-spin'},dotG);
        drawPieDot(grp.cx,grp.cy,grp.risks.map(function(r){ return r.category||''; }),spinG);
        dotG.addEventListener('mouseenter',function(e){ showTip(e,grp.risks); });
        dotG.addEventListener('mousemove',moveTip);
        dotG.addEventListener('mouseleave',hideTip);
        dotG.addEventListener('click',function(e){ e.stopPropagation(); openModal(grp.risks); });
      });
    });
  }

  function renderLegend(){
    var layer=document.getElementById('legend-layer'), lx=LEG_X;
    var sorted=RISKS.slice().sort(function(a,b){
      return parseInt(a.id.replace(/\D/g,''),10)-parseInt(b.id.replace(/\D/g,''),10);
    });
    var CARD_PADX=10,CARD_TPAD=20,CARD_BPAD=8,CARD_W=293,HDR_H=16;
    var RISK_H=(P.h-CARD_TPAD-HDR_H-CARD_BPAD)/Math.max(sorted.length,1);
    var fontSize=Math.min(11,Math.max(8.5,RISK_H*0.78));
    var cardListH=CARD_TPAD+HDR_H+(sorted.length-1)*RISK_H+fontSize+CARD_BPAD;
    mk('rect',{x:lx-CARD_PADX,y:P.y,width:CARD_W,height:cardListH,rx:10,ry:10,fill:'#2D2D2E'},layer);
    var y=P.y+CARD_TPAD;
    mktxt('Risk #',   {x:lx,   y:y,'font-size':10,'font-weight':700,fill:'#E8EAED','font-family':FONT},layer);
    mktxt('Risk Name',{x:lx+38,y:y,'font-size':10,'font-weight':700,fill:'#E8EAED','font-family':FONT},layer);
    y+=HDR_H;
    sorted.forEach(function(r){
      var col=catColor(r.category||'');
      var name=r.name.length>44?r.name.slice(0,42)+'…':r.name;
      mktxt(r.id,  {x:lx,   y:y,'font-size':fontSize,'font-weight':700,fill:col,'font-family':FONT},layer);
      mktxt(name,  {x:lx+38,y:y,'font-size':fontSize,'font-weight':600,fill:col,'font-family':FONT},layer);
      y+=RISK_H;
    });
    var CAT_ROW_H=26,CAT_R=7,LEG_PAD_X=12,LEG_PAD_Y=12,LEG_TEXT_X=CAT_R*2+8;
    var legX=lx-CARD_PADX+CARD_W+16;
    var legCardW=LEG_TEXT_X+175+LEG_PAD_X;
    var legCardH=LEG_PAD_Y+CAT_R+(CAT_LABELS.length-1)*CAT_ROW_H+CAT_R+LEG_PAD_Y;
    mk('rect',{x:legX-LEG_PAD_X,y:P.y,width:legCardW,height:legCardH,rx:10,ry:10,fill:'#2D2D2E'},layer);
    var cy=P.y+LEG_PAD_Y+CAT_R;
    CAT_LABELS.forEach(function(entry){
      mk('circle',{cx:legX+CAT_R,cy:cy,r:CAT_R,fill:entry[1]},layer);
      mktxt(entry[0],{x:legX+LEG_TEXT_X,y:cy+4,'font-size':9,'font-weight':600,fill:'#ffffff','font-family':FONT},layer);
      cy+=CAT_ROW_H;
    });
  }

  // ── Tooltip ────────────────────────────────────────────────────────────────
  var TIP=document.getElementById('tooltip');
  function showTip(e,risks){
    var l=risks[0]?.likelihood??0, s=risks[0]?.severity??0;
    TIP.innerHTML=risks.map(function(r){
      return '<div class="tt-row"><span class="tt-id" style="color:'+catColor(r.category||'')+'">'+r.id+'</span><span class="tt-nm">'+r.name+'</span></div>';
    }).join('')+'<div class="tt-div"></div><div class="tt-stat">Likelihood: <span class="tt-val">'+snap(l).toFixed(1)+'</span> &nbsp;|&nbsp; Severity: <span class="tt-val">'+snap(s).toFixed(1)+'</span></div><div class="tt-stat">Risk Score: <span class="tt-val">'+(snap(l)*snap(s)).toFixed(2)+'</span></div>';
    TIP.style.display='block'; moveTip(e);
  }
  function moveTip(e){
    var tw=TIP.offsetWidth,th=TIP.offsetHeight,tx=e.clientX+16,ty=e.clientY-10;
    if(tx+tw>window.innerWidth-8) tx=e.clientX-tw-16;
    if(ty+th>window.innerHeight-8) ty=e.clientY-th-4;
    TIP.style.left=tx+'px'; TIP.style.top=ty+'px';
  }
  function hideTip(){ TIP.style.display='none'; }

  // ── Modal ──────────────────────────────────────────────────────────────────
  function hexToRgba(hex,a){
    var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+a+')';
  }
  var _modalRisks=[];
  function openModal(risks){
    hideTip();
    _modalRisks=risks.map(function(r){ return RISKS.find(function(fr){ return fr.id===r.id; })||r; });
    var tabsEl=document.getElementById('risk-modal-tabs');
    tabsEl.innerHTML='';
    if(_modalRisks.length>1){
      _modalRisks.forEach(function(r,idx){
        var btn=document.createElement('button');
        var col=catColor(r.category||'')||'#666';
        btn.className='modal-tab'+(idx===0?' active':'');
        btn.textContent=r.id;
        btn.style.backgroundColor=hexToRgba(col,0.22);
        btn.style.color=col;
        btn.style.borderColor=hexToRgba(col,0.5);
        btn.dataset.col=col;
        btn.onclick=function(){ switchModalTab(idx); };
        tabsEl.appendChild(btn);
      });
      tabsEl.style.display='flex';
    } else { tabsEl.style.display='none'; }
    switchModalTab(0);
    document.getElementById('risk-modal').classList.add('open');
  }
  function switchModalTab(idx){
    document.querySelectorAll('.modal-tab').forEach(function(t,i){
      var col=t.dataset.col||'#666';
      if(i===idx){ t.classList.add('active'); t.style.backgroundColor=hexToRgba(col,0.85); t.style.borderColor=col; t.style.color='#000'; }
      else{ t.classList.remove('active'); t.style.backgroundColor=hexToRgba(col,0.22); t.style.borderColor=hexToRgba(col,0.5); t.style.color='#000'; }
    });
    var r=_modalRisks[idx]||{};
    var idEl=document.getElementById('risk-modal-id');
    idEl.textContent=r.id||''; idEl.style.color=catColor(r.category||'');
    document.getElementById('risk-modal-name').textContent=r.name||'';
    document.getElementById('modal-definition').textContent=r.definition||'—';
    document.getElementById('modal-status').textContent=r.status||'—';
    document.getElementById('modal-owner').textContent=r.owner||'—';
    document.getElementById('modal-managers').textContent=r.managers||'—';
  }
  function closeModal(){ document.getElementById('risk-modal').classList.remove('open'); }

  // ── Zoom / Pan ─────────────────────────────────────────────────────────────
  var labelsVisible=true;
  function toggleLabels(){
    labelsVisible=!labelsVisible;
    document.getElementById('risks-layer').classList.toggle('labels-off',!labelsVisible);
    var btn=document.getElementById('label-toggle');
    btn.textContent=labelsVisible?'Labels':'Labels Off';
    btn.classList.toggle('active',!labelsVisible);
  }
  function rerender(){
    ['static-layer','risks-layer'].forEach(function(id){
      var el=document.getElementById(id); while(el.firstChild) el.removeChild(el.firstChild);
    });
    renderStatic(); renderRisks();
  }
  function doZoom(factor,pivDX,pivDY){
    var cx=pivDX!=null?pivDX:(VR.xMin+VR.xMax)/2;
    var cy=pivDY!=null?pivDY:(VR.yMin+VR.yMax)/2;
    var nxMin=cx-(cx-VR.xMin)/factor, nxMax=cx+(VR.xMax-cx)/factor;
    var nyMin=cy-(cy-VR.yMin)/factor, nyMax=cy+(VR.yMax-cy)/factor;
    if(nxMax-nxMin>5.001||nyMax-nyMin>5.001) return;
    VR.xMin=nxMin; VR.xMax=nxMax; VR.yMin=nyMin; VR.yMax=nyMax; rerender();
  }
  function resetView(){ VR={xMin:0,xMax:5,yMin:0,yMax:5}; rerender(); }
  function screenToData(clientX,clientY){
    var r=hm.getBoundingClientRect();
    return {x:dataX((clientX-r.left)/r.width*1300),y:dataY((clientY-r.top)/r.height*780)};
  }

  // ── DOM refs and event listeners (body is set above) ──────────────────────
  var hm=document.getElementById('hm');
  var risksLayer=document.getElementById('risks-layer');

  document.getElementById('btn-zi').addEventListener('click',function(){ doZoom(1.3); });
  document.getElementById('btn-zr').addEventListener('click',resetView);
  document.getElementById('btn-zo').addEventListener('click',function(){ doZoom(0.77); });
  document.getElementById('label-toggle').addEventListener('click',toggleLabels);
  document.getElementById('risk-modal-overlay').addEventListener('click',closeModal);
  document.getElementById('risk-modal-close').addEventListener('click',closeModal);

  hm.addEventListener('wheel',function(e){
    e.preventDefault();
    var r=hm.getBoundingClientRect(),sx=(e.clientX-r.left)/r.width*1300;
    if(sx<P.x||sx>P.x+P.w) return;
    var pt=screenToData(e.clientX,e.clientY);
    doZoom(e.deltaY<0?1.25:0.8,pt.x,pt.y);
  },{passive:false});

  var panState=null,panThrottle=null;
  hm.addEventListener('mousedown',function(e){
    if(e.button!==0) return;
    var r=hm.getBoundingClientRect(),sx=(e.clientX-r.left)/r.width*1300;
    if(sx<P.x||sx>P.x+P.w) return;
    panState={clientX:e.clientX,clientY:e.clientY,vr:Object.assign({},VR),moved:false};
    hm.classList.add('panning'); e.preventDefault();
  });
  window.addEventListener('mousemove',function(e){
    if(!panState) return;
    var r=hm.getBoundingClientRect();
    var dDataX=-(e.clientX-panState.clientX)/r.width*(panState.vr.xMax-panState.vr.xMin);
    var dDataY=(e.clientY-panState.clientY)/r.height*(panState.vr.yMax-panState.vr.yMin);
    VR.xMin=panState.vr.xMin+dDataX; VR.xMax=panState.vr.xMax+dDataX;
    VR.yMin=panState.vr.yMin+dDataY; VR.yMax=panState.vr.yMax+dDataY;
    panState.moved=true;
    var dxSVG=-dDataX/(panState.vr.xMax-panState.vr.xMin)*P.w;
    var dySVG=dDataY/(panState.vr.yMax-panState.vr.yMin)*P.h;
    if(!panThrottle) panThrottle=requestAnimationFrame(function(){
      var sl=document.getElementById('static-layer'); while(sl.firstChild) sl.removeChild(sl.firstChild);
      renderStatic();
      risksLayer.setAttribute('transform','translate('+dxSVG.toFixed(2)+','+dySVG.toFixed(2)+')');
      panThrottle=null;
    });
  });
  window.addEventListener('mouseup',function(){
    if(!panState) return;
    if(panThrottle){ cancelAnimationFrame(panThrottle); panThrottle=null; }
    risksLayer.setAttribute('transform','');
    var wasDrag=panState.moved; panState=null; hm.classList.remove('panning');
    if(wasDrag) rerender();
  });
  document.addEventListener('keydown',function(e){
    if(!document.getElementById('risk-modal').classList.contains('open')) return;
    if(e.key==='Escape'){ closeModal(); return; }
    var tabs=document.querySelectorAll('.modal-tab'); if(!tabs.length) return;
    var cur=Array.from(tabs).findIndex(function(t){ return t.classList.contains('active'); });
    if(e.key==='ArrowRight') switchModalTab((cur+1)%_modalRisks.length);
    if(e.key==='ArrowLeft')  switchModalTab((cur-1+_modalRisks.length)%_modalRisks.length);
  });

  // ── Fetch data and render ──────────────────────────────────────────────────
  fetch('https://elt-riskmanagementdash.onrender.com/api/risks', { mode: 'cors' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      RISKS = data;
      RISKS.forEach(function(r) { ID_TO_CAT[r.id] = r.category || ''; });
      renderStatic();
      renderRisks();
      renderLegend();
    })
    .catch(function(err) {
      document.body.style.cssText = 'font-family:sans-serif;padding:20px;color:#c00;background:#fff;';
      document.body.innerHTML = '<h3>Could not load risk data</h3><p>' + err.message + '</p>';
    });

})();
