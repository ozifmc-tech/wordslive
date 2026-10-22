// ==============================================================
// APPLICATION CORE & STEALTH GUARD CONTROLLER
// ==============================================================

const App = (() => {
  let activeView = 'dictionary';
  let isMediaPickingActive = false;
  let mediaPickingTimer = null;
  let hiddenAtTimestamp = 0;

  function setMediaPickingActive(active, durationMs = 180000) {
    isMediaPickingActive = active;
    if (active) {
      sessionStorage.setItem('wisdom_picking_media', 'true');
      clearTimeout(mediaPickingTimer);
      mediaPickingTimer = setTimeout(() => {
        isMediaPickingActive = false;
        sessionStorage.removeItem('wisdom_picking_media');
      }, durationMs);
    } else {
      clearTimeout(mediaPickingTimer);
      sessionStorage.removeItem('wisdom_picking_media');
    }
  }

  function init() {
    console.log('🚀 Initializing Wisdom Dictionary App...');

    // 1. Initialize dictionary cover
    if (typeof Dictionary !== 'undefined' && Dictionary.init) {
      Dictionary.init();
    }

    // 2. Initialize auth module
    if (typeof Auth !== 'undefined' && Auth.init) {
      Auth.init();
    }

    // 3. Initialize chat module
    if (typeof Chat !== 'undefined' && Chat.init) {
      Chat.init();
    }

    // 4. Setup UI and listeners
    setupUI();

    // 5. Setup Smart Stealth Guard
    setupStealthGuard();

    // 6. Check existing session & restore chat view if returning from calculator/gallery
    if (typeof Auth !== 'undefined' && Auth.checkAuthStatus) {
      Auth.checkAuthStatus().then(isAuthed => {
        if (isAuthed && typeof Chat !== 'undefined') {
          if (Chat.connectSocket) Chat.connectSocket();

          const activeSavedView = sessionStorage.getItem('wisdom_active_view');
          if (activeSavedView === 'chat-room' && Chat.restoreActiveConversation) {
            Chat.restoreActiveConversation();
          } else if (activeSavedView === 'chat-dashboard') {
            switchToView('chat-dashboard');
          }
        }
      });
    }

    // Release media picking after regaining window focus
    window.addEventListener('focus', () => {
      if (isMediaPickingActive || sessionStorage.getItem('wisdom_picking_media') === 'true') {
        setTimeout(() => {
          setMediaPickingActive(false);
        }, 3000);
      }
    });

    console.log('✅ Wisdom Dictionary Application fully initialized.');
  }

  function openSettings() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.add('open');
  }

  function closeSettings() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.remove('open');
  }

  function handleSettingsClick(e) {
    if (e) {
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      if (typeof e.preventDefault === 'function') e.preventDefault();
    }
    if (activeView === 'chat-dashboard' && typeof Auth !== 'undefined' && Auth.openProfileModal) {
      Auth.openProfileModal();
    } else {
      openSettings();
    }
  }

  async function openSecretChat() {
    closeSettings();

    // 1. Check if user is already authenticated in localStorage
    let user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    let token = typeof Auth !== 'undefined' ? Auth.getToken() : null;

    // 2. If no active session, auto-restore from saved accounts if available
    if ((!user || !token) && typeof Auth !== 'undefined' && Auth.getSavedAccounts) {
      const saved = Auth.getSavedAccounts();
      if (saved.length > 0 && saved[0].token) {
        Auth.switchAccount(saved[0].id);
        user = Auth.getUser();
        token = Auth.getToken();
      }
    }

    // 3. If authenticated, switch to chat-dashboard immediately without blocking or waiting for network!
    if (user && token && user.username) {
      if (typeof Chat !== 'undefined') {
        Chat.connectSocket();
        Chat.loadConversations();
      }
      switchToView('chat-dashboard');

      // Silently verify session in background without interrupting user
      if (typeof Auth !== 'undefined' && Auth.checkAuthStatus) {
        Auth.checkAuthStatus().catch(() => {});
      }
      return;
    }

    // 4. Truly not logged in -> show auth view (with quick login card if accounts exist)
    if (typeof Auth !== 'undefined') {
      Auth.showStep('email');
    }
    switchToView('auth');
  }

  function setupUI() {
    // Settings modal open
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');

    if (openSettingsBtn) {
      openSettingsBtn.onclick = (e) => {
        handleSettingsClick(e);
      };
    }

    if (closeSettingsBtn) {
      closeSettingsBtn.onclick = (e) => {
        if (e) e.stopPropagation();
        closeSettings();
      };
    }

    // Click on modal backdrop closes sheet
    if (settingsModal) {
      settingsModal.onclick = (e) => {
        if (e.target === settingsModal) {
          closeSettings();
        }
      };
    }

    // Dark mode toggle
    const darkModeToggle = document.getElementById('toggle-dark-mode');
    const darkModeCheckbox = document.getElementById('dark-mode-checkbox');
    if (darkModeCheckbox) {
      const isDark = localStorage.getItem('wisdom_dark_mode') === 'true';
      darkModeCheckbox.checked = isDark;
      if (isDark) document.body.classList.add('dark');

      const handleToggle = () => {
        const val = darkModeCheckbox.checked;
        document.body.classList.toggle('dark', val);
        localStorage.setItem('wisdom_dark_mode', val ? 'true' : 'false');
      };

      if (darkModeToggle) {
        darkModeToggle.onclick = (e) => {
          if (e.target !== darkModeCheckbox) {
            darkModeCheckbox.checked = !darkModeCheckbox.checked;
          }
          handleToggle();
        };
      }
      darkModeCheckbox.onchange = handleToggle;
    }

    // Header logo click (Single tap resets to dictionary; Triple tap opens secret chat)
    let logoTapCount = 0;
    let logoTapTimer = null;
    const headerLogo = document.getElementById('header-logo');
    if (headerLogo) {
      headerLogo.onclick = () => {
        logoTapCount++;
        clearTimeout(logoTapTimer);
        logoTapTimer = setTimeout(() => { logoTapCount = 0; }, 800);

        if (logoTapCount >= 3) {
          logoTapCount = 0;
          openSecretChat();
        } else if (activeView !== 'dictionary') {
          switchToView('dictionary');
        }
      };
    }

    // Secret Entryway inside Settings Modal ("Maxsus funksiyalar va chatlar")
    const secretEntryBtn = document.getElementById('secret-entry-btn');
    if (secretEntryBtn) {
      secretEntryBtn.onclick = (e) => {
        if (e) e.stopPropagation();
        openSecretChat();
      };
    }

    // Emergency Panic buttons
    const panicBtn = document.getElementById('panic-btn');
    if (panicBtn) {
      panicBtn.addEventListener('click', () => {
        resetToDictionary();
        showToast('Lug\'atga qaytildi');
      });
    }

    const chatPanicBtn = document.getElementById('chat-panic-btn');
    if (chatPanicBtn) {
      chatPanicBtn.addEventListener('click', () => {
        resetToDictionary();
        showToast('Lug\'atga qaytildi');
      });
    }

    // Chat room back button
    const chatBackBtn = document.getElementById('chat-back-btn');
    if (chatBackBtn) {
      chatBackBtn.addEventListener('click', () => {
        if (typeof Chat !== 'undefined') {
          Chat.loadConversations();
        }
        switchToView('chat-dashboard');
      });
    }

    // Global Boss Panic Hotkey (ESC or Ctrl+B / Alt+L)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || (e.ctrlKey && e.key.toLowerCase() === 'b') || (e.altKey && e.key.toLowerCase() === 'l')) {
        if (activeView !== 'dictionary') {
          resetToDictionary();
          showToast('Lug\'atga qaytildi (Tezkor xavfsizlik)');
        }
      }
    });

    // Anti-Snoop Context Menu Guard on Chat Views
    const chatViews = [
      document.getElementById('view-chat-dashboard'),
      document.getElementById('view-chat-room')
    ];
    chatViews.forEach(view => {
      if (view) {
        view.addEventListener('contextmenu', (e) => {
          // Allow on images and videos if user wants to save
          if (e.target && (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO')) {
            return;
          }
          e.preventDefault();
        });
      }
    });
  }

  // -------------------------------------------------------------
  // SMART STEALTH GUARD & MEDIA EXEMPTION
  // Allows taking camera photos/videos, picking from gallery, and brief app switches (e.g. calculator)
  // without unexpectedly kicking the user back to the dictionary cover.
  // Full emergency disguise is ALWAYS available instantly via 📕 Panic button.
  // -------------------------------------------------------------
  function setupStealthGuard() {
    const isProtected = () => {
      // 1. If actively taking camera picture/video, picking gallery media, or uploading avatar
      if (isMediaPickingActive || sessionStorage.getItem('wisdom_picking_media') === 'true') {
        return true;
      }
      // 2. If user is in Auth flow (entering Gmail, waiting for OTP, setting up profile)
      if (activeView === 'auth') {
        return true;
      }
      return false;
    };

    // 1. Tab / App visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtTimestamp = Date.now();
      } else if (document.visibilityState === 'visible') {
        if (isProtected()) {
          return;
        }

        // If user was away from chat for more than 15 minutes of complete inactivity, stealth lock to dictionary
        const INACTIVITY_TIMEOUT = 15 * 60 * 1000;
        if (hiddenAtTimestamp > 0 && (Date.now() - hiddenAtTimestamp > INACTIVITY_TIMEOUT)) {
          resetToDictionary();
        }
        hiddenAtTimestamp = 0;
      }
    });

    // NOTE: We deliberately DO NOT attach aggressive window.blur reset
    // because on Android devices, window.blur fires on every system camera dialog,
    // gallery picker, notification pull-down, or switching briefly to calculator.
    // Instant panic disguise is handled 100% reliably by the 📕 "Lug'at" buttons!
  }

  // Reset UI back to clean dictionary view without losing token
  function resetToDictionary() {
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) {
      settingsModal.classList.remove('open');
    }
    const profileModal = document.getElementById('profile-accounts-modal');
    if (profileModal) {
      profileModal.classList.remove('open');
    }
    const sessionsModal = document.getElementById('sessions-modal');
    if (sessionsModal) {
      sessionsModal.classList.remove('open');
    }

    // If chat room was open, clear message input
    const msgInput = document.getElementById('message-input');
    if (msgInput) msgInput.value = '';

    sessionStorage.removeItem('wisdom_last_view');
    sessionStorage.removeItem('wisdom_active_view');
    sessionStorage.removeItem('wisdom_active_conv_id');
    sessionStorage.removeItem('wisdom_active_partner');
    sessionStorage.removeItem('wisdom_picking_media');
    isMediaPickingActive = false;

    switchToView('dictionary');
  }

  // View switcher
  function switchToView(viewName) {
    activeView = viewName;

    if (viewName === 'auth') {
      sessionStorage.setItem('wisdom_last_view', 'auth');
      sessionStorage.setItem('wisdom_active_view', 'auth');
    } else if (viewName === 'chat-dashboard' || viewName === 'chat-room') {
      sessionStorage.setItem('wisdom_active_view', viewName);
      sessionStorage.removeItem('wisdom_last_view');
    } else {
      sessionStorage.removeItem('wisdom_last_view');
      sessionStorage.removeItem('wisdom_active_view');
    }

    // All views
    const views = {
      'dictionary': document.getElementById('view-dictionary'),
      'auth': document.getElementById('view-auth'),
      'chat-dashboard': document.getElementById('view-chat-dashboard'),
      'chat-room': document.getElementById('view-chat-room')
    };

    // Toggle active class
    Object.keys(views).forEach(key => {
      const el = views[key];
      if (el) {
        if (key === viewName) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      }
    });

    // App header visibility (hide in chat-room so partner header is cleanly at top)
    const appHeader = document.querySelector('.app-header');
    if (appHeader) {
      if (viewName === 'chat-room') {
        appHeader.style.display = 'none';
      } else {
        appHeader.style.display = 'flex';
      }
    }

    // Panic button visibility in main header
    const panicBtn = document.getElementById('panic-btn');
    const settingsBtn = document.getElementById('open-settings-btn');

    if (viewName === 'dictionary') {
      if (panicBtn) panicBtn.style.display = 'none';
      if (settingsBtn) settingsBtn.style.display = 'flex';
    } else if (viewName === 'chat-room') {
      // Chat room has its own internal header panic button
      if (panicBtn) panicBtn.style.display = 'none';
      if (settingsBtn) settingsBtn.style.display = 'none';
    } else {
      // In auth or chat-dashboard
      if (panicBtn) panicBtn.style.display = 'inline-flex';
      if (settingsBtn) settingsBtn.style.display = 'flex'; // Keep Settings gear icon visible!
      if (viewName === 'chat-dashboard') {
        if (typeof Auth !== 'undefined' && Auth.updateProfileBarUI) Auth.updateProfileBarUI();
        if (typeof Chat !== 'undefined' && Chat.loadConversations) Chat.loadConversations();
      }
    }

    // Scroll to top of active view
    window.scrollTo(0, 0);
  }

  // Toast notification
  function showToast(message, duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  return {
    init,
    switchToView,
    resetToDictionary,
    showToast,
    getActiveView: () => activeView,
    setMediaPickingActive,
    openSettings: handleSettingsClick,
    closeSettings,
    openSecretChat
  };
})();

window.App = App;

// Auto-run when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
