// Shared help modal — identical on every page.
(function () {
  const overlay = document.createElement('div');
  overlay.id = 'help-overlay';
  overlay.className = 'overlay hidden';
  overlay.innerHTML = `
    <div class="modal help-modal">
      <h2>Help</h2>
      <ul class="help-list">
        <li><strong>Progress is saved locally on your device</strong> (in this browser's storage).</li>
        <li><strong>Add a color:</strong> click the <strong>+</strong> circle at the end of the color bar, pick a shade in the pop-up, then click the green <strong>&#10003;</strong> to add it. To close, just click off.</li>
        <li><strong>Edit a color:</strong> press and hold a color circle for about half a second to open its editing overlay.</li>
        <li><strong>Delete</strong> removes the color and empties every cell that used it. <strong>Change</strong> picks a new shade and updates all cells of that color to the new one.</li>
        <li><strong>Projects:</strong> press and hold a project card to rename or delete it. Tap <strong>Select</strong> to pick several projects and delete them at once.</li>
        <li>Finished projects can be saved as a PNG or deleted from the sandbox's <strong>Complete</strong> button (or automatically once every cell is filled).</li>
      </ul>
      <div class="modal-actions">
        <button id="help-close" class="btn primary">Got it</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const helpBtn = document.getElementById('help-btn');
  if (helpBtn) helpBtn.addEventListener('click', () => overlay.classList.remove('hidden'));

  document.getElementById('help-close').addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
})();
