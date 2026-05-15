(function() {
  document.documentElement.style.cssText = 'height:100%;margin:0;padding:0;';
  document.body.style.cssText = 'margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#fff;';

  var f = document.createElement('iframe');
  f.src = 'https://elt-riskmanagementdash.onrender.com/heatmap';
  f.style.cssText = 'border:none;width:100%;height:100vh;display:block;';
  f.setAttribute('frameborder', '0');
  f.setAttribute('scrolling', 'no');
  document.body.appendChild(f);

  // Required Looker Studio subscription — data is unused, heatmap fetches its own
  function drawViz(data) {}
  dscc.subscribeToData(drawViz, {transform: dscc.objectTransform});
})();
