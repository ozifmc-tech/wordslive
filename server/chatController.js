const { stmts, getConversationId } = require('./db');

// 1. Search users by @nik or name
function searchUsers(req, res) {
  try {
    let { q } = req.query;
    q = (q || '').trim().replace(/^@/, '');

    let users = [];
    if (q.length === 0) {
      // Return all other registered users so they are easily discoverable!
      users = stmts.searchUsers.all('%', '%', req.user.id);
    } else {
      const queryPattern = `%${q}%`;
      users = stmts.searchUsers.all(queryPattern, queryPattern, req.user.id);
    }

    return res.json({
      success: true,
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        avatarColor: u.avatar_color,
        avatarUrl: u.avatar_url || '',
        bio: u.bio,
        isOnline: Boolean(u.is_online),
        lastSeen: u.last_seen
      }))
    });
  } catch (err) {
    console.error('Search users xatolik:', err);
    return res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
}

// 2. Get user conversations list
function getConversations(req, res) {
  try {
    const userId = req.user.id;
    const rawConversations = stmts.getUserConversations.all({ userId });

    const conversations = rawConversations.map(c => ({
      id: c.id,
      lastMessage: c.last_message,
      lastMessageTime: c.last_message_time,
      unreadCount: c.unread_count,
      partner: {
        id: c.partner_id,
        username: c.partner_username,
        displayName: c.partner_display_name,
        avatarColor: c.partner_avatar_color,
        avatarUrl: c.partner_avatar_url || '',
        isOnline: Boolean(c.partner_is_online),
        lastSeen: c.partner_last_seen
      }
    }));

    return res.json({ success: true, conversations });
  } catch (err) {
    console.error('Get conversations xatolik:', err);
    return res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
}

// 3. Start or get conversation with user
function getOrCreateConversation(req, res) {
  try {
    let { partnerId, partnerUsername } = req.body;
    let partner = null;

    if (partnerId) {
      partner = stmts.getUserById.get(parseInt(partnerId, 10));
    } else if (partnerUsername) {
      partnerUsername = partnerUsername.trim().toLowerCase().replace(/^@/, '');
      partner = stmts.getUserByUsername.get(partnerUsername);
    }

    if (!partner) {
      return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
    }

    if (partner.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'O\'zingiz bilan chat ocholmaysiz' });
    }

    const convId = getConversationId(req.user.id, partner.id);
    let conv = stmts.getConversationById.get(convId);

    if (!conv) {
      const now = Date.now();
      stmts.createConversation.run(convId, Math.min(req.user.id, partner.id), Math.max(req.user.id, partner.id), '', now, now);
      conv = stmts.getConversationById.get(convId);
    }

    return res.json({
      success: true,
      conversation: {
        id: conv.id,
        lastMessage: conv.last_message,
        lastMessageTime: conv.last_message_time,
        partner: {
          id: partner.id,
          username: partner.username,
          displayName: partner.display_name,
          avatarColor: partner.avatar_color,
          avatarUrl: partner.avatar_url || '',
          bio: partner.bio,
          isOnline: Boolean(partner.is_online),
          lastSeen: partner.last_seen
        }
      }
    });
  } catch (err) {
    console.error('Start conversation xatolik:', err);
    return res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
}

// 4. Get message history for conversation
function getMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conv = stmts.getConversationById.get(conversationId);
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Chat topilmadi' });
    }

    // Security check: ensure user is participant in conversation
    if (conv.user1_id !== userId && conv.user2_id !== userId) {
      return res.status(403).json({ success: false, message: 'Siz bu chat a\'zosi emassiz' });
    }

    // Mark messages sent to this user as read
    stmts.markMessagesAsRead.run(conversationId, userId);

    const messages = stmts.getMessagesByConversation.all(conversationId, userId, userId);

    return res.json({
      success: true,
      messages: messages.map(m => ({
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        receiverId: m.receiverId,
        text: m.text,
        status: m.status,
        mediaUrl: m.mediaUrl || '',
        mediaType: m.mediaType || '',
        mediaSource: m.mediaSource || '',
        mediaSize: m.mediaSize || 0,
        createdAt: m.createdAt
      }))
    });
  } catch (err) {
    console.error('Get messages xatolik:', err);
    return res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
}

