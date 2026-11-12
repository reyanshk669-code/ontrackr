/**
 * HabitWall - PWA & Android TWA Lifecycle Engine
 * Service Worker Registration, Android Install Prompt, and Offline Status
 */

let deferredPrompt = null;

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registered with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });
  });
}

// Handle Android / Chrome PWA Install Prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  const installBanner = document.getElementById('pwa-install-banner');
  const btnInstall = document.getElementById('btn-pwa-install');

  if (installBanner) {
    installBanner.style.display = 'flex';
  }

  if (btnInstall) {
    btnInstall.style.display = 'flex';
    btnInstall.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      console.log('[PWA] User choice:', choice.outcome);
      deferredPrompt = null;
      if (installBanner) installBanner.style.display = 'none';
      btnInstall.style.display = 'none';
    });
  }
});

// App Installed Event
window.addEventListener('appinstalled', () => {
  console.log('[PWA] HabitWall was successfully installed!');
  const installBanner = document.getElementById('pwa-install-banner');
  if (installBanner) installBanner.style.display = 'none';
});

// Online / Offline Status Badges
window.addEventListener('online', () => {
  const toast = document.getElementById('offline-indicator-toast');
  if (toast) toast.style.display = 'none';
});

window.addEventListener('offline', () => {
  const toast = document.getElementById('offline-indicator-toast');
  if (toast) toast.style.display = 'flex';
});

document.addEventListener('DOMContentLoaded', () => {
  // Check if running in standalone mode (installed app)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const badge = document.getElementById('pwa-installed-badge');
  if (badge && isStandalone) {
    badge.textContent = 'App Mode: Standalone';
    badge.className = 'badge bg-success';
  }
});
