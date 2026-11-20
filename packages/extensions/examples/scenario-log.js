/* Extensión de ejemplo: registra en consola cada cambio de escenario.
   Cárgala después de viewer.js: <script src="packages/extensions/examples/scenario-log.js"></script> */
(function(){
  if (!window.GhapherOS) return;
  window.GhapherOS.on('scenario', function(e){ console.info('[ghapheros] escenario:', e.id); });
  window.GhapherOS.on('built', function(e){ console.info('[ghapheros] proyecto:', e.project && e.project.name); });
})();