// 5. Send message via HTTP REST (in addition to Socket.io)
function sendMessageHttp(req, res) {
  try {
    const { conversationId } = req.params;
    const { text, mediaUrl, mediaType, mediaSource, mediaSize } = req.body;
    const senderId = req.user.id;

    if ((!text || !text.trim()) && !mediaUrl) {
      return res.status(400).json({ success: false, message: 'Xabar matni yoki media kiritilishi shart' });
    }

    const conv = stmts.getConversationById.get(conversationId);
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Chat topilmadi' });
    }

    if (conv.user1_id !== senderId && conv.user2_id !== senderId) {
      return res.status(403).json({ success: false, message: 'Siz bu chat a\'zosi emassiz' });
    }

    const receiverId = conv.user1_id === senderId ? conv.user2_id : conv.user1_id;
    const now = Date.now();
    const cleanText = (text || '').trim();
    const lastMsgDisplay = cleanText || (mediaType === 'audio' ? '🎙️ Ovozli xabar' : (mediaType === 'video' ? '🎥 Video' : (mediaType === 'file' ? '📁 Fayl' : '📷 Rasm')));

    const insertResult = stmts.saveMessage.run(
      conversationId, 
      senderId, 
      receiverId, 
      cleanText, 
      'sent', 
      mediaUrl || '', 
      mediaType || '', 
      mediaSource || '', 
      mediaSize || 0, 
      now
    );
    stmts.updateConversationLastMessage.run(lastMsgDisplay, now, conversationId);

    return res.status(201).json({
      success: true,
      message: {
        id: insertResult.lastInsertRowid,
        conversationId,
        senderId,
        receiverId,
        text: cleanText,
        status: 'sent',
        mediaUrl: mediaUrl || '',
        mediaType: mediaType || '',
        mediaSource: mediaSource || '',
        mediaSize: mediaSize || 0,
        createdAt: now
      }
    });
  } catch (err) {
    console.error('Send message HTTP xatolik:', err);
    return res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
}

// 6. Delete message (Delete for me / Delete for both sides)
function deleteMessage(req, res) {
  try {
    const messageId = parseInt(req.params.messageId, 10);
    const { mode } = req.body; // 'for_me' or 'for_everyone'
    const userId = req.user.id;

    const msg = stmts.getMessageById.get(messageId);
    if (!msg) {
      return res.status(404).json({ success: false, message: 'Xabar topilmadi' });
    }

    const conv = stmts.getConversationById.get(msg.conversationId);
    if (!conv || (conv.user1_id !== userId && conv.user2_id !== userId)) {
      return res.status(403).json({ success: false, message: 'Siz ushbu chat a\'zosi emassiz' });
    }

    if (mode === 'for_everyone') {
      stmts.deleteMessageForAll.run(messageId);
    } else {
      if (msg.senderId === userId) {
        stmts.deleteMessageForSender.run(messageId);
      } else {
        stmts.deleteMessageForReceiver.run(messageId);
      }
    }

    // Update conversation last message preview
    const latest = stmts.getLatestMessageForConversation.get(msg.conversationId);
    if (latest) {
      let preview = latest.text;
      if (!preview) {
        preview = latest.mediaType === 'audio' ? '🎙️ Ovozli xabar' : (latest.mediaType === 'video' ? '🎥 Video' : (latest.mediaType === 'file' ? '📁 Fayl' : '📷 Rasm'));
      }
      stmts.updateConversationLastMessage.run(preview, latest.createdAt, msg.conversationId);
    } else {
      stmts.updateConversationLastMessage.run('', Date.now(), msg.conversationId);
    }

    return res.json({
      success: true,
      messageId,
      conversationId: msg.conversationId,
      mode: mode || 'for_me'
    });
  } catch (err) {
    console.error('Delete message xatolik:', err);
    return res.status(500).json({ success: false, message: 'Server xatoligi' });
  }
}

module.exports = {
  searchUsers,
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessageHttp,
  deleteMessage
};
