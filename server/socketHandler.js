const jwt = require('jsonwebtoken');
const config = require('./config');
const { stmts } = require('./db');

function setupSocketIO(io) {
  // Socket.io JWT Authentication Middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Autentifikatsiya talab qilinadi'));
      }

      const decoded = jwt.verify(token, config.JWT_SECRET);
      const user = stmts.getUserById.get(decoded.userId);
      if (!user) {
        return next(new Error('Foydalanuvchi topilmadi'));
      }
      if (decoded.tokenVersion !== undefined && user.token_version !== undefined && decoded.tokenVersion !== user.token_version) {
        return next(new Error('Sessiya bekor qilingan yoki parol yangilangan'));
      }

      // Check device session in DB
      if (decoded.sessionId) {
        const session = stmts.getSessionById.get(decoded.sessionId);
        if (!session || session.revoked === 1) {
          return next(new Error('SESSION_REVOKED'));
        }
        socket.sessionId = decoded.sessionId;
      }

      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('Yaroqsiz token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    const userRoom = `user_${user.id}`;
    socket.join(userRoom);

    // Update online status in DB and broadcast
    const now = Date.now();
    stmts.updateUserStatus.run(1, now, user.id);
    io.emit('user_status_changed', { userId: user.id, isOnline: true, lastSeen: now });

    // Join conversation room
    socket.on('join_conversation', ({ conversationId }, ack) => {
      if (!conversationId) return;
      socket.join(`conv_${conversationId}`);
      if (typeof ack === 'function') ack({ success: true });
    });

    // Leave conversation room
    socket.on('leave_conversation', ({ conversationId }, ack) => {
      if (!conversationId) return;
      socket.leave(`conv_${conversationId}`);
      if (typeof ack === 'function') ack({ success: true });
    });

    // Send real-time message (Text, Photos, Videos up to 200MB, Live Camera)
    socket.on('send_message', ({ conversationId, text, mediaUrl, mediaType, mediaSource, mediaSize }, ack) => {
      try {
        const cleanText = (text || '').trim();
        if (!conversationId || (!cleanText && !mediaUrl)) {
          if (typeof ack === 'function') ack({ success: false, error: 'Xabar yoki media bo\'sh' });
          return;
        }

        const conv = stmts.getConversationById.get(conversationId);
        if (!conv) {
          if (typeof ack === 'function') ack({ success: false, error: 'Chat topilmadi' });
          return;
        }

        if (conv.user1_id !== user.id && conv.user2_id !== user.id) {
          if (typeof ack === 'function') ack({ success: false, error: 'Ruxsat berilmagan' });
          return;
        }

        const receiverId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
        const msgTime = Date.now();
        const lastMsgDisplay = cleanText || (mediaType === 'video_note' ? '⭕ Dumaloq video' : (mediaType === 'audio' ? '🎙️ Ovozli xabar' : (mediaType === 'video' ? '🎥 Video' : (mediaType === 'file' ? '📁 Fayl' : '📷 Rasm'))));

        // Save to SQLite
        const insertResult = stmts.saveMessage.run(
          conversationId, 
          user.id, 
          receiverId, 
          cleanText, 
          'sent', 
          mediaUrl || '', 
          mediaType || '', 
          mediaSource || '', 
          mediaSize || 0, 
          msgTime
        );
        stmts.updateConversationLastMessage.run(lastMsgDisplay, msgTime, conversationId);

        const newMsg = {
          id: insertResult.lastInsertRowid,
          conversationId,
          senderId: user.id,
          receiverId,
          text: cleanText,
          status: 'sent',
          mediaUrl: mediaUrl || '',
          mediaType: mediaType || '',
          mediaSource: mediaSource || '',
          mediaSize: mediaSize || 0,
          createdAt: msgTime
        };

        // Emit to conversation room and receiver room (Socket.io automatically deduplicates)
        io.to(`conv_${conversationId}`).to(`user_${receiverId}`).emit('new_message', newMsg);

        // Also notify user personal rooms to update conversation list preview
        const convUpdate = {
          conversationId,
          lastMessage: lastMsgDisplay,
          lastMessageTime: msgTime,
          senderId: user.id
        };
        io.to(`user_${user.id}`).to(`user_${receiverId}`).emit('conversation_updated', convUpdate);

        if (typeof ack === 'function') {
          ack({ success: true, message: newMsg });
        }
      } catch (err) {
        console.error('Socket send_message error:', err);
        if (typeof ack === 'function') ack({ success: false, error: 'Xabar yuborishda xatolik' });
      }
    });

    // Typing indicators
    socket.on('typing', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conv_${conversationId}`).emit('user_typing', {
        userId: user.id,
        username: user.username,
        displayName: user.display_name,
        conversationId
      });
    });

    socket.on('stop_typing', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conv_${conversationId}`).emit('user_stop_typing', {
        userId: user.id,
        conversationId
      });
    });

    // Mark messages as read
    socket.on('mark_as_read', ({ conversationId }) => {
      if (!conversationId) return;
      stmts.markMessagesAsRead.run(conversationId, user.id);
      io.to(`conv_${conversationId}`).emit('messages_read', {
        conversationId,
        readerId: user.id
      });
    });

    // Real-time Delete Message (mode: 'for_me' or 'for_everyone')
    socket.on('delete_message', ({ messageId, conversationId, mode }, ack) => {
      try {
        if (!messageId) {
          if (typeof ack === 'function') ack({ success: false, error: 'Xabar ID ko\'rsatilmadi' });
          return;
        }

        const msg = stmts.getMessageById.get(messageId);
        if (!msg) {
          if (typeof ack === 'function') ack({ success: false, error: 'Xabar topilmadi' });
          return;
        }

        const convId = conversationId || msg.conversationId;
        const conv = stmts.getConversationById.get(convId);
        if (!conv || (conv.user1_id !== user.id && conv.user2_id !== user.id)) {
          if (typeof ack === 'function') ack({ success: false, error: 'Ruxsat yo\'q' });
          return;
        }

        if (mode === 'for_everyone') {
          stmts.deleteMessageForAll.run(messageId);
          // Broadcast deletion to all conversation participants in real-time
          io.to(`conv_${convId}`).emit('message_deleted', {
            messageId,
            conversationId: convId,
            mode: 'for_everyone',
            deletedBy: user.id
          });
        } else {
          // Delete for current user only
          if (msg.senderId === user.id) {
            stmts.deleteMessageForSender.run(messageId);
          } else {
            stmts.deleteMessageForReceiver.run(messageId);
          }
          // Only notify current user
          socket.emit('message_deleted', {
            messageId,
            conversationId: convId,
            mode: 'for_me',
            deletedBy: user.id
          });
        }

        // Update conversation last message preview
        const latest = stmts.getLatestMessageForConversation.get(convId);
        if (latest) {
          let preview = latest.text;
          if (!preview) {
            preview = latest.mediaType === 'audio' ? '🎙️ Ovozli xabar' : (latest.mediaType === 'video' ? '🎥 Video' : (latest.mediaType === 'file' ? '📁 Fayl' : '📷 Rasm'));
          }
          stmts.updateConversationLastMessage.run(preview, latest.createdAt, convId);
        } else {
          stmts.updateConversationLastMessage.run('', Date.now(), convId);
        }

        if (typeof ack === 'function') ack({ success: true, messageId, mode });
      } catch (err) {
        console.error('Socket delete_message error:', err);
        if (typeof ack === 'function') ack({ success: false, error: 'Server xatoligi' });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      const disconnectTime = Date.now();
      stmts.updateUserStatus.run(0, disconnectTime, user.id);
      io.emit('user_status_changed', { userId: user.id, isOnline: false, lastSeen: disconnectTime });
    });
  });
}

module.exports = { setupSocketIO };
