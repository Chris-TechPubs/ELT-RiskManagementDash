(function() {
  // Register with Looker Studio first (required by the SDK)
  function drawViz(data) {}
  try { dscc.subscribeToData(drawViz, {transform: dscc.objectTransform}); } catch(e) {}

  // Fetch the full heatmap HTML and write it directly into this viz iframe's document.
  // This avoids nested iframe sandbox restrictions imposed by Looker Studio.
  fetch('https://elt-riskmanagementdash.onrender.com/heatmap', {mode: 'cors'})
    .then(function(r) { return r.text(); })
    .then(function(html) {
      document.open('text/html', 'replace');
      document.write(html);
      document.close();
    })
    .catch(function(err) {
      document.body.style.cssText = 'font-family:sans-serif;padding:20px;color:red;';
      document.body.innerHTML = '<h3>Could not load heatmap</h3><p>' + err.message + '</p>';
    });
})();
