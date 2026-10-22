// ==============================================================
// AUTHENTICATION & MULTI-ACCOUNT & PASSWORD MODULE
// ==============================================================

const Auth = (() => {
  const ACCOUNTS_KEY = 'wisdom_saved_accounts';

  let token = localStorage.getItem('wisdom_chat_token') || null;
  let currentUser = JSON.parse(localStorage.getItem('wisdom_chat_user') || 'null');
  let pendingEmail = '';
  let otpTimerInterval = null;
  let usernameCheckTimeout = null;

  function getDeviceId() {
    let devId = localStorage.getItem('wisdom_device_id');
    if (!devId) {
      devId = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem('wisdom_device_id', devId);
    }
    return devId;
  }

  function init() {
    // 1. If active token or currentUser is missing, auto-restore from saved accounts
    if (!token || !currentUser) {
      const saved = getSavedAccounts();
      if (saved.length > 0 && saved[0].token) {
        token = saved[0].token;
        currentUser = saved[0];
        localStorage.setItem('wisdom_chat_token', token);
        localStorage.setItem('wisdom_chat_user', JSON.stringify(currentUser));
      }
    }

    setupListeners();
    updateProfileBarUI();
    renderAuthQuickAccounts();

    // Pre-fill email input with last used email if available
    const lastEmail = localStorage.getItem('wisdom_last_email');
    const emailInput = document.getElementById('auth-email-input');
    if (emailInput && !emailInput.value && lastEmail) {
      emailInput.value = lastEmail;
    }

    // If current user is logged in, ensure they are in saved accounts
    if (currentUser && token) {
      saveAccountToStorage(currentUser, token);
    }

    // Restore pending OTP step if user switched to Gmail app and back
    const savedStep = sessionStorage.getItem('wisdom_pending_step');
    const savedEmail = sessionStorage.getItem('wisdom_pending_email');
    const expires = parseInt(sessionStorage.getItem('wisdom_otp_expires') || '0', 10);

    if (savedStep === 'otp' && savedEmail && expires > Date.now()) {
      pendingEmail = savedEmail;
      const emailInput = document.getElementById('auth-email-input');
      if (emailInput) emailInput.value = savedEmail;
      showStep('otp');
      const remainingSeconds = Math.max(1, Math.floor((expires - Date.now()) / 1000));
      startOtpTimer(remainingSeconds);

      if (sessionStorage.getItem('wisdom_last_view') === 'auth') {
        if (typeof App !== 'undefined' && App.switchToView) {
          App.switchToView('auth');
        }
      }
    } else if (savedStep === 'profile' && savedEmail) {
      pendingEmail = savedEmail;
      showStep('profile');
      if (sessionStorage.getItem('wisdom_last_view') === 'auth') {
        if (typeof App !== 'undefined' && App.switchToView) {
          App.switchToView('auth');
        }
      }
    }
  }

  function setupListeners() {
    // 1. Auth Mode Switcher (Gmail OTP vs Password)
    const tabOtp = document.getElementById('tab-auth-mode-otp');
    const tabPwd = document.getElementById('tab-auth-mode-pwd');
    const pwdLoginCard = document.getElementById('auth-step-password-login');

    if (tabOtp && tabPwd) {
      tabOtp.addEventListener('click', () => {
        tabOtp.classList.add('active');
        tabPwd.classList.remove('active');
        if (pwdLoginCard) pwdLoginCard.style.display = 'none';
        showStep('email');
      });

      tabPwd.addEventListener('click', () => {
        tabPwd.classList.add('active');
        tabOtp.classList.remove('active');
        document.getElementById('auth-step-email').style.display = 'none';
        document.getElementById('auth-step-otp').style.display = 'none';
        document.getElementById('auth-step-profile').style.display = 'none';
        if (pwdLoginCard) pwdLoginCard.style.display = 'flex';
      });
    }

    // 2. Login with Password button
    const loginPwdBtn = document.getElementById('btn-login-with-password');
    if (loginPwdBtn) {
      loginPwdBtn.addEventListener('click', handleLoginWithPassword);
    }

    // Toggle login password visibility
    const toggleLoginPwdBtn = document.getElementById('btn-toggle-login-pwd');
    const loginPwdInput = document.getElementById('login-password-input');
    if (toggleLoginPwdBtn && loginPwdInput) {
      toggleLoginPwdBtn.addEventListener('click', () => {
        const isPwd = loginPwdInput.type === 'password';
        loginPwdInput.type = isPwd ? 'text' : 'password';
        toggleLoginPwdBtn.textContent = isPwd ? '🔒' : '👁️';
      });
    }

    // 3. Send OTP button
    const sendOtpBtn = document.getElementById('auth-send-otp-btn');
    if (sendOtpBtn) {
      sendOtpBtn.addEventListener('click', handleSendOtp);
    }

    // 4. Back to email button
    const backBtn = document.getElementById('auth-back-to-email-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        clearInterval(otpTimerInterval);
        showStep('email');
      });
    }

    // 5. Resend OTP button
    const resendBtn = document.getElementById('otp-resend-btn');
    if (resendBtn) {
      resendBtn.addEventListener('click', handleSendOtp);
    }

    // 6. OTP digit inputs handling
    const digits = document.querySelectorAll('.otp-digit');
    digits.forEach((input, idx) => {
      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        e.target.value = val;
        if (val && idx < digits.length - 1) {
          digits[idx + 1].focus();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && idx > 0) {
          digits[idx - 1].focus();
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '').slice(0, 6);
        if (pasted.length) {
          pasted.split('').forEach((char, i) => {
            if (digits[i]) digits[i].value = char;
          });
          const nextIdx = Math.min(pasted.length, digits.length - 1);
          digits[nextIdx].focus();
        }
      });
    });

    // 7. Verify OTP button
    const verifyOtpBtn = document.getElementById('auth-verify-otp-btn');
    if (verifyOtpBtn) {
      verifyOtpBtn.addEventListener('click', handleVerifyOtp);
    }

    // 8. Username availability live check
    const usernameInput = document.getElementById('reg-username-input');
    if (usernameInput) {
      usernameInput.addEventListener('input', (e) => {
        const val = e.target.value.trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
        e.target.value = val;
        clearTimeout(usernameCheckTimeout);
        if (val.length < 3) {
          showUsernameStatus('Kamida 3 ta belgi kiriting', 'muted');
          return;
        }
        usernameCheckTimeout = setTimeout(() => checkUsernameAvailability(val), 350);
      });
    }

    // 9. Complete registration button
    const completeRegBtn = document.getElementById('auth-complete-reg-btn');
    if (completeRegBtn) {
      completeRegBtn.addEventListener('click', handleCompleteRegistration);
    }

    // 10. Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }

    // 11. Profile Modal triggers (Clicking Profile Card Button opens Profile Settings)
    const profileBtn = document.getElementById('my-profile-btn') || document.getElementById('my-profile-bar');
    const openProfBtn = document.getElementById('open-profile-btn');
    const closeProfBtn = document.getElementById('close-profile-modal-btn');
    const profileModal = document.getElementById('profile-accounts-modal');

    if (profileBtn) {
      profileBtn.addEventListener('click', (e) => {
        if (e.target.closest('#logout-btn')) return;
        openProfileModal();
      });
    }

    if (openProfBtn) {
      openProfBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openProfileModal();
      });
    }

    if (closeProfBtn && profileModal) {
      closeProfBtn.addEventListener('click', () => {
        profileModal.classList.remove('open');
      });
    }

    if (profileModal) {
      profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) {
          profileModal.classList.remove('open');
        }
      });
    }

    // Copy username button
    const copyUsernameBtn = document.getElementById('btn-copy-username');
    if (copyUsernameBtn) {
      copyUsernameBtn.addEventListener('click', () => {
        const un = currentUser ? currentUser.username : '';
        if (un && navigator.clipboard) {
          navigator.clipboard.writeText(`@${un}`);
          App.showToast(`@${un} nusxalandi!`);
        }
      });
    }

    // Toggle profile password input visibility
    const toggleProfPwdBtn = document.getElementById('btn-toggle-prof-password');
    const profPwdInput = document.getElementById('prof-password-input');
    if (toggleProfPwdBtn && profPwdInput) {
      toggleProfPwdBtn.addEventListener('click', () => {
        const isPwd = profPwdInput.type === 'password';
        profPwdInput.type = isPwd ? 'text' : 'password';
        toggleProfPwdBtn.textContent = isPwd ? '🔒' : '👁️';
      });
    }

    // Save profile and password button
    const saveProfBtn = document.getElementById('btn-save-profile');
    if (saveProfBtn) {
      saveProfBtn.addEventListener('click', handleSaveProfile);
    }

    // Add / Connect another account button
    const addAccBtn = document.getElementById('btn-add-account');
    if (addAccBtn) {
      addAccBtn.addEventListener('click', () => {
        if (profileModal) profileModal.classList.remove('open');
        showStep('email');
        App.switchToView('auth');
      });
    }

    // Avatar upload triggers
    const triggerAvatarBtn = document.getElementById('btn-trigger-avatar-upload');
    const avatarWrap = document.getElementById('prof-avatar-wrap');
    const avatarHint = document.getElementById('prof-avatar-hint');
    const avatarInput = document.getElementById('profile-avatar-file-input');

    const openAvatarPicker = (e) => {
      e.stopPropagation();
      if (typeof App !== 'undefined' && App.setMediaPickingActive) {
        App.setMediaPickingActive(true);
      }
      if (avatarInput) avatarInput.click();
    };

    if (triggerAvatarBtn) triggerAvatarBtn.addEventListener('click', openAvatarPicker);
    if (avatarWrap) avatarWrap.addEventListener('click', openAvatarPicker);
    if (avatarHint) avatarHint.addEventListener('click', openAvatarPicker);

    if (avatarInput) {
      avatarInput.addEventListener('change', handleAvatarFileSelected);
    }
  }

  // Handle avatar file selection & upload
  async function handleAvatarFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      App.showToast('Iltimos, faqat rasm faylini tanlang');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      App.showToast('Rasm hajmi juda katta (maksimal 20MB)');
      return;
    }

    const statusEl = document.getElementById('prof-avatar-upload-status');
    if (statusEl) {
      statusEl.textContent = 'Rasm yuklanmoqda...';
      statusEl.style.color = 'var(--primary)';
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await fetch('/api/auth/upload-avatar', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();

      if (res.ok && data.success) {
        currentUser = data.user;
        localStorage.setItem('wisdom_chat_user', JSON.stringify(data.user));
        saveAccountToStorage(data.user, token);
        updateProfileBarUI();

        // Update preview in profile modal
        const preview = document.getElementById('prof-avatar-preview');
        if (preview && data.avatarUrl) {
          preview.innerHTML = `<img src="${data.avatarUrl}" class="avatar-img-circle" alt="Avatar">`;
        }

        if (statusEl) {
          statusEl.textContent = 'Rasm saqlandi ✓';
          statusEl.style.color = 'var(--success)';
        }
        App.showToast('Profil rasmi muvaffaqiyatli saqlandi!');
      } else {
        if (statusEl) statusEl.textContent = '';
        App.showToast(data.message || 'Rasm yuklashda xatolik');
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = '';
      App.showToast('Rasm yuklashda server xatoligi');
    } finally {
      if (typeof App !== 'undefined' && App.setMediaPickingActive) {
        App.setMediaPickingActive(false);
      }
      e.target.value = '';
    }
  }

  // Switch between Step 1, 2, 3
  function showStep(stepName) {
    const stepEmail = document.getElementById('auth-step-email');
    const stepOtp = document.getElementById('auth-step-otp');
    const stepProfile = document.getElementById('auth-step-profile');
    const pwdLogin = document.getElementById('auth-step-password-login');

    if (stepEmail) stepEmail.style.display = 'none';
    if (stepOtp) stepOtp.style.display = 'none';
    if (stepProfile) stepProfile.style.display = 'none';
    if (pwdLogin) pwdLogin.style.display = 'none';

    if (stepName === 'email' && stepEmail) {
      stepEmail.style.display = 'flex';
      sessionStorage.setItem('wisdom_pending_step', 'email');
      renderAuthQuickAccounts();
    }
    if (stepName === 'otp' && stepOtp) {
      stepOtp.style.display = 'flex';
      sessionStorage.setItem('wisdom_pending_step', 'otp');
    }
    if (stepName === 'profile' && stepProfile) {
      stepProfile.style.display = 'flex';
      sessionStorage.setItem('wisdom_pending_step', 'profile');
    }
    if (stepName === 'password' && pwdLogin) {
      pwdLogin.style.display = 'flex';
    }
  }

  // Update profile bar on chat dashboard
  function updateProfileBarUI() {
    const nameEl = document.getElementById('my-profile-name');
    const nikEl = document.getElementById('my-profile-nik');
    const avatarEl = document.getElementById('my-profile-avatar');

    if (currentUser) {
      if (nameEl) nameEl.textContent = currentUser.displayName || 'Foydalanuvchi';
      if (nikEl) nikEl.textContent = `@${currentUser.username || 'nik'}`;
      if (avatarEl) {
        const initial = (currentUser.displayName || currentUser.username || 'U').charAt(0).toUpperCase();
        const color = currentUser.avatarColor || '#2563eb';
        avatarEl.style.backgroundColor = color;
        avatarEl.style.color = '#ffffff';

        if (currentUser.avatarUrl && typeof currentUser.avatarUrl === 'string' && currentUser.avatarUrl.trim() !== '') {
          avatarEl.innerHTML = `
            <span class="avatar-fallback-letter" style="position:relative; z-index:1; font-weight:700;">${initial}</span>
            <img src="${currentUser.avatarUrl}" class="avatar-img-circle" alt="" 
                 style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:2; border-radius:50%;"
                 onerror="this.remove();"
                 onload="const fb=this.previousElementSibling; if(fb) fb.remove();">
          `;
        } else {
          avatarEl.innerHTML = `<span style="font-weight:700;">${initial}</span>`;
        }
      }
    } else {
      if (nameEl) nameEl.textContent = 'Mehmon';
      if (nikEl) nikEl.textContent = '@ulanish';
      if (avatarEl) {
        avatarEl.innerHTML = `<span style="font-weight:700;">?</span>`;
        avatarEl.style.backgroundColor = '#94a3b8';
        avatarEl.style.color = '#ffffff';
      }
    }
  }

  // Handle Login with Password
  async function handleLoginWithPassword() {
    const usernameInput = document.getElementById('login-username-input');
    const passwordInput = document.getElementById('login-password-input');

    const username = (usernameInput ? usernameInput.value : '').trim();
    const password = (passwordInput ? passwordInput.value : '').trim();

    if (!username || !password) {
      App.showToast('Nik va parolni kiriting');
      return;
    }

    const btn = document.getElementById('btn-login-with-password');
    btn.disabled = true;
    btn.textContent = 'Kirilmoqda...';

    try {
      const res = await fetch('/api/auth/login-with-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-device-id': getDeviceId()
        },
        body: JSON.stringify({ username, password, deviceId: getDeviceId() })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        App.showToast(data.message || 'Noto\'g\'ri nik yoki parol');
        btn.disabled = false;
        btn.innerHTML = '<span>Kirish</span><span>➔</span>';
        return;
      }

      saveSession(data.token, data.user);
      saveAccountToStorage(data.user, data.token);
      updateProfileBarUI();

      App.showToast(`Xush kelibsiz, ${data.user.displayName}!`);

      if (typeof Chat !== 'undefined') {
        Chat.connectSocket();
        Chat.loadConversations();
      }

      App.switchToView('chat-dashboard');

    } catch (err) {
      App.showToast('Server bilan aloqa uzildi');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>Kirish</span><span>➔</span>';
    }
  }

  // Handle Send OTP
  async function handleSendOtp() {
    const emailInput = document.getElementById('auth-email-input');
    const email = (emailInput ? emailInput.value : '').trim().toLowerCase();

    if (!email || !email.includes('@') || !email.includes('.')) {
      App.showToast('Iltimos, to\'g\'ri Gmail manzilini kiriting');
      return;
    }

    const btn = document.getElementById('auth-send-otp-btn');
    btn.disabled = true;
    btn.textContent = 'Yuborilmoqda...';

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (!res.ok) {
        App.showToast(data.message || 'Xatolik yuz berdi');
        btn.disabled = false;
        btn.innerHTML = '<span>Kodni yuborish</span><span>➔</span>';
        return;
      }

      pendingEmail = email;
      sessionStorage.setItem('wisdom_pending_email', email);
      sessionStorage.setItem('wisdom_otp_expires', (Date.now() + 600 * 1000).toString());
      App.showToast(data.message || 'Kod Gmailingizga yuborildi!');

      // Check for devCode
      const devAlert = document.getElementById('dev-code-alert');
      if (data.devCode) {
        devAlert.style.display = 'block';
        devAlert.innerHTML = `<strong>Sinov rejimi:</strong> Tasdiqlash kodi: <span style="font-size:18px; font-weight:800; letter-spacing:3px;">${data.devCode}</span>`;
        const digits = document.querySelectorAll('.otp-digit');
        data.devCode.split('').forEach((d, i) => {
          if (digits[i]) digits[i].value = d;
        });
      } else {
        if (devAlert) devAlert.style.display = 'none';
      }

      showStep('otp');
      startOtpTimer(600);

      const firstDigit = document.querySelector('.otp-digit');
      if (firstDigit) firstDigit.focus();

    } catch (err) {
      App.showToast('Server bilan aloqa uzildi');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>Kodni yuborish</span><span>➔</span>';
    }
  }

  // OTP Countdown timer
  function startOtpTimer(seconds) {
    clearInterval(otpTimerInterval);
    const timerText = document.getElementById('otp-timer-text');
    let remaining = seconds;

    otpTimerInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(otpTimerInterval);
        if (timerText) timerText.textContent = 'Muddati tugadi';
        return;
      }
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      if (timerText) timerText.textContent = `Qolgan vaqt: ${m}:${s < 10 ? '0' : ''}${s}`;
    }, 1000);
  }

  // Handle Verify OTP
  async function handleVerifyOtp() {
    const digits = document.querySelectorAll('.otp-digit');
    let code = '';
    digits.forEach(d => { code += d.value.trim(); });

    if (code.length !== 6) {
      App.showToast('Iltimos, 6 xonali kodni to\'liq kiriting');
      return;
    }

    const btn = document.getElementById('auth-verify-otp-btn');
    btn.disabled = true;
    btn.textContent = 'Tasdiqlanmoqda...';

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-device-id': getDeviceId()
        },
        body: JSON.stringify({ email: pendingEmail, code, deviceId: getDeviceId() })
      });
      const data = await res.json();

      if (!res.ok) {
        App.showToast(data.message || 'Noto\'g\'ri kod kiritildi');
        btn.disabled = false;
        btn.innerHTML = '<span>Kodni tasdiqlash</span><span>✓</span>';
        return;
      }

      clearInterval(otpTimerInterval);

      if (data.isNewUser) {
        showStep('profile');
        App.showToast('Kod tasdiqlandi! Endi ism va nik tanlang.');
      } else {
        saveSession(data.token, data.user);
        saveAccountToStorage(data.user, data.token);
        updateProfileBarUI();

        App.showToast('Xush kelibsiz, ' + data.user.displayName + '!');

        if (typeof Chat !== 'undefined') {
          Chat.connectSocket();
          Chat.loadConversations();
        }

        App.switchToView('chat-dashboard');
      }

    } catch (err) {
      App.showToast('Xatolik yuz berdi');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>Kodni tasdiqlash</span><span>✓</span>';
    }
  }

  // Check username availability
  async function checkUsernameAvailability(username) {
    try {
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (data.available) {
        showUsernameStatus(`✓ @${username} bo'sh va foydalanish mumkin!`, 'success');
      } else {
        showUsernameStatus(`✕ ${data.message}`, 'error');
      }
    } catch (_) {}
  }

  function showUsernameStatus(msg, type) {
    const el = document.getElementById('username-check-status');
    if (!el) return;
    el.textContent = msg;
    if (type === 'success') {
      el.style.color = 'var(--success)';
      el.style.fontWeight = '600';
    } else if (type === 'error') {
      el.style.color = 'var(--danger)';
      el.style.fontWeight = '600';
    } else {
      el.style.color = 'var(--text-muted)';
      el.style.fontWeight = 'normal';
    }
  }

  // Complete profile registration
  async function handleCompleteRegistration() {
    const nameInput = document.getElementById('reg-name-input');
    const usernameInput = document.getElementById('reg-username-input');

    const displayName = (nameInput ? nameInput.value : '').trim();
    const username = (usernameInput ? usernameInput.value : '').trim().toLowerCase();

    if (displayName.length < 2) {
      App.showToast('Iltimos, ismingizni kiriting (kamida 2 belgi)');
      return;
    }

    if (username.length < 3) {
      App.showToast('Nikingiz kamida 3 belgidan iborat bo\'lishi kerak');
      return;
    }

    const btn = document.getElementById('auth-complete-reg-btn');
    btn.disabled = true;
    btn.textContent = 'Yaratilmoqda...';

    try {
      const res = await fetch('/api/auth/register-profile', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-device-id': getDeviceId()
        },
        body: JSON.stringify({
          email: pendingEmail,
          username,
          displayName,
          deviceId: getDeviceId()
        })
      });
      const data = await res.json();

      if (!res.ok) {
        App.showToast(data.message || 'Ro\'yxatdan o\'tishda xatolik');
        btn.disabled = false;
        btn.innerHTML = '<span>Akkauntni yaratish va Kirish</span><span>🎉</span>';
        return;
      }

      saveSession(data.token, data.user);
      saveAccountToStorage(data.user, data.token);
      updateProfileBarUI();

      App.showToast('Akkaunt muvaffaqiyatli yaratildi!');

      if (typeof Chat !== 'undefined') {
        Chat.connectSocket();
        Chat.loadConversations();
      }

      App.switchToView('chat-dashboard');

    } catch (err) {
      App.showToast('Server xatosi');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>Akkauntni yaratish va Kirish</span><span>🎉</span>';
    }
  }

  // Multi-Account helpers
  function getSavedAccounts() {
    try {
      return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
    } catch (_) {
      return [];
    }
  }

  function saveAccountToStorage(user, accToken) {
    if (!user || !user.id || !accToken) return;
    let accounts = getSavedAccounts();
    const existingIdx = accounts.findIndex(a => a.id === user.id);
    const accountEntry = {
      id: user.id,
      email: user.email || '',
      username: user.username,
      displayName: user.displayName,
      avatarColor: user.avatarColor || '#2563eb',
      avatarUrl: user.avatarUrl || '',
      token: accToken
    };

    if (existingIdx >= 0) {
      accounts[existingIdx] = accountEntry;
    } else {
      accounts.unshift(accountEntry);
    }

    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    renderAuthQuickAccounts();
  }

  function switchAccount(userId) {
    const accounts = getSavedAccounts();
    const target = accounts.find(a => a.id === userId);
    if (!target) return;

    token = target.token;
    currentUser = target;
    localStorage.setItem('wisdom_chat_token', target.token);
    localStorage.setItem('wisdom_chat_user', JSON.stringify(target));

    updateProfileBarUI();
    App.showToast(`Profilga o'tildi: ${target.displayName} (@${target.username})`);

    const modal = document.getElementById('profile-accounts-modal');
    if (modal) modal.classList.remove('open');

    if (typeof Chat !== 'undefined') {
      Chat.connectSocket();
      Chat.loadConversations();
    }
  }

  function renderSavedAccounts() {
    const container = document.getElementById('saved-accounts-list');
    if (!container) return;

    const accounts = getSavedAccounts();
    if (accounts.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); font-size:12px;">Hozircha faqat bitta hisob ulangan</div>';
      return;
    }

    container.innerHTML = accounts.map(acc => {
      const isActive = currentUser && currentUser.id === acc.id;
      const avatarLetter = (acc.displayName || 'U').charAt(0).toUpperCase();
      const avatarContent = acc.avatarUrl
        ? `<img src="${acc.avatarUrl}" class="avatar-img-circle" alt="Avatar">`
        : avatarLetter;

      return `
        <div class="saved-account-row ${isActive ? 'active' : ''}" onclick="Auth.switchAccount(${acc.id})">
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="user-avatar" style="width:34px; height:34px; font-size:13px; position:relative; background-color:${acc.avatarColor || '#2563eb'};">
              ${avatarContent}
            </div>
            <div>
              <div style="font-weight:700; font-size:13px;">${acc.displayName}</div>
              <div style="font-size:11.5px; color:var(--text-muted);">@${acc.username}</div>
            </div>
          </div>
          <div>
            ${isActive ? '<span style="font-size:11px; font-weight:700; color:var(--primary);">Faol ✓</span>' : '<span style="font-size:12px; color:var(--text-muted);">O\'tish ➔</span>'}
          </div>
        </div>
      `;
    }).join('');
  }

  // Quick 1-Click Login for Saved Accounts on the Auth View
  function renderAuthQuickAccounts() {
    const box = document.getElementById('auth-saved-accounts-box');
    const list = document.getElementById('auth-saved-accounts-list');
    if (!box || !list) return;

    const accounts = getSavedAccounts();
    if (accounts.length === 0) {
      box.style.display = 'none';
      return;
    }

    box.style.display = 'block';
    list.innerHTML = accounts.map(acc => {
      const initial = (acc.displayName || acc.username || 'U').charAt(0).toUpperCase();
      const avatarHtml = acc.avatarUrl
        ? `<img src="${acc.avatarUrl}" class="avatar-img-circle" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">`
        : initial;

      return `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border);">
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="user-avatar" style="width:36px; height:36px; font-size:14px; position:relative; background-color:${acc.avatarColor || '#2563eb'}; color:#fff; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:700;">
              ${avatarHtml}
            </div>
            <div>
              <div style="font-weight:700; font-size:13.5px; color:var(--text);">${acc.displayName}</div>
              <div style="font-size:12px; color:var(--text-muted);">@${acc.username}</div>
            </div>
          </div>
          <button type="button" class="btn-primary" style="padding:6px 14px; font-size:12.5px; border-radius:8px; width:auto; margin:0;" onclick="Auth.quickLoginAccount(${acc.id})">
            <span>Kirish</span>
            <span>➔</span>
          </button>
        </div>
      `;
    }).join('');
  }

  function quickLoginAccount(userId) {
    const accounts = getSavedAccounts();
    const target = accounts.find(a => a.id === userId);
    if (!target) return;

    token = target.token;
    currentUser = target;
    localStorage.setItem('wisdom_chat_token', target.token);
    localStorage.setItem('wisdom_chat_user', JSON.stringify(target));

    updateProfileBarUI();
    App.showToast(`Xush kelibsiz, ${target.displayName}!`);

    if (typeof Chat !== 'undefined') {
      Chat.connectSocket();
      Chat.loadConversations();
    }

    if (typeof App !== 'undefined' && App.switchToView) {
      App.switchToView('chat-dashboard');
    }
  }

  // Open Profile & Accounts Modal
  function openProfileModal() {
    const modal = document.getElementById('profile-accounts-modal');
    if (!modal) return;

    function populateModalFields() {
      const nameInput = document.getElementById('prof-display-name-input');
      const unDisplay = document.getElementById('prof-username-display');
      const pwdInput = document.getElementById('prof-password-input');
      const pwdBadge = document.getElementById('password-status-badge');
      const avatarPreview = document.getElementById('prof-avatar-preview');
      const avatarStatus = document.getElementById('prof-avatar-upload-status');
      if (avatarStatus) avatarStatus.textContent = '';

      if (currentUser) {
        if (nameInput) nameInput.value = currentUser.displayName || '';
        if (unDisplay) unDisplay.value = `@${currentUser.username || ''}`;
        if (pwdInput) pwdInput.value = '';
        if (avatarPreview) {
          const initial = (currentUser.displayName || currentUser.username || 'U').charAt(0).toUpperCase();
          avatarPreview.style.backgroundColor = currentUser.avatarColor || 'var(--primary)';
          avatarPreview.style.color = '#ffffff';
          if (currentUser.avatarUrl && typeof currentUser.avatarUrl === 'string' && currentUser.avatarUrl.trim() !== '') {
            avatarPreview.innerHTML = `
              <span style="position:relative; z-index:1; font-weight:700;">${initial}</span>
              <img src="${currentUser.avatarUrl}" class="avatar-img-circle" alt="" 
                   style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:2; border-radius:50%;"
                   onerror="this.remove();"
                   onload="const fb=this.previousElementSibling; if(fb) fb.remove();">
            `;
          } else {
            avatarPreview.innerHTML = `<span style="font-weight:700;">${initial}</span>`;
          }
        }
        if (pwdBadge) {
          if (currentUser.hasPassword) {
            pwdBadge.textContent = "O'rnatilgan ✓ (Xavfsiz)";
            pwdBadge.style.color = 'var(--success)';
          } else {
            pwdBadge.textContent = "O'rnatilmagan";
            pwdBadge.style.color = 'var(--text-muted)';
          }
        }
      }
      renderSavedAccounts();
      loadSessions();
    }

    // Instantly show modal with current data
    populateModalFields();
    modal.classList.add('open');

    // Background sync latest profile info from backend
    if (token) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (data && data.success && data.user) {
            currentUser = data.user;
            localStorage.setItem('wisdom_chat_user', JSON.stringify(data.user));
            saveAccountToStorage(data.user, token);
            populateModalFields();
            updateProfileBarUI();
          }
        })
        .catch(() => {});
    }
  }

  // Handle Save Profile & Password
  async function handleSaveProfile() {
    const nameInput = document.getElementById('prof-display-name-input');
    const pwdInput = document.getElementById('prof-password-input');

    const displayName = (nameInput ? nameInput.value : '').trim();
    const password = (pwdInput ? pwdInput.value : '').trim();

    if (displayName.length < 2) {
      App.showToast('Ism kamida 2 belgidan iborat bo\'lishi kerak');
      return;
    }

    const btn = document.getElementById('btn-save-profile');
    btn.disabled = true;
    btn.textContent = 'Saqlanmoqda...';

    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ displayName, password })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        App.showToast(data.message || 'Xatolik yuz berdi');
        return;
      }

      if (data.token) {
        token = data.token;
        localStorage.setItem('wisdom_chat_token', data.token);
      }
      currentUser = data.user;
      localStorage.setItem('wisdom_chat_user', JSON.stringify(data.user));
      saveAccountToStorage(data.user, token);
      updateProfileBarUI();

      App.showToast('Profil va parol saqlandi!');

      const modal = document.getElementById('profile-accounts-modal');
      if (modal) modal.classList.remove('open');

    } catch (err) {
      App.showToast('Server bilan aloqa uzildi');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>Saqlash</span><span>💾</span>';
    }
  }

  function saveSession(newToken, newUser) {
    token = newToken;
    currentUser = newUser;
    localStorage.setItem('wisdom_chat_token', newToken);
    localStorage.setItem('wisdom_chat_user', JSON.stringify(newUser));
    if (newUser.email) {
      localStorage.setItem('wisdom_last_email', newUser.email);
    } else if (pendingEmail) {
      localStorage.setItem('wisdom_last_email', pendingEmail);
    }

    sessionStorage.removeItem('wisdom_pending_step');
    sessionStorage.removeItem('wisdom_pending_email');
    sessionStorage.removeItem('wisdom_otp_expires');
    sessionStorage.removeItem('wisdom_last_view');

    saveAccountToStorage(newUser, newToken);
    renderAuthQuickAccounts();
  }

  function handleLogout() {
    token = null;
    currentUser = null;
    localStorage.removeItem('wisdom_chat_token');
    localStorage.removeItem('wisdom_chat_user');
    updateProfileBarUI();
    renderAuthQuickAccounts();
    App.showToast('Hisobdan chiqildi');
    App.switchToView('dictionary');
  }

  async function checkAuthStatus() {
    if (!token) {
      const accounts = getSavedAccounts();
      if (accounts.length > 0 && accounts[0].token) {
        token = accounts[0].token;
        currentUser = accounts[0];
        localStorage.setItem('wisdom_chat_token', token);
        localStorage.setItem('wisdom_chat_user', JSON.stringify(currentUser));
        updateProfileBarUI();
      } else {
        return false;
      }
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          currentUser = data.user;
          localStorage.setItem('wisdom_chat_user', JSON.stringify(data.user));
          saveAccountToStorage(data.user, token);
          updateProfileBarUI();
          return true;
        }
      } else if (res.status === 401) {
        console.warn('Session rejected by server (401)');
        localStorage.removeItem('wisdom_chat_token');
        token = null;
        updateProfileBarUI();
        renderAuthQuickAccounts();
        return false;
      }
      return Boolean(token && currentUser);
    } catch (_) {
      return Boolean(token && currentUser);
    }
  }

  // -------------------------------------------------------------
  // ACTIVE SESSIONS & TELEGRAM-STYLE 7-DAY TERMINATION SECURITY
  // -------------------------------------------------------------
  let currentCanTerminateOthers = false;

  async function loadSessions() {
    const currentContainer = document.getElementById('current-device-container');
    const otherContainer = document.getElementById('other-devices-list');
    const noticeEl = document.getElementById('sessions-tenure-status');
    const bannerEl = document.getElementById('sessions-security-banner');
    const terminateAllBtn = document.getElementById('btn-terminate-all-sessions');

    if (!token) return;

    try {
      const res = await fetch('/api/auth/sessions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (currentContainer) currentContainer.innerHTML = '<div style="color:red; font-size:12px;">Sessiyalarni yuklab bo\'lmadi</div>';
        return;
      }

      currentCanTerminateOthers = Boolean(data.canTerminateOthers);

      // Update 7-day security tenure banner
      if (noticeEl && bannerEl) {
        if (data.canTerminateOthers) {
          bannerEl.style.background = 'rgba(16, 185, 129, 0.08)';
          bannerEl.style.borderColor = 'rgba(16, 185, 129, 0.3)';
          noticeEl.innerHTML = `
            <strong style="color: #10b981;">✓ Ushbu qurilma ishonchli</strong> (7 kundan oshiq vaqt davomida faol).
            Siz boshqa qurilmalarni istalgan vaqtda chiqarib yuborishingiz mumkin.
          `;
        } else {
          bannerEl.style.background = 'rgba(234, 88, 12, 0.08)';
          bannerEl.style.borderColor = 'rgba(234, 88, 12, 0.3)';
          noticeEl.innerHTML = `
            <strong style="color: #ea580c;">⏳ Yangi ulangan qurilma cheklovi:</strong>
            Akkauntingizni xavfsizligini ta'minlash uchun, boshqa qurilmalarni chiqarish huquqi <strong>yana ${data.remainingTimeToTerminate}dan so'ng</strong> ochiladi.
          `;
        }
      }

      if (terminateAllBtn) {
        if (!data.canTerminateOthers) {
          terminateAllBtn.title = `Yangi qurilma 7 kundan so'ng boshqa sessiyalarni chiqara oladi (qolgan: ${data.remainingTimeToTerminate})`;
        } else {
          terminateAllBtn.title = 'Barcha boshqa qurilmalarni bir zumda chiqarish';
        }
      }

      const sessions = data.sessions || [];
      const currentSession = sessions.find(s => s.isCurrent);
      const otherSessions = sessions.filter(s => !s.isCurrent);

      // Update sessions count text on the main profile button
      const countText = document.getElementById('profile-sessions-count-text');
      if (countText) {
        const otherCount = otherSessions.length;
        countText.textContent = otherCount > 0 
          ? `${otherCount + 1} ta faol qurilma (Ushbu + ${otherCount} ta boshqa)` 
          : 'Faqat ushbu qurilmada faol';
      }

      // Render Current Device
      if (currentContainer) {
        if (currentSession) {
          const icon = getDeviceIcon(currentSession.deviceType, currentSession.deviceName);
          const activeTime = formatRelativeTime(currentSession.lastActiveAt);
          const loginTime = formatDate(currentSession.createdAt);
          const hist = currentSession.loginHistory || [];

          currentContainer.innerHTML = `
            <div class="session-device-card current" id="session-card-${currentSession.id}">
              <div class="session-device-icon">${icon}</div>
              <div class="session-device-meta">
                <div class="session-device-title">
                  <span>${escapeHtml(currentSession.deviceName)}</span>
                  <span class="session-badge-current">Ushbu qurilma</span>
                </div>
                <div class="session-device-sub">
                  ${currentSession.ipAddress ? `IP: ${escapeHtml(currentSession.ipAddress)} · ` : ''}Faol: ${activeTime} · Ulangan: ${loginTime} · Kirishlar: <strong>${currentSession.loginCount || 1} marta</strong>
                </div>
                <button type="button" class="btn-toggle-history" onclick="Auth.toggleSessionHistory('hist-${currentSession.id}')" style="background: none; border: none; color: var(--primary); font-size: 11.5px; font-weight: 600; padding: 4px 0 0 0; cursor: pointer; text-align: left; display: inline-flex; align-items: center; gap: 4px;">
                  <span>📜 Kirish tarixlari (${hist.length || 1})</span>
                  <span id="hist-arrow-hist-${currentSession.id}">▾</span>
                </button>
                <div id="hist-${currentSession.id}" class="session-history-drawer" style="display: none; margin-top: 8px; padding: 8px 10px; background: rgba(0,0,0,0.04); border-radius: 8px; font-size: 11px; max-height: 140px; overflow-y: auto;">
                  <div style="font-weight: 700; margin-bottom: 4px; color: var(--text-main);">Oxirgi kirishlar vaqti:</div>
                  ${hist.map((h, idx) => `
                    <div style="display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dashed rgba(0,0,0,0.06); color: var(--text-muted);">
                      <span>${idx + 1}. ${formatDateTime(h.time)}</span>
                      <span>IP: ${escapeHtml(h.ip || currentSession.ipAddress || '-')}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          `;
        } else {
          currentContainer.innerHTML = '<div style="color:var(--text-muted); font-size:12px;">Qurilma aniqlanmadi</div>';
        }
      }

      // Render Other Devices
      if (otherContainer) {
        if (otherSessions.length === 0) {
          otherContainer.innerHTML = '<div style="color:var(--text-muted); font-size:12.5px; padding: 6px 0;">Boshqa ulangan qurilmalar yo\'q. Faqat ushbu qurilmada faolsiz.</div>';
          if (terminateAllBtn) terminateAllBtn.style.display = 'none';
        } else {
          if (terminateAllBtn) terminateAllBtn.style.display = 'block';
          otherContainer.innerHTML = otherSessions.map(s => {
            const icon = getDeviceIcon(s.deviceType, s.deviceName);
            const activeTime = formatRelativeTime(s.lastActiveAt);
            const loginTime = formatDate(s.createdAt);
            const hist = s.loginHistory || [];

            return `
              <div class="session-device-card" id="session-card-${s.id}">
                <div class="session-device-icon">${icon}</div>
                <div class="session-device-meta">
                  <div class="session-device-title">
                    <span>${escapeHtml(s.deviceName)}</span>
                  </div>
                  <div class="session-device-sub">
                    ${s.ipAddress ? `IP: ${escapeHtml(s.ipAddress)} · ` : ''}Faol: ${activeTime} · Ulangan: ${loginTime} · Kirishlar: <strong>${s.loginCount || 1} marta</strong>
                  </div>
                  <button type="button" class="btn-toggle-history" onclick="Auth.toggleSessionHistory('hist-${s.id}')" style="background: none; border: none; color: var(--primary); font-size: 11.5px; font-weight: 600; padding: 4px 0 0 0; cursor: pointer; text-align: left; display: inline-flex; align-items: center; gap: 4px;">
                    <span>📜 Kirish tarixlari (${hist.length || 1})</span>
                    <span id="hist-arrow-hist-${s.id}">▾</span>
                  </button>
                  <div id="hist-${s.id}" class="session-history-drawer" style="display: none; margin-top: 8px; padding: 8px 10px; background: rgba(0,0,0,0.04); border-radius: 8px; font-size: 11px; max-height: 140px; overflow-y: auto;">
                    <div style="font-weight: 700; margin-bottom: 4px; color: var(--text-main);">Oxirgi kirishlar vaqti:</div>
                    ${hist.map((h, idx) => `
                      <div style="display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dashed rgba(0,0,0,0.06); color: var(--text-muted);">
                        <span>${idx + 1}. ${formatDateTime(h.time)}</span>
                        <span>IP: ${escapeHtml(h.ip || s.ipAddress || '-')}</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
                <button type="button" class="session-terminate-btn" onclick="Auth.terminateSession(${s.id})">
                  Chiqarish
                </button>
              </div>
            `;
          }).join('');
        }
      }

    } catch (err) {
      console.error('Sessions load error:', err);
    }
  }

  async function terminateSession(sessionId) {
    if (!sessionId) return;

    if (!currentCanTerminateOthers) {
      App.showToast('Xavfsizlik qoidasi: Yangi qurilma boshqa qurilmalarni chiqarishi uchun kamida 7 kun faol turishi shart!');
      return;
    }

    if (!confirm('Ushbu qurilmani akkauntdan chiqarib yubormoqchimisiz?')) {
      return;
    }

    try {
      const res = await fetch(`/api/auth/sessions/terminate/${sessionId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok && data.success) {
        App.showToast('Qurilma sessiyasi chiqarildi ✓');
        loadSessions();
      } else {
        App.showToast(data.message || 'Xatolik yuz berdi');
      }
    } catch (_) {
      App.showToast('Aloqa xatoligi');
    }
  }

  async function terminateAllOtherSessions() {
    if (!currentCanTerminateOthers) {
      App.showToast('Xavfsizlik qoidasi: Yangi qurilma boshqa qurilmalarni chiqarishi uchun kamida 7 kun faol turishi shart!');
      return;
    }

    if (!confirm('Barcha boshqa qurilmalarni akkauntdan chiqarib yubormoqchimisiz? Faqat ushbu qurilmada qolasiz.')) {
      return;
    }

    try {
      const res = await fetch('/api/auth/sessions/terminate-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok && data.success) {
        App.showToast('Barcha boshqa qurilmalar chiqarildi ✓');
        loadSessions();
      } else {
        App.showToast(data.message || 'Xatolik yuz berdi');
      }
    } catch (_) {
      App.showToast('Aloqa xatoligi');
    }
  }

  function getDeviceIcon(deviceType, deviceName) {
    const name = (deviceName || '').toLowerCase();
    if (deviceType === 'mobile' || name.includes('android') || name.includes('phone')) return '📱';
    if (deviceType === 'tablet' || name.includes('ipad')) return '📟';
    if (name.includes('windows') || name.includes('mac') || name.includes('linux') || deviceType === 'desktop') return '💻';
    return '🌐';
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) return 'yaqinda';
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'hozir';
    if (diff < 3600) return `${Math.floor(diff / 60)} daqiqa oldin`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`;
    return `${Math.floor(diff / 86400)} kun oldin`;
  }

  function formatDate(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }

  function formatDateTime(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${day}.${month}.${year} ${h}:${m}`;
  }

  function toggleSessionHistory(drawerId) {
    const el = document.getElementById(drawerId);
    const arrow = document.getElementById('hist-arrow-' + drawerId);
    if (!el) return;
    const isHidden = el.style.display === 'none';
    el.style.display = isHidden ? 'block' : 'none';
    if (arrow) arrow.textContent = isHidden ? '▴' : '▾';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function openSessionsModal() {
    const modal = document.getElementById('sessions-modal');
    if (modal) {
      modal.classList.add('open');
      loadSessions();
    }
  }

  function closeSessionsModal() {
    const modal = document.getElementById('sessions-modal');
    if (modal) {
      modal.classList.remove('open');
    }
  }

  return {
    init,
    getToken: () => token,
    getUser: () => currentUser,
    checkAuthStatus,
    logout: handleLogout,
    showStep,
    switchAccount,
    getSavedAccounts,
    renderAuthQuickAccounts,
    quickLoginAccount,
    openProfileModal,
    closeProfileModal: () => {
      const modal = document.getElementById('profile-accounts-modal');
      if (modal) modal.classList.remove('open');
    },
    openSessionsModal,
    closeSessionsModal,
    handleSaveProfile,
    addNewAccount: () => {
      const modal = document.getElementById('profile-accounts-modal');
      if (modal) modal.classList.remove('open');
      showStep('email');
      if (typeof App !== 'undefined' && App.switchToView) App.switchToView('auth');
    },
    copyUsername: () => {
      const un = currentUser ? currentUser.username : '';
      if (un && navigator.clipboard) {
        navigator.clipboard.writeText(`@${un}`);
        if (typeof App !== 'undefined' && App.showToast) App.showToast(`@${un} nusxalandi!`);
      }
    },
    toggleProfilePasswordVisibility: () => {
      const profPwdInput = document.getElementById('prof-password-input');
      const toggleProfPwdBtn = document.getElementById('btn-toggle-prof-password');
      if (profPwdInput && toggleProfPwdBtn) {
        const isPwd = profPwdInput.type === 'password';
        profPwdInput.type = isPwd ? 'text' : 'password';
        toggleProfPwdBtn.textContent = isPwd ? '🔒' : '👁️';
      }
    },
    updateProfileBarUI,
    loadSessions,
    toggleSessionHistory,
    terminateSession,
    terminateAllOtherSessions
  };
})();

window.Auth = Auth;
