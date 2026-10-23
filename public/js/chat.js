// ==============================================================
// REAL-TIME CHAT & MESSAGING MODULE (SOCKET.IO & RICH MEDIA)
// ==============================================================

const Chat = (() => {
  let socket = null;
  let activeConversation = null;
  let activePartner = null;
  let typingTimeout = null;
  let isTyping = false;

  function init() {
    setupListeners();
  }

  function switchDashboardTab(target) {
    const convTab = document.getElementById('tab-conversations');
    const searchTab = document.getElementById('tab-search');
    const btnConv = document.getElementById('tab-btn-conversations');
    const btnSearch = document.getElementById('tab-btn-search');

    if (target === 'tab-conversations') {
      if (btnConv) { btnConv.classList.add('active'); btnConv.setAttribute('aria-selected', 'true'); }
      if (btnSearch) { btnSearch.classList.remove('active'); btnSearch.setAttribute('aria-selected', 'false'); }
      if (convTab) convTab.style.display = 'block';
      if (searchTab) searchTab.style.display = 'none';
      loadConversations();
    } else {
      if (btnConv) { btnConv.classList.remove('active'); btnConv.setAttribute('aria-selected', 'false'); }
      if (btnSearch) { btnSearch.classList.add('active'); btnSearch.setAttribute('aria-selected', 'true'); }
      if (convTab) convTab.style.display = 'none';
      if (searchTab) searchTab.style.display = 'block';
      const input = document.getElementById('user-search-input');
      const q = input ? input.value.trim().replace(/^@/, '') : '';
      searchUsers(q);
      if (input) setTimeout(() => input.focus(), 50);
    }
  }

  function setupListeners() {
    // Sub-nav tab switching on Chat Dashboard (Suhbatlar vs Qidiruv)
    const tabConv = document.getElementById('tab-btn-conversations');
    const tabSearch = document.getElementById('tab-btn-search');

    if (tabConv) {
      tabConv.addEventListener('click', (e) => {
        e.preventDefault();
        switchDashboardTab('tab-conversations');
      });
    }

    if (tabSearch) {
      tabSearch.addEventListener('click', (e) => {
        e.preventDefault();
        switchDashboardTab('tab-search');
      });
    }

    // User search input & dedicated Search button
    const userSearchInput = document.getElementById('user-search-input');
    const userSearchSubmitBtn = document.getElementById('user-search-submit-btn');
    let searchTimeout = null;

    if (userSearchInput) {
      userSearchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim().replace(/^@/, '');
        searchTimeout = setTimeout(() => searchUsers(query), 300);
      });

      userSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          clearTimeout(searchTimeout);
          const query = userSearchInput.value.trim().replace(/^@/, '');
          searchUsers(query);
        }
      });
    }

    if (userSearchSubmitBtn && userSearchInput) {
      userSearchSubmitBtn.addEventListener('click', () => {
        clearTimeout(searchTimeout);
        const query = userSearchInput.value.trim().replace(/^@/, '');
        searchUsers(query);
      });
    }

    // Chat back button
    const backBtn = document.getElementById('chat-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (socket && activeConversation) {
          socket.emit('leave_conversation', { conversationId: activeConversation.id });
        }
        activeConversation = null;
        activePartner = null;
        sessionStorage.removeItem('wisdom_active_conv_id');
        sessionStorage.removeItem('wisdom_active_partner');
        App.switchToView('chat-dashboard');
        loadConversations();
      });
    }

    // Message input & send button
    const sendBtn = document.getElementById('send-msg-btn');
    const msgInput = document.getElementById('message-input');

    if (sendBtn) {
      sendBtn.addEventListener('click', handleSendMessage);
    }

    if (msgInput) {
      msgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSendMessage();
        }
      });

      // Auto-growing textarea & typing notification + Send/Media button switcher
      msgInput.addEventListener('input', () => {
        updateInputButtons();
        msgInput.style.height = 'auto';
        msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + 'px';

        if (!activeConversation || !socket) return;

        if (!isTyping) {
          isTyping = true;
          socket.emit('typing', { conversationId: activeConversation.id });
        }

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
          isTyping = false;
          socket.emit('stop_typing', { conversationId: activeConversation.id });
        }, 2000);
      });
    }

    // Dynamic Telegram-style media action button listeners (Voice 🎙️ / Round Video 📹)
    setupMediaButtonListeners();

    // Dedicated Gallery Input (Photos & Videos up to 200MB)
    const galleryInput = document.getElementById('media-gallery-input');
    if (galleryInput) {
      galleryInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          uploadAndSendMedia(file, 'gallery');
        }
        galleryInput.value = '';
        if (typeof App !== 'undefined' && App.setMediaPickingActive) {
          setTimeout(() => App.setMediaPickingActive(false), 2000);
        }
      });
      galleryInput.addEventListener('cancel', () => {
        if (typeof App !== 'undefined' && App.setMediaPickingActive) {
          App.setMediaPickingActive(false);
        }
      });
    }

    // Dedicated Document / Any File Input (PDF, Word, Zip, APK, etc.)
    const docInput = document.getElementById('media-doc-input');
    if (docInput) {
      docInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          uploadAndSendMedia(file, 'file');
        }
        docInput.value = '';
        if (typeof App !== 'undefined' && App.setMediaPickingActive) {
          setTimeout(() => App.setMediaPickingActive(false), 2000);
        }
      });
      docInput.addEventListener('cancel', () => {
        if (typeof App !== 'undefined' && App.setMediaPickingActive) {
          App.setMediaPickingActive(false);
        }
      });
    }

    // Dedicated Camera Photo Input
    const cameraPhotoInput = document.getElementById('media-camera-photo-input');
    if (cameraPhotoInput) {
      cameraPhotoInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          uploadAndSendMedia(file, 'camera');
        }
        cameraPhotoInput.value = '';
        if (typeof App !== 'undefined' && App.setMediaPickingActive) {
          setTimeout(() => App.setMediaPickingActive(false), 2000);
        }
      });
      cameraPhotoInput.addEventListener('cancel', () => {
        if (typeof App !== 'undefined' && App.setMediaPickingActive) {
          App.setMediaPickingActive(false);
        }
      });
    }

    // Dedicated Camera Video Input
    const cameraVideoInput = document.getElementById('media-camera-video-input');
    if (cameraVideoInput) {
      cameraVideoInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          uploadAndSendMedia(file, 'camera');
        }
        cameraVideoInput.value = '';
        if (typeof App !== 'undefined' && App.setMediaPickingActive) {
          setTimeout(() => App.setMediaPickingActive(false), 2000);
        }
      });
      cameraVideoInput.addEventListener('cancel', () => {
        if (typeof App !== 'undefined' && App.setMediaPickingActive) {
          App.setMediaPickingActive(false);
        }
      });
    }

    // In-App Camera Viewfinder controls setup
    setupInAppCameraListeners();

    // Voice Note / Audio Recording bar buttons
    const btnCancelVoice = document.getElementById('btn-cancel-voice-record');
    const btnSendVoice = document.getElementById('btn-send-voice-record');

    if (btnCancelVoice) {
      btnCancelVoice.addEventListener('click', cancelVoiceRecording);
    }
    if (btnSendVoice) {
      btnSendVoice.addEventListener('click', finishAndSendVoiceRecording);
    }

    // 5. Global audio/video playback coordinator (prevents multiple tracks overlapping / echoing)
    document.addEventListener('play', (e) => {
      if (e.target && (e.target.tagName === 'AUDIO' || e.target.tagName === 'VIDEO')) {
        document.querySelectorAll('audio, video').forEach(m => {
          if (m !== e.target && !m.paused) {
            try { m.pause(); } catch(_) {}
          }
        });
      }
    }, true);

    // 6. Delete Message Modal buttons
    const btnDelForMe = document.getElementById('btn-delete-for-me');
    const btnDelForEveryone = document.getElementById('btn-delete-for-everyone');
    const closeDelModalBtn = document.getElementById('close-delete-modal-btn');
    const cancelDelBtn = document.getElementById('btn-cancel-delete');

    if (btnDelForMe) {
      btnDelForMe.addEventListener('click', () => confirmDeleteMessage('for_me'));
    }
    if (btnDelForEveryone) {
      btnDelForEveryone.addEventListener('click', () => confirmDeleteMessage('for_everyone'));
    }
    if (closeDelModalBtn) {
      closeDelModalBtn.addEventListener('click', closeDeleteModal);
    }
    if (cancelDelBtn) {
      cancelDelBtn.addEventListener('click', closeDeleteModal);
    }

    // Lightbox modal close
    const closeLightboxBtn = document.getElementById('close-lightbox-btn');
    const lightboxModal = document.getElementById('media-lightbox-modal');
    if (closeLightboxBtn && lightboxModal) {
      closeLightboxBtn.addEventListener('click', () => {
        lightboxModal.style.display = 'none';
      });
      lightboxModal.addEventListener('click', (e) => {
        if (e.target === lightboxModal) {
          lightboxModal.style.display = 'none';
        }
      });
    }
  }

  // -------------------------------------------------------------
  // IN-APP LIVE CAMERA CONTROLLER (WEBRTC & MEDIARECORDER)
  // -------------------------------------------------------------
  let inAppStream = null;
  let cameraFacingMode = 'environment';
  let cameraMode = 'photo';
  let mediaRecorder = null;
  let recordedChunks = [];
  let recordingTimer = null;
  let recordingSeconds = 0;
  let capturedBlob = null;
  let capturedType = 'image';
  let isRecording = false;

  function setupInAppCameraListeners() {
    const btnClose = document.getElementById('btn-close-inapp-camera');
    const btnFlip = document.getElementById('btn-flip-inapp-camera');
    const btnPhoto = document.getElementById('mode-btn-photo');
    const btnVideo = document.getElementById('mode-btn-video');
    const btnShutter = document.getElementById('btn-camera-shutter');
    const btnRetake = document.getElementById('btn-retake-camera');
    const btnSendCapture = document.getElementById('btn-send-camera-capture');

    if (btnClose) {
      btnClose.addEventListener('click', closeInAppCamera);
    }

    if (btnFlip) {
      btnFlip.addEventListener('click', async () => {
        cameraFacingMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
        await startCameraStream();
      });
    }

    if (btnPhoto && btnVideo) {
      btnPhoto.addEventListener('click', () => {
        if (isRecording) return;
        cameraMode = 'photo';
        btnPhoto.classList.add('active');
        btnVideo.classList.remove('active');
        if (btnShutter) btnShutter.classList.remove('video-mode');
      });

      btnVideo.addEventListener('click', () => {
        if (isRecording) return;
        cameraMode = 'video';
        btnVideo.classList.add('active');
        btnPhoto.classList.remove('active');
        if (btnShutter) btnShutter.classList.add('video-mode');
      });
    }

    if (btnShutter) {
      btnShutter.addEventListener('click', () => {
        if (cameraMode === 'photo') {
          capturePhoto();
        } else {
          if (!isRecording) {
            startVideoRecording();
          } else {
            stopVideoRecording();
          }
        }
      });
    }

    if (btnRetake) {
      btnRetake.addEventListener('click', retakeCamera);
    }

    if (btnSendCapture) {
      btnSendCapture.addEventListener('click', sendCapturedMedia);
    }
  }

  async function openInAppCamera() {
    const modal = document.getElementById('inapp-camera-modal');
    if (!modal) return;

    if (typeof App !== 'undefined' && App.setMediaPickingActive) {
      App.setMediaPickingActive(true);
    }

    modal.style.display = 'flex';
    retakeCamera();
    cameraMode = 'photo';
    const btnPhoto = document.getElementById('mode-btn-photo');
    const btnVideo = document.getElementById('mode-btn-video');
    const btnShutter = document.getElementById('btn-camera-shutter');
    if (btnPhoto) btnPhoto.classList.add('active');
    if (btnVideo) btnVideo.classList.remove('active');
    if (btnShutter) btnShutter.classList.remove('video-mode');

    await startCameraStream();
  }

  async function startCameraStream() {
    stopCameraStream();

    const video = document.getElementById('inapp-camera-video');
    if (!video) return;

    // Ensure live preview video is strictly muted so the mic doesn't loop into the speaker (acoustic feedback)
    video.muted = true;

    try {
      inAppStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: 1
        }
      });
      video.srcObject = inAppStream;
      video.play();
    } catch (err) {
      console.warn('In-app camera audio+video error, trying video-only:', err);
      try {
        inAppStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cameraFacingMode }
        });
        video.srcObject = inAppStream;
        video.play();
      } catch (err2) {
        App.showToast('Kameraga ulanib bo\'lmadi. Tizim kamerasidan foydalaning');
        closeInAppCamera();
        const cameraPhotoInput = document.getElementById('media-camera-photo-input');
        if (cameraPhotoInput) cameraPhotoInput.click();
      }
    }
  }

  function stopCameraStream() {
    if (inAppStream) {
      inAppStream.getTracks().forEach(t => t.stop());
      inAppStream = null;
    }
    const video = document.getElementById('inapp-camera-video');
    if (video) video.srcObject = null;
  }

  function closeInAppCamera() {
    stopCameraStream();
    if (isRecording) stopVideoRecording();
    clearInterval(recordingTimer);
    const modal = document.getElementById('inapp-camera-modal');
    if (modal) modal.style.display = 'none';
    if (typeof App !== 'undefined' && App.setMediaPickingActive) {
      App.setMediaPickingActive(false);
    }
  }

  function capturePhoto() {
    const video = document.getElementById('inapp-camera-video');
    const canvas = document.getElementById('inapp-camera-canvas');
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      capturedBlob = blob;
      capturedType = 'image';

      const reviewContainer = document.getElementById('camera-review-container');
      const reviewImg = document.getElementById('camera-review-img');
      const reviewVideo = document.getElementById('camera-review-video');
      const liveControls = document.getElementById('camera-live-controls');
      const reviewControls = document.getElementById('camera-review-controls');

      if (reviewImg) {
        reviewImg.src = URL.createObjectURL(blob);
        reviewImg.style.display = 'block';
      }
      if (reviewVideo) reviewVideo.style.display = 'none';
      if (reviewContainer) reviewContainer.style.display = 'flex';
      if (liveControls) liveControls.style.display = 'none';
      if (reviewControls) reviewControls.style.display = 'flex';
    }, 'image/jpeg', 0.9);
  }

  function startVideoRecording() {
    if (!inAppStream) return;
    recordedChunks = [];
    recordingSeconds = 0;
    isRecording = true;

    try {
      mediaRecorder = new MediaRecorder(inAppStream);
    } catch (_) {
      try {
        mediaRecorder = new MediaRecorder(inAppStream, { mimeType: 'video/webm' });
      } catch (e) {
        App.showToast('Brauzeringizda video yozish qo\'llab-quvvatlanmaydi');
        isRecording = false;
        return;
      }
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      isRecording = false;
      const mime = mediaRecorder.mimeType || 'video/webm';
      capturedBlob = new Blob(recordedChunks, { type: mime });
      capturedType = 'video';

      const reviewContainer = document.getElementById('camera-review-container');
      const reviewImg = document.getElementById('camera-review-img');
      const reviewVideo = document.getElementById('camera-review-video');
      const liveControls = document.getElementById('camera-live-controls');
      const reviewControls = document.getElementById('camera-review-controls');

      if (reviewVideo) {
        reviewVideo.src = URL.createObjectURL(capturedBlob);
        reviewVideo.style.display = 'block';
      }
      if (reviewImg) reviewImg.style.display = 'none';
      if (reviewContainer) reviewContainer.style.display = 'flex';
      if (liveControls) liveControls.style.display = 'none';
      if (reviewControls) reviewControls.style.display = 'flex';
    };

    mediaRecorder.start();

    const shutterBtn = document.getElementById('btn-camera-shutter');
    if (shutterBtn) shutterBtn.classList.add('recording');

    const timerBadge = document.getElementById('camera-recording-timer');
    if (timerBadge) {
      timerBadge.style.display = 'block';
      timerBadge.textContent = '🔴 00:00';
    }

    clearInterval(recordingTimer);
    recordingTimer = setInterval(() => {
      recordingSeconds++;
      const m = Math.floor(recordingSeconds / 60).toString().padStart(2, '0');
      const s = (recordingSeconds % 60).toString().padStart(2, '0');
      if (timerBadge) timerBadge.textContent = `🔴 ${m}:${s}`;
    }, 1000);
  }

  function stopVideoRecording() {
    isRecording = false;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    clearInterval(recordingTimer);
    const shutterBtn = document.getElementById('btn-camera-shutter');
    if (shutterBtn) shutterBtn.classList.remove('recording');
    const timerBadge = document.getElementById('camera-recording-timer');
    if (timerBadge) timerBadge.style.display = 'none';
  }

  function retakeCamera() {
    capturedBlob = null;
    const reviewContainer = document.getElementById('camera-review-container');
    const reviewImg = document.getElementById('camera-review-img');
    const reviewVideo = document.getElementById('camera-review-video');
    const liveControls = document.getElementById('camera-live-controls');
    const reviewControls = document.getElementById('camera-review-controls');

    if (reviewImg) {
      reviewImg.src = '';
      reviewImg.style.display = 'none';
    }
    if (reviewVideo) {
      reviewVideo.src = '';
      reviewVideo.style.display = 'none';
    }
    if (reviewContainer) reviewContainer.style.display = 'none';
    if (reviewControls) reviewControls.style.display = 'none';
    if (liveControls) liveControls.style.display = 'flex';
  }

  function sendCapturedMedia() {
    if (!capturedBlob) return;

    const ext = capturedType === 'video' ? 'webm' : 'jpg';
    const filename = `camera_${Date.now()}.${ext}`;
    const file = new File([capturedBlob], filename, { type: capturedBlob.type });

    closeInAppCamera();
    uploadAndSendMedia(file, 'camera');
  }

  // -------------------------------------------------------------
  // VOICE NOTE / AUDIO MESSAGE CONTROLLER
  // -------------------------------------------------------------
  let voiceStream = null;
  let voiceRecorder = null;
  let voiceChunks = [];
  let voiceTimer = null;
  let voiceSeconds = 0;
  let isVoiceRecording = false;

  async function startVoiceRecording() {
    if (!activeConversation) {
      App.showToast('Iltimos, avval biror suhbatni oching');
      return;
    }

    if (isVoiceRecording) return;

    if (typeof App !== 'undefined' && App.setMediaPickingActive) {
      App.setMediaPickingActive(true);
    }

    // 1. Immediately pause and silence any playing audio/video to avoid acoustic feedback / echo
    document.querySelectorAll('audio, video').forEach(el => {
      try {
        if (!el.paused) el.pause();
      } catch (_) {}
    });

    try {
      // 2. Request crystal-clear audio with hardware-level Echo Cancellation and Noise Suppression
      voiceStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: 1, // Mono eliminates stereo phasing and reverberation
          sampleRate: { ideal: 48000 }
        }
      });
    } catch (err) {
      console.warn('Advanced audio constraints failed, trying basic echoCancellation:', err);
      try {
        voiceStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (fallbackErr) {
        console.warn('Microphone permission error:', fallbackErr);
        App.showToast('Mikrofondan foydalanishga ruxsat berilmadi');
        if (typeof App !== 'undefined' && App.setMediaPickingActive) {
          App.setMediaPickingActive(false);
        }
        return;
      }
    }

    voiceChunks = [];
    voiceSeconds = 0;
    isVoiceRecording = true;

    let options = {};
    if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
      }
    }

    try {
      voiceRecorder = new MediaRecorder(voiceStream, options);
    } catch (_) {
      voiceRecorder = new MediaRecorder(voiceStream);
    }

    voiceRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        voiceChunks.push(e.data);
      }
    };

    voiceRecorder.start(250);

    // Switch input bar to live recording UI
    const normalBar = document.getElementById('chat-normal-input-bar');
    const recordingBar = document.getElementById('chat-voice-recording-bar');
    const timerEl = document.getElementById('voice-recording-timer');
    if (normalBar) normalBar.style.display = 'none';
    if (recordingBar) recordingBar.style.display = 'flex';
    if (timerEl) timerEl.textContent = '00:00';

    clearInterval(voiceTimer);
    voiceTimer = setInterval(() => {
      voiceSeconds++;
      const m = Math.floor(voiceSeconds / 60).toString().padStart(2, '0');
      const s = (voiceSeconds % 60).toString().padStart(2, '0');
      if (timerEl) timerEl.textContent = `${m}:${s}`;
    }, 1000);
  }

  function cancelVoiceRecording() {
    if (!isVoiceRecording) return;
    isVoiceRecording = false;
    clearInterval(voiceTimer);

    if (voiceRecorder && voiceRecorder.state !== 'inactive') {
      voiceRecorder.stop();
    }
    if (voiceStream) {
      voiceStream.getTracks().forEach(t => t.stop());
      voiceStream = null;
    }
    voiceChunks = [];

    const normalBar = document.getElementById('chat-normal-input-bar');
    const recordingBar = document.getElementById('chat-voice-recording-bar');
    if (recordingBar) recordingBar.style.display = 'none';
    if (normalBar) normalBar.style.display = 'flex';

    if (typeof App !== 'undefined' && App.setMediaPickingActive) {
      App.setMediaPickingActive(false);
    }
    App.showToast('Ovozli xabar bekor qilindi');
  }

  function finishAndSendVoiceRecording() {
    if (!isVoiceRecording || !voiceRecorder) return;

    if (voiceSeconds < 1) {
      App.showToast('Ovoz juda qisqa');
      cancelVoiceRecording();
      return;
    }

    isVoiceRecording = false;
    clearInterval(voiceTimer);

    voiceRecorder.onstop = () => {
      const mime = voiceRecorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(voiceChunks, { type: mime });

      if (voiceStream) {
        voiceStream.getTracks().forEach(t => t.stop());
        voiceStream = null;
      }
      voiceChunks = [];

      const normalBar = document.getElementById('chat-normal-input-bar');
      const recordingBar = document.getElementById('chat-voice-recording-bar');
      if (recordingBar) recordingBar.style.display = 'none';
      if (normalBar) normalBar.style.display = 'flex';

      const ext = mime.includes('mp4') ? 'm4a' : 'webm';
      const voiceFile = new File([audioBlob], `voice_${Date.now()}.${ext}`, { type: mime });

      uploadAndSendMedia(voiceFile, 'voice');

      if (typeof App !== 'undefined' && App.setMediaPickingActive) {
        setTimeout(() => App.setMediaPickingActive(false), 2000);
      }
    };

    voiceRecorder.stop();
  }

  // -------------------------------------------------------------
  // TELEGRAM-STYLE ATTACHMENT MENU CONTROLLER (📎)
  // -------------------------------------------------------------
  function openAttachmentMenu() {
    const modal = document.getElementById('attachment-menu-modal');
    if (modal) modal.classList.add('open');
  }

  function closeAttachmentMenu() {
    const modal = document.getElementById('attachment-menu-modal');
    if (modal) modal.classList.remove('open');
  }

  function pickGallery() {
    closeAttachmentMenu();
    if (typeof App !== 'undefined' && App.setMediaPickingActive) {
      App.setMediaPickingActive(true);
    }
    const input = document.getElementById('media-gallery-input');
    if (input) input.click();
  }

  function pickDocument() {
    closeAttachmentMenu();
    if (typeof App !== 'undefined' && App.setMediaPickingActive) {
      App.setMediaPickingActive(true);
    }
    const input = document.getElementById('media-doc-input');
    if (input) input.click();
  }

  function pickCameraPhoto() {
    closeAttachmentMenu();
    if (typeof App !== 'undefined' && App.setMediaPickingActive) {
      App.setMediaPickingActive(true);
    }
    const input = document.getElementById('media-camera-photo-input');
    if (input) input.click();
  }

  function pickCameraVideo() {
    closeAttachmentMenu();
    if (typeof App !== 'undefined' && App.setMediaPickingActive) {
      App.setMediaPickingActive(true);
    }
    const input = document.getElementById('media-camera-video-input');
    if (input) input.click();
  }

  // -------------------------------------------------------------
  // TELEGRAM-STYLE DYNAMIC INPUT & MODE TOGGLE (➤ vs 🎙️ / 📹)
  // -------------------------------------------------------------
  let mediaNoteMode = 'voice'; // 'voice' (🎙️) or 'video_note' (📹)
  let mediaHoldTimer = null;
  let didHoldRecord = false;
  let holdRecordStartTime = 0;

  function updateInputButtons() {
    const input = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-msg-btn');
    const mediaBtn = document.getElementById('chat-media-btn');
    if (!input || !sendBtn || !mediaBtn) return;

    const hasText = (input.value || '').trim().length > 0;
    if (hasText) {
      sendBtn.style.display = 'flex';
      mediaBtn.style.display = 'none';
    } else {
      sendBtn.style.display = 'none';
      mediaBtn.style.display = 'flex';
    }
  }

  function updateMediaButtonIcon() {
    const iconEl = document.getElementById('chat-media-btn-icon');
    const btn = document.getElementById('chat-media-btn');
    if (!iconEl || !btn) return;

    if (mediaNoteMode === 'voice') {
      iconEl.textContent = '🎙️';
      btn.title = "Ovozli xabar yozish (Bosib turing) / Video rejimiga o'tish (Bosing)";
    } else {
      iconEl.textContent = '📹';
      btn.title = "Dumaloq video yozish (Bosib turing) / Ovoz rejimiga o'tish (Bosing)";
    }
  }

  function toggleMediaNoteMode() {
    mediaNoteMode = (mediaNoteMode === 'voice' ? 'video_note' : 'voice');
    updateMediaButtonIcon();
    if (typeof App !== 'undefined' && App.showToast) {
      const label = (mediaNoteMode === 'voice' ? "🎙️ Ovozli xabar rejimi" : "📹 Dumaloq video xabar rejimi");
      App.showToast(label);
    }
  }

  function setupMediaButtonListeners() {
    const btn = document.getElementById('chat-media-btn');
    if (!btn) return;

    updateMediaButtonIcon();
    updateInputButtons();

    const onPointerDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      didHoldRecord = false;
      holdRecordStartTime = Date.now();

      mediaHoldTimer = setTimeout(() => {
        didHoldRecord = true;
        if (mediaNoteMode === 'voice') {
          startVoiceRecording();
        } else {
          startRoundVideoRecording();
        }
      }, 280);
    };

    const onPointerUp = (e) => {
      if (mediaHoldTimer) {
        clearTimeout(mediaHoldTimer);
        mediaHoldTimer = null;
      }

      if (!didHoldRecord) {
        // Quick tap: switch mode between Voice (🎙️) and Video Note (📹)
        toggleMediaNoteMode();
      } else {
        // Was held down: if held for > 1.8 seconds, finish & send
        const duration = (Date.now() - holdRecordStartTime) / 1000;
        if (duration >= 1.8) {
          if (isVoiceRecording) {
            finishAndSendVoiceRecording();
          } else if (isRoundVideoRecording) {
            stopAndSendRoundVideo();
          }
        }
      }
    };

    const onPointerCancel = () => {
      if (mediaHoldTimer) {
        clearTimeout(mediaHoldTimer);
        mediaHoldTimer = null;
      }
    };

    btn.addEventListener('pointerdown', onPointerDown);
    btn.addEventListener('pointerup', onPointerUp);
    btn.addEventListener('pointercancel', onPointerCancel);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // -------------------------------------------------------------
  // ROUND VIDEO NOTE CONTROLLER ("Dumaloq video xabar")
  // -------------------------------------------------------------
  let roundVideoStream = null;
  let roundVideoRecorder = null;
  let roundVideoChunks = [];
  let roundVideoTimer = null;
  let roundVideoSeconds = 0;
  let isRoundVideoRecording = false;
  let currentRoundFacing = 'user'; // front camera

  async function startRoundVideoRecording() {
    if (!activeConversation) {
      App.showToast('Iltimos, avval biror suhbatni oching');
      return;
    }
    if (isRoundVideoRecording) return;

    if (typeof App !== 'undefined' && App.setMediaPickingActive) {
      App.setMediaPickingActive(true);
    }

    // Silence any playing media
    document.querySelectorAll('audio, video').forEach(el => {
      try { if (!el.paused) el.pause(); } catch (_) {}
    });

    const overlay = document.getElementById('round-video-recording-overlay');
    const liveFeed = document.getElementById('round-video-live-feed');
    const timerEl = document.getElementById('round-video-timer');

    try {
      roundVideoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: currentRoundFacing,
          width: { ideal: 480 },
          height: { ideal: 480 },
          aspectRatio: { ideal: 1 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });
    } catch (err) {
      console.warn('Advanced round video constraints failed, trying basic:', err);
      try {
        roundVideoStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
      } catch (fallbackErr) {
        console.error('Camera/Microphone error:', fallbackErr);
        App.showToast('Kamera yoki mikrofondan foydalanishga ruxsat berilmadi');
        if (typeof App !== 'undefined' && App.setMediaPickingActive) {
          App.setMediaPickingActive(false);
        }
        return;
      }
    }

    if (liveFeed) {
      liveFeed.srcObject = roundVideoStream;
      liveFeed.play().catch(() => {});
    }

    if (overlay) overlay.style.display = 'flex';

    roundVideoChunks = [];
    roundVideoSeconds = 0;
    isRoundVideoRecording = true;

    let mime = 'video/webm';
    if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        mime = 'video/webm;codecs=vp8,opus';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mime = 'video/webm';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mime = 'video/mp4';
      }
    }

    try {
      roundVideoRecorder = new MediaRecorder(roundVideoStream, { mimeType: mime });
    } catch (_) {
      roundVideoRecorder = new MediaRecorder(roundVideoStream);
    }

    roundVideoRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        roundVideoChunks.push(e.data);
      }
    };

    roundVideoRecorder.start(250);

    if (timerEl) timerEl.textContent = '00:00 / 01:00';

    clearInterval(roundVideoTimer);
    roundVideoTimer = setInterval(() => {
      roundVideoSeconds++;
      const m = Math.floor(roundVideoSeconds / 60).toString().padStart(2, '0');
      const s = (roundVideoSeconds % 60).toString().padStart(2, '0');
      if (timerEl) timerEl.textContent = `${m}:${s} / 01:00`;

      if (roundVideoSeconds >= 60) {
        stopAndSendRoundVideo();
      }
    }, 1000);
  }

  async function flipRoundVideoCamera() {
    const nextFacing = (currentRoundFacing === 'user' ? 'environment' : 'user');
    const liveFeed = document.getElementById('round-video-live-feed');

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: nextFacing,
          width: { ideal: 480 },
          height: { ideal: 480 }
        }
      });
      currentRoundFacing = nextFacing;

      const oldTracks = roundVideoStream ? roundVideoStream.getVideoTracks() : [];
      const newVideoTrack = newStream.getVideoTracks()[0];

      if (roundVideoStream && newVideoTrack) {
        oldTracks.forEach(t => {
          roundVideoStream.removeTrack(t);
          t.stop();
        });
        roundVideoStream.addTrack(newVideoTrack);
      }

      if (liveFeed) {
        liveFeed.srcObject = roundVideoStream;
        liveFeed.style.transform = (currentRoundFacing === 'user') ? 'scaleX(-1)' : 'none';
      }
    } catch (e) {
      console.warn('Flip camera error:', e);
    }
  }

  function stopAndSendRoundVideo() {
    if (!isRoundVideoRecording || !roundVideoRecorder) return;

    if (roundVideoSeconds < 1) {
      App.showToast('Video xabar juda qisqa');
      cancelRoundVideo();
      return;
    }

    isRoundVideoRecording = false;
    clearInterval(roundVideoTimer);

    const overlay = document.getElementById('round-video-recording-overlay');
    if (overlay) overlay.style.display = 'none';

    roundVideoRecorder.onstop = () => {
      const mime = roundVideoRecorder.mimeType || 'video/webm';
      const videoBlob = new Blob(roundVideoChunks, { type: mime });

      if (roundVideoStream) {
        roundVideoStream.getTracks().forEach(t => t.stop());
        roundVideoStream = null;
      }
      roundVideoChunks = [];

      const ext = mime.includes('mp4') ? 'mp4' : 'webm';
      const roundVideoFile = new File([videoBlob], `round_video_${Date.now()}.${ext}`, { type: mime });

      uploadAndSendMedia(roundVideoFile, 'video_note');

      if (typeof App !== 'undefined' && App.setMediaPickingActive) {
        setTimeout(() => App.setMediaPickingActive(false), 2000);
      }
    };

    if (roundVideoRecorder.state !== 'inactive') {
      roundVideoRecorder.stop();
    }
  }

  function cancelRoundVideo() {
    if (!isRoundVideoRecording) return;
    isRoundVideoRecording = false;
    clearInterval(roundVideoTimer);

    const overlay = document.getElementById('round-video-recording-overlay');
    if (overlay) overlay.style.display = 'none';

    if (roundVideoRecorder && roundVideoRecorder.state !== 'inactive') {
      roundVideoRecorder.stop();
    }
    if (roundVideoStream) {
      roundVideoStream.getTracks().forEach(t => t.stop());
      roundVideoStream = null;
    }
    roundVideoChunks = [];

    if (typeof App !== 'undefined' && App.setMediaPickingActive) {
      App.setMediaPickingActive(false);
    }
    App.showToast('Dumaloq video bekor qilindi');
  }

  function toggleRoundVideo(wrapper) {
    if (!wrapper) return;
    const video = wrapper.querySelector('video');
    const playBtn = wrapper.querySelector('.round-video-play-btn');
    if (!video) return;

    if (video.paused) {
      document.querySelectorAll('audio, video').forEach(m => {
        if (m !== video && !m.paused) {
          try { m.pause(); } catch (_) {}
        }
      });
      video.muted = false;
      video.play().then(() => {
        if (playBtn) playBtn.style.opacity = '0';
      }).catch(err => {
        console.warn('Video play error:', err);
      });
    } else {
      video.pause();
      if (playBtn) playBtn.style.opacity = '1';
    }
  }

  // Disconnect Socket.io
  function disconnectSocket() {
    if (socket) {
      try { socket.disconnect(); } catch (_) {}
      socket = null;
    }
  }

  // Connect to Socket.io with JWT authentication
  function connectSocket() {
    const token = Auth.getToken();
    if (!token) return;

    if (socket && socket.connected) return;

    if (socket) {
      socket.disconnect();
    }

    const socketHost = window.API_BASE_URL || undefined;
    socket = io(socketHost, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('⚡ Socket muvaffaqiyatli ulandi:', socket.id);
      if (activeConversation) {
        socket.emit('join_conversation', { conversationId: activeConversation.id });
        socket.emit('mark_as_read', { conversationId: activeConversation.id });
      }
    });

    // Real-time message received
    socket.on('new_message', (msg) => {
      const myUser = Auth.getUser();
      const isMyMessage = myUser && msg.senderId === myUser.id;

      if (activeConversation && msg.conversationId === activeConversation.id) {
        const existing = document.getElementById(`msg-row-${msg.id}`);
        if (!existing) {
          try {
            appendMessageBubble(msg);
            scrollToBottom();
          } catch (e) {
            console.error('Error appending new message:', e);
          }
        }

        // Only the receiver marks incoming message as read
        if (!isMyMessage) {
          socket.emit('mark_as_read', { conversationId: activeConversation.id });
        }
      } else {
        loadConversations();
      }
    });

    // Message read receipt (turns checkmarks to ✓✓ only when the other person views the message)
    socket.on('messages_read', ({ conversationId, readerId }) => {
      const myUser = Auth.getUser();
      if (myUser && readerId !== myUser.id && activeConversation && activeConversation.id === conversationId) {
        document.querySelectorAll('.message-row.outgoing .msg-status-check').forEach(el => {
          el.textContent = '✓✓';
          el.style.color = '#38bdf8';
        });
      }
      loadConversations();
    });

    // Typing indicators
    socket.on('user_typing', ({ conversationId }) => {
      if (activeConversation && activeConversation.id === conversationId) {
        const statusEl = document.getElementById('partner-status-text');
        if (statusEl) {
          statusEl.textContent = 'yozmoqda...';
          statusEl.style.color = 'var(--primary)';
        }
      }
    });

    socket.on('user_stop_typing', ({ conversationId }) => {
      if (activeConversation && activeConversation.id === conversationId) {
        updatePartnerStatusDisplay();
      }
    });

    // Online status changed
    socket.on('user_status_changed', ({ userId, isOnline, lastSeen }) => {
      if (activePartner && activePartner.id === userId) {
        activePartner.isOnline = isOnline;
        activePartner.lastSeen = lastSeen;
        updatePartnerStatusDisplay();
      }
      loadConversations();
    });

    socket.on('conversation_updated', () => {
      loadConversations();
    });

    // Real-time message deleted for me / everyone
    socket.on('message_deleted', ({ messageId }) => {
      removeMessageFromUI(messageId);
      loadConversations();
    });

    // Real-time device session termination (Telegram-style kickout)
    socket.on('session_revoked', () => {
      if (typeof Auth !== 'undefined' && Auth.checkAuthStatus) {
        Auth.checkAuthStatus().then(valid => {
          if (!valid) {
            App.showToast('Ushbu qurilma sessiyasi boshqa qurilmangiz orqali chiqarildi');
            if (Auth.logout) Auth.logout();
          }
        });
      }
    });

    socket.on('all_other_sessions_revoked', () => {
      if (typeof Auth !== 'undefined' && Auth.checkAuthStatus) {
        Auth.checkAuthStatus().then(valid => {
          if (!valid) {
            App.showToast('Barcha boshqa qurilmalar akkauntdan chiqarildi');
            if (Auth.logout) Auth.logout();
          }
        });
      }
    });

    socket.on('connect_error', (err) => {
      if (err && (err.message === 'SESSION_REVOKED' || err.message === 'Sessiya bekor qilingan yoki parol yangilangan')) {
        App.showToast('Sessiyangiz tugatilgan. Qaytadan kiring.');
        if (typeof Auth !== 'undefined' && Auth.logout) Auth.logout();
      }
    });
  }

  // Load conversations list
  async function loadConversations() {
    const token = Auth.getToken();
    if (!token) return;

    try {
      const res = await fetch('/api/chat/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      const container = document.getElementById('conversations-list-container');
      if (!container) return;

      if (!res.ok || !data.success || !data.conversations || data.conversations.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">💬</div>
            <div class="empty-text">Hali hech qanday suhbat yo'q.<br>Nik orqali do'stingizni qidirib xabar yozing!</div>
          </div>
        `;
        return;
      }

      container.innerHTML = data.conversations.map(c => {
        const timeFormatted = formatTime(c.lastMessageTime);
        const avatarLetter = (c.partner.displayName || c.partner.username || 'U').charAt(0).toUpperCase();
        let avatarContent = `<span style="font-weight:700; color:#fff;">${avatarLetter}</span>`;
        if (c.partner.avatarUrl && typeof c.partner.avatarUrl === 'string' && c.partner.avatarUrl.trim() !== '') {
          const resolved = (typeof window.resolveMediaUrl === 'function') ? window.resolveMediaUrl(c.partner.avatarUrl) : c.partner.avatarUrl;
          avatarContent = `
            <span style="font-weight:700; color:#fff; position:relative; z-index:1;">${avatarLetter}</span>
            <img src="${resolved}" class="avatar-img-circle" alt="" 
                 style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:2; border-radius:50%;"
                 onerror="this.remove();" 
                 onload="const fb=this.previousElementSibling; if(fb) fb.remove();">
          `;
        }

        return `
          <div class="conv-item" onclick="Chat.openDialog('${c.id}', ${JSON.stringify(c.partner).replace(/"/g, '&quot;')})">
            <div class="user-avatar" style="position:relative; background-color: ${c.partner.avatarColor || '#3b82f6'};">
              ${avatarContent}
              ${c.partner.isOnline ? '<div class="online-dot"></div>' : ''}
            </div>
            <div class="conv-details">
              <div class="conv-top-line">
                <div class="conv-name">${c.partner.displayName} <span style="font-size:12px; font-weight:normal; color:var(--text-muted);">(@${c.partner.username})</span></div>
                <div class="conv-time">${timeFormatted}</div>
              </div>
              <div class="conv-bottom-line">
                <div class="conv-last-msg">${c.lastMessage || 'Suhbat boshlandi'}</div>
                ${c.unreadCount > 0 ? `<div class="unread-badge">${c.unreadCount}</div>` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');

    } catch (err) {
      console.error('Conversations load xatolik:', err);
    }
  }

  // Search users by @nik
  async function searchUsers(query) {
    const token = Auth.getToken();
    if (!token) return;

    try {
      const res = await fetch(`/api/chat/search-users?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      const resultsContainer = document.getElementById('user-search-results');
      if (!resultsContainer) return;

      if (!res.ok || !data.success || !data.users || data.users.length === 0) {
        const emptyMsg = query ? `"${query}" niki bo'yicha hech kim topilmadi` : 'Hozircha tizimda boshqa foydalanuvchilar mavjud emas';
        resultsContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <div class="empty-text">${emptyMsg}</div>
          </div>
        `;
        return;
      }

      const headerHtml = `<div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px; font-weight: 600;">Topilgan foydalanuvchilar (${data.users.length} ta):</div>`;

      resultsContainer.innerHTML = headerHtml + data.users.map(u => {
        const avatarLetter = (u.displayName || u.username || 'U').charAt(0).toUpperCase();
        let avatarContent = `<span style="font-weight:700; color:#fff;">${avatarLetter}</span>`;
        if (u.avatarUrl && typeof u.avatarUrl === 'string' && u.avatarUrl.trim() !== '') {
          const resolved = (typeof window.resolveMediaUrl === 'function') ? window.resolveMediaUrl(u.avatarUrl) : u.avatarUrl;
          avatarContent = `
            <span style="font-weight:700; color:#fff; position:relative; z-index:1;">${avatarLetter}</span>
            <img src="${resolved}" class="avatar-img-circle" alt="" 
                 style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:2; border-radius:50%;"
                 onerror="this.remove();" 
                 onload="const fb=this.previousElementSibling; if(fb) fb.remove();">
          `;
        }

        return `
          <div class="conv-item" style="border-radius: var(--radius-md); background: var(--bg-card); border: 1px solid var(--border); margin-bottom: 8px; cursor: pointer;" onclick="Chat.startChatWithUser(${u.id})">
            <div class="user-avatar" style="position:relative; background-color: ${u.avatarColor || '#3b82f6'};">
              ${avatarContent}
              ${u.isOnline ? '<div class="online-dot"></div>' : ''}
            </div>
            <div class="conv-details">
              <div class="conv-top-line">
                <div class="conv-name">${u.displayName} <span style="font-size:12px; font-weight:normal; color:var(--text-muted);">(@${u.username})</span></div>
              </div>
              <div class="conv-bottom-line">
                <div class="conv-last-msg" style="font-style: italic;">${u.bio || 'Wisdom Dictionary foydalanuvchisi'}</div>
              </div>
            </div>
            <button class="btn-primary" style="padding: 6px 14px; font-size: 13px; margin-left: 8px; border-radius: var(--radius-full);" onclick="event.stopPropagation(); Chat.startChatWithUser(${u.id})">
              💬 Yozish
            </button>
          </div>
        `;
      }).join('');

    } catch (err) {
      console.error('Search users xatolik:', err);
    }
  }

  // Start chat with user ID
  async function startChatWithUser(partnerId) {
    const token = Auth.getToken();
    if (!token) return;

    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ partnerId })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        openDialog(data.conversation.id, data.conversation.partner);
      } else {
        App.showToast(data.message || 'Chat ochishda xatolik');
      }
    } catch (err) {
      App.showToast('Aloqa xatoligi');
    }
  }

  // Open Dialog Room
  async function openDialog(convId, partner) {
    activeConversation = { id: convId };
    activePartner = partner;

    // Setup Partner Header Info
    const avatarEl = document.getElementById('partner-avatar');
    const nameEl = document.getElementById('partner-display-name');
    if (avatarEl) {
      const initial = (partner.displayName || partner.username || 'U').charAt(0).toUpperCase();
      avatarEl.style.backgroundColor = partner.avatarColor || '#3b82f6';
      avatarEl.style.color = '#ffffff';
      if (partner.avatarUrl && typeof partner.avatarUrl === 'string' && partner.avatarUrl.trim() !== '') {
        const resolved = (typeof window.resolveMediaUrl === 'function') ? window.resolveMediaUrl(partner.avatarUrl) : partner.avatarUrl;
        avatarEl.innerHTML = `
          <span style="font-weight:700; position:relative; z-index:1;">${initial}</span>
          <img src="${resolved}" class="avatar-img-circle" alt="" 
               style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:2; border-radius:50%;"
               onerror="this.remove();" 
               onload="const fb=this.previousElementSibling; if(fb) fb.remove();">
        `;
      } else {
        avatarEl.innerHTML = `<span style="font-weight:700;">${initial}</span>`;
      }
    }
    if (nameEl) {
      nameEl.innerHTML = `${partner.displayName} <span style="font-size:12px; font-weight:normal; color:var(--text-muted);">(@${partner.username})</span>`;
    }
    updatePartnerStatusDisplay();

    // Persist active conversation in case user switches to calculator or gallery
    sessionStorage.setItem('wisdom_active_conv_id', convId);
    sessionStorage.setItem('wisdom_active_partner', JSON.stringify(partner));

    // Switch to active chat room
    App.switchToView('chat-room');

    // Ensure socket is connected and join room
    if (!socket || !socket.connected) {
      connectSocket();
    }
    if (socket) {
      socket.emit('join_conversation', { conversationId: convId });
      socket.emit('mark_as_read', { conversationId: convId });
    }

    // Load message history
    await loadMessages(convId);

    // Focus input and reset buttons
    const input = document.getElementById('message-input');
    if (input) {
      input.value = '';
      input.style.height = 'auto';
      input.focus();
    }
    updateInputButtons();
  }

  // Restore active conversation if resuming from background / calculator / gallery
  function restoreActiveConversation() {
    const convId = sessionStorage.getItem('wisdom_active_conv_id');
    const partnerStr = sessionStorage.getItem('wisdom_active_partner');
    if (convId && partnerStr) {
      try {
        const partner = JSON.parse(partnerStr);
        openDialog(convId, partner);
      } catch (_) {}
    }
  }

  function updatePartnerStatusDisplay() {
    const statusEl = document.getElementById('partner-status-text');
    if (!statusEl || !activePartner) return;

    if (activePartner.isOnline) {
      statusEl.textContent = 'tarmoqda';
      statusEl.className = 'chat-partner-status online';
    } else {
      statusEl.textContent = 'yaqinda ko\'rilgan';
      statusEl.className = 'chat-partner-status';
    }
  }

  // Load message history
  async function loadMessages(convId) {
    const token = Auth.getToken();
    const container = document.getElementById('messages-container');
    if (!container) return;

    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px;">Yuklanmoqda...</div>';

    try {
      const res = await fetch(`/api/chat/conversations/${convId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (!data.messages || data.messages.length === 0) {
          container.innerHTML = `
            <div style="text-align: center; margin: auto; color: var(--text-muted); font-size: 13px;">
              ✨ Ushbu suhbat toza va shifrlangan.<br>Birinchi xabaringizni yuboring!
            </div>
          `;
          return;
        }

        container.innerHTML = '';
        data.messages.forEach(msg => {
          try {
            appendMessageBubble(msg);
          } catch (renderErr) {
            console.error('Message render error:', renderErr);
          }
        });
        scrollToBottom();
      } else {
        container.innerHTML = `<div style="color: red; text-align: center; padding: 20px;">${escapeHtml(data.message || 'Xabarlarni yuklab bo\'lmadi')}</div>`;
      }
    } catch (err) {
      console.error('loadMessages error:', err);
      container.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Xabarlarni yuklab bo\'lmadi</div>';
    }
  }

  // Send message
  function handleSendMessage() {
    const input = document.getElementById('message-input');
    if (!input || !activeConversation) return;

    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';
    updateInputButtons();

    if (socket && isTyping) {
      isTyping = false;
      socket.emit('stop_typing', { conversationId: activeConversation.id });
    }

    if (socket && socket.connected) {
      socket.emit('send_message', {
        conversationId: activeConversation.id,
        text
      });
    } else {
      const token = Auth.getToken();
      fetch(`/api/chat/conversations/${activeConversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          appendMessageBubble(d.message);
          scrollToBottom();
        }
      });
    }
  }

  // Upload and send media (Gallery photo/video or Live Camera up to 200MB)
  function uploadAndSendMedia(file, source) {
    if (!activeConversation) {
      App.showToast('Iltimos, avval biror chatni oching');
      return;
    }

    // 200MB limit check
    const MAX_SIZE = 200 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      App.showToast('Fayl hajmi juda katta (maksimal 200MB)');
      return;
    }

    const progressBanner = document.getElementById('media-upload-progress');
    const progressText = document.getElementById('upload-progress-text');
    if (progressBanner) progressBanner.style.display = 'flex';
    if (progressText) progressText.textContent = `Fayl yuklanmoqda (0%)...`;

    const ext = ((file.name || '').split('.').pop() || '').toLowerCase();
    let determinedType = 'image';
    const videoExts = ['mp4', 'webm', 'mov', 'mkv', 'avi', '3gp', 'm4v', 'ts', 'flv'];
    const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'opus', 'flac'];
    const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico'];

    if (source === 'video_note' || source === 'round_video') {
      determinedType = 'video_note';
      source = 'video_note';
    } else if (source === 'file' || (!videoExts.includes(ext) && !audioExts.includes(ext) && !imageExts.includes(ext))) {
      determinedType = 'file';
    } else if (file.type.startsWith('video') || videoExts.includes(ext)) {
      determinedType = 'video';
    } else if (file.type.startsWith('audio') || source === 'voice' || audioExts.includes(ext)) {
      determinedType = 'audio';
    }

    const token = Auth.getToken();
    const formData = new FormData();
    formData.append('media', file);
    formData.append('source', source);
    formData.append('mediaType', determinedType);

    const uploadUrl = (typeof window.resolveMediaUrl === 'function')
      ? window.resolveMediaUrl('/api/chat/upload')
      : '/api/chat/upload';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        if (progressText) {
          progressText.textContent = `Fayl yuklanmoqda (${pct}%)...`;
        }
      }
    };

    xhr.onload = () => {
      if (progressBanner) progressBanner.style.display = 'none';

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success) {
            const fileName = res.originalName || file.name || '';
            const msgText = (res.mediaType === 'file') ? fileName : '';

            // Send message with media
            if (socket && socket.connected) {
              socket.emit('send_message', {
                conversationId: activeConversation.id,
                text: msgText,
                mediaUrl: res.mediaUrl,
                mediaType: res.mediaType,
                mediaSource: res.mediaSource,
                mediaSize: res.mediaSize
              });
            } else {
              fetch(`/api/chat/conversations/${activeConversation.id}/messages`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                  text: msgText,
                  mediaUrl: res.mediaUrl,
                  mediaType: res.mediaType,
                  mediaSource: res.mediaSource,
                  mediaSize: res.mediaSize
                })
              })
              .then(r => r.json())
              .then(d => {
                if (d.success) {
                  appendMessageBubble(d.message);
                  scrollToBottom();
                }
              });
            }
          } else {
            App.showToast(res.message || 'Yuklashda xatolik yuz berdi');
          }
        } catch (_) {
          App.showToast('Javobni qayta ishlashda xatolik');
        }
      } else {
        App.showToast('Serverga yuklab bo\'lmadi');
      }
    };

    xhr.onerror = () => {
      if (progressBanner) progressBanner.style.display = 'none';
      App.showToast('Aloqa xatoligi tufayli yuklanmadi');
    };

    xhr.send(formData);
  }

  // Open Media in Fullscreen Lightbox
  function openMediaLightbox(url) {
    const modal = document.getElementById('media-lightbox-modal');
    const img = document.getElementById('lightbox-img');
    if (modal && img) {
      img.src = url;
      modal.style.display = 'flex';
    }
  }

  // Append bubble into messages stream
  function appendMessageBubble(msg) {
    const container = document.getElementById('messages-container');
    if (!container) return;

    if (container.children.length === 1 && container.children[0].tagName === 'DIV' && !container.children[0].classList.contains('message-row')) {
      container.innerHTML = '';
    }

    const myUser = Auth.getUser();
    const isOutgoing = myUser && msg.senderId === myUser.id;
    const timeFormatted = formatTime(msg.createdAt);

    let mediaHtml = '';
    let isFile = false;
    let fileName = '';
    const isVideoNote = Boolean(msg.mediaUrl && (msg.mediaType === 'video_note' || msg.mediaSource === 'video_note'));

    if (msg.mediaUrl) {
      const urlLower = (msg.mediaUrl || '').toLowerCase();
      const isVoice = !isVideoNote && (msg.mediaSource === 'voice' || msg.mediaType === 'audio' || urlLower.endsWith('.ogg') || urlLower.endsWith('.wav') || urlLower.endsWith('.mp3') || urlLower.endsWith('.m4a'));
      const isVideo = !isVideoNote && (msg.mediaType === 'video' || urlLower.endsWith('.mp4') || urlLower.endsWith('.webm') || urlLower.endsWith('.mov') || urlLower.endsWith('.mkv') || urlLower.endsWith('.3gp') || urlLower.endsWith('.m4v'));
      isFile = !isVideoNote && (msg.mediaType === 'file' || (!isVoice && !isVideo && !urlLower.endsWith('.jpg') && !urlLower.endsWith('.jpeg') && !urlLower.endsWith('.png') && !urlLower.endsWith('.webp') && !urlLower.endsWith('.gif') && !urlLower.endsWith('.svg') && !urlLower.endsWith('.bmp') && !urlLower.endsWith('.ico')));

      const resolvedMediaUrl = (msg.mediaUrl && typeof window.resolveMediaUrl === 'function')
        ? window.resolveMediaUrl(msg.mediaUrl)
        : (msg.mediaUrl || '');

      if (isVideoNote) {
        mediaHtml = `
          <div class="msg-media-container round-video-bubble-box">
            <div class="round-video-wrapper" onclick="if(window.Chat&&Chat.toggleRoundVideo)Chat.toggleRoundVideo(this)">
              <video class="round-video-element" src="${resolvedMediaUrl}" playsinline loop preload="metadata" onplay="const p=this.parentElement.querySelector('.round-video-play-btn');if(p)p.style.opacity='0';" onpause="const p=this.parentElement.querySelector('.round-video-play-btn');if(p)p.style.opacity='1';"></video>
              <div class="round-video-play-btn">▶</div>
            </div>
          </div>
        `;
      } else if (isVoice) {
        const badgeHtml = `
          <div class="media-source-tag voice">
            <span>🎙️</span>
            <span>Ovozli xabar</span>
          </div>
        `;
        mediaHtml = `
          <div class="msg-media-container" style="padding: 4px 2px;">
            ${badgeHtml}
            <audio class="msg-audio-player" src="${resolvedMediaUrl}" controls playsinline preload="metadata"></audio>
          </div>
        `;
      } else if (isVideo) {
        const isLiveCamera = msg.mediaSource === 'camera';
        const badgeIcon = isLiveCamera ? '📷' : '🎥';
        const badgeText = isLiveCamera ? 'Jonli kamera' : 'Galereyadan';
        const badgeClass = isLiveCamera ? 'camera' : 'gallery';

        const badgeHtml = `
          <div class="media-source-tag ${badgeClass}">
            <span>${badgeIcon}</span>
            <span>${badgeText}</span>
          </div>
        `;
        mediaHtml = `
          <div class="msg-media-container">
            ${badgeHtml}
            <video class="msg-media-video" src="${resolvedMediaUrl}" controls playsinline preload="metadata"></video>
          </div>
        `;
      } else if (isFile) {
        fileName = (msg.text && msg.text.trim()) || (msg.mediaUrl.split('/').pop() || 'hujjat');
        const ext = ((fileName || '').split('.').pop() || '').toLowerCase();
        let fileIcon = '📁';
        if (ext === 'pdf') fileIcon = '📕';
        else if (['doc', 'docx', 'rtf'].includes(ext)) fileIcon = '📘';
        else if (['xls', 'xlsx', 'csv'].includes(ext)) fileIcon = '📗';
        else if (['ppt', 'pptx'].includes(ext)) fileIcon = '📙';
        else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) fileIcon = '📦';
        else if (ext === 'apk') fileIcon = '🤖';
        else if (['txt', 'json', 'xml', 'md'].includes(ext)) fileIcon = '📝';

        const sizeStr = formatFileSize(msg.mediaSize);
        const rawDownloadPath = msg.mediaUrl.startsWith('/uploads/') ? '/api/chat/download/' + msg.mediaUrl.replace('/uploads/', '') + '?name=' + encodeURIComponent(fileName) : msg.mediaUrl;
        const secureDownloadUrl = (typeof window.resolveMediaUrl === 'function') ? window.resolveMediaUrl(rawDownloadPath) : rawDownloadPath;

        mediaHtml = `
          <div class="msg-media-container" style="padding: 2px 0;">
            <a href="${secureDownloadUrl}" target="_blank" download="${escapeHtml(fileName)}" class="msg-file-card">
              <div class="file-icon-box">${fileIcon}</div>
              <div class="file-meta-box">
                <div class="file-display-name" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</div>
                <div class="file-size-info">${sizeStr} · Xavfsiz yuklab olish ⬇️</div>
              </div>
            </a>
          </div>
        `;
      } else {
        const isLiveCamera = msg.mediaSource === 'camera';
        const badgeIcon = isLiveCamera ? '📷' : '🖼️';
        const badgeText = isLiveCamera ? 'Jonli kamera' : 'Galereyadan';
        const badgeClass = isLiveCamera ? 'camera' : 'gallery';

        const badgeHtml = `
          <div class="media-source-tag ${badgeClass}">
            <span>${badgeIcon}</span>
            <span>${badgeText}</span>
          </div>
        `;
        mediaHtml = `
          <div class="msg-media-container">
            ${badgeHtml}
            <img class="msg-media-image" src="${resolvedMediaUrl}" alt="Rasm" onclick="Chat.openMediaLightbox('${resolvedMediaUrl}')">
          </div>
        `;
      }
    }

    const row = document.createElement('div');
    row.id = `msg-row-${msg.id}`;
    row.className = `message-row ${isOutgoing ? 'outgoing' : 'incoming'}`;

    const isFileWithSameText = isFile && msg.text && (msg.text.trim() === fileName.trim() || msg.text.trim() === ((msg.mediaUrl || '').split('/').pop() || ''));
    const showText = Boolean(msg.text && !isFileWithSameText);
    const isPureVideoNote = isVideoNote && !showText;

    row.innerHTML = `
      <div class="msg-bubble-wrap">
        <div class="message-bubble ${isPureVideoNote ? 'is-video-note' : ''}" data-msg-id="${msg.id}">
          ${mediaHtml}
          ${showText ? `<div class="msg-text">${escapeHtml(msg.text)}</div>` : ''}
          <div class="msg-footer">
            <span>${timeFormatted}</span>
            ${isOutgoing ? `<span class="msg-status-check" style="${msg.status === 'read' ? 'color:#38bdf8;' : ''}">${msg.status === 'read' ? '✓✓' : '✓'}</span>` : ''}
          </div>
        </div>
        <button type="button" class="msg-delete-btn" title="Xabarni o'chirish" onclick="event.stopPropagation(); Chat.promptDeleteMessage(${msg.id}, ${Boolean(isOutgoing)})">
          🗑️
        </button>
      </div>
    `;

    container.appendChild(row);
  }

  function formatFileSize(bytes) {
    if (!bytes || isNaN(bytes) || bytes <= 0) return 'Hujjat';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function scrollToBottom() {
    const container = document.getElementById('messages-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function goBackToDashboard() {
    loadConversations();
    if (typeof App !== 'undefined' && App.switchToView) {
      App.switchToView('chat-dashboard');
    }
  }

  function openCameraActionSheet() {
    const modal = document.getElementById('camera-action-modal');
    if (modal) modal.classList.add('open');
  }

  function closeCameraActionSheet() {
    const modal = document.getElementById('camera-action-modal');
    if (modal) modal.classList.remove('open');
  }

  function triggerGalleryUpload() {
    if (typeof App !== 'undefined' && App.setMediaPickingActive) {
      App.setMediaPickingActive(true);
    }
    const input = document.getElementById('media-gallery-input');
    if (input) input.click();
  }

  function triggerDocumentUpload() {
    if (typeof App !== 'undefined' && App.setMediaPickingActive) {
      App.setMediaPickingActive(true);
    }
    const input = document.getElementById('media-doc-input');
    if (input) input.click();
  }

  // -------------------------------------------------------------
  // MESSAGE DELETION CONTROLLER (FOR ME & FOR EVERYONE)
  // -------------------------------------------------------------
  let pendingDeleteTarget = null;

  function promptDeleteMessage(messageId, isOutgoing) {
    pendingDeleteTarget = { id: messageId, isOutgoing };

    const modal = document.getElementById('delete-message-modal');
    const btnForEveryone = document.getElementById('btn-delete-for-everyone');

    if (btnForEveryone) {
      // If outgoing, allow both options; if incoming, only delete for me
      if (isOutgoing) {
        btnForEveryone.style.display = 'flex';
      } else {
        btnForEveryone.style.display = 'none';
      }
    }

    if (modal) modal.classList.add('open');
  }

  function closeDeleteModal() {
    const modal = document.getElementById('delete-message-modal');
    if (modal) modal.classList.remove('open');
    pendingDeleteTarget = null;
  }

  function removeMessageFromUI(messageId) {
    const row = document.getElementById(`msg-row-${messageId}`);
    if (row) {
      row.classList.add('deleting');
      setTimeout(() => {
        row.remove();
        const container = document.getElementById('messages-container');
        if (container && container.children.length === 0) {
          container.innerHTML = '<div class="empty-state">Hozircha xabarlar yo\'q</div>';
        }
      }, 300);
    }
  }

  async function confirmDeleteMessage(mode) {
    if (!pendingDeleteTarget) return;
    const msgId = pendingDeleteTarget.id;
    const convId = activeConversation ? activeConversation.id : null;
    closeDeleteModal();

    // Instant local removal
    removeMessageFromUI(msgId);

    // 1. Socket emit for real-time synchronization
    if (socket && socket.connected) {
      socket.emit('delete_message', { messageId: msgId, conversationId: convId, mode });
    }

    // 2. HTTP DELETE as guaranteed backup
    const token = Auth.getToken();
    try {
      await fetch(`/api/chat/messages/${msgId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ mode })
      });
      loadConversations();
    } catch (_) {}

    App.showToast(mode === 'for_everyone' ? 'Xabar ikki taraf uchun o\'chirildi ✓' : 'Xabar faqat siz uchun o\'chirildi ✓');
  }

  return {
    init,
    connectSocket,
    disconnectSocket,
    loadConversations,
    searchUsers,
    startChatWithUser,
    openDialog,
    openMediaLightbox,
    restoreActiveConversation,
    switchDashboardTab,
    goBackToDashboard,
    openCameraActionSheet,
    closeCameraActionSheet,
    openAttachmentMenu,
    closeAttachmentMenu,
    pickGallery,
    pickDocument,
    pickCameraPhoto,
    pickCameraVideo,
    triggerGalleryUpload: pickGallery,
    triggerDocumentUpload: pickDocument,
    toggleMediaNoteMode,
    startVoiceRecording,
    cancelVoiceRecording,
    finishAndSendVoiceRecording,
    startRoundVideoRecording,
    stopAndSendRoundVideo,
    cancelRoundVideo,
    flipRoundVideoCamera,
    toggleRoundVideo,
    updateInputButtons,
    promptDeleteMessage,
    closeDeleteModal,
    confirmDeleteMessage,
    removeMessageFromUI
  };
})();

window.Chat = Chat;
