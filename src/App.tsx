import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  addDoc, 
  serverTimestamp, 
  onSnapshot, 
  doc, 
  getDoc, 
  getDocFromServer,
  setDoc, 
  where, 
  getDocs,
  Timestamp,
  deleteDoc,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth, db, storage, signIn, logOut } from './firebase';
import { format } from 'date-fns';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import { 
  Send, 
  LogOut, 
  UserPlus, 
  MessageSquare, 
  Users, 
  ShieldCheck, 
  ShieldAlert,
  AlertCircle,
  Loader2,
  Trash2,
  Image as ImageIcon,
  Video,
  Smile,
  Reply,
  X,
  Paperclip,
  CheckCircle2,
  Check,
  CheckCheck,
  Copy,
  Mail,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  VideoOff,
  Maximize2,
  Minimize2,
  Menu
} from 'lucide-react';

// Polyfill for simple-peer
if (typeof window !== 'undefined') {
  (window as any).global = window;
}
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import EmojiPicker from 'emoji-picker-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ThreadedMessage extends Message {
  replies?: ThreadedMessage[];
}

interface MessageItemProps {
  msg: ThreadedMessage, 
  replies?: ThreadedMessage[], 
  profile: UserProfile, 
  members: UserProfile[],
  toggleReaction: (id: string, emoji: string) => void,
  setShowReactionPicker: (id: string | null) => void,
  showReactionPicker: string | null,
  setReplyTo: (msg: Message) => void,
  deleteMessage: (id: string) => void
}

const MessageItem: React.FC<MessageItemProps> = ({ msg, replies, profile, members, toggleReaction, setShowReactionPicker, showReactionPicker, setReplyTo, deleteMessage }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn(
      "flex flex-col gap-2 max-w-[85%] md:max-w-[70%] group",
      msg.senderId === profile.uid ? "ml-auto" : ""
    )}
  >
    <div className={cn(
      "flex gap-3",
      msg.senderId === profile.uid ? "flex-row-reverse" : ""
    )}>
      <div className="relative shrink-0 mt-1">
        <img src={msg.senderPhoto} alt={msg.senderName} className="w-8 h-8 rounded-full border border-neutral-200" />
        {members.find(m => m.uid === msg.senderId)?.status === 'online' && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
        )}
      </div>
      <div className={cn(
        "space-y-1",
        msg.senderId === profile.uid ? "items-end flex flex-col" : ""
      )}>
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] font-black text-neutral-500 uppercase tracking-tighter">{msg.senderName}</span>
          <span className="text-[10px] text-neutral-400 font-mono">
            {msg.createdAt ? format(msg.createdAt.toDate(), 'MMM d, yyyy HH:mm:ss') : '...'}
          </span>
          {msg.senderId === profile.uid && (
            <div className="flex items-center ml-1">
              {msg.readBy && msg.readBy.length > 1 ? (
                <CheckCheck className="w-3 h-3 text-blue-500" />
              ) : (
                <Check className="w-3 h-3 text-neutral-400" />
              )}
            </div>
          )}
        </div>

        <div className={cn(
          "relative p-4 rounded-2xl text-sm leading-relaxed shadow-sm group/bubble",
          msg.senderId === profile.uid 
            ? "bg-neutral-900 text-white rounded-tr-none" 
            : "bg-white text-neutral-800 rounded-tl-none border border-neutral-200"
        )}>
          {/* Media Content - Single or Gallery */}
          {(msg.mediaUrl || (msg.mediaItems && msg.mediaItems.length > 0)) && (
            <div className={cn(
              "mb-3 rounded-xl overflow-hidden border border-neutral-100/10",
              msg.mediaItems && msg.mediaItems.length > 1 ? "grid grid-cols-2 gap-1" : ""
            )}>
              {/* Legacy single media support */}
              {msg.mediaUrl && !msg.mediaItems && (
                <div className="relative group/media">
                  {msg.mediaType === 'image' || msg.mediaType === 'gif' ? (
                    <img src={msg.mediaUrl} alt="Media" className="max-w-full h-auto object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <video src={msg.mediaUrl} controls preload="metadata" className="max-w-full bg-black" />
                  )}
                </div>
              )}
              
              {/* Gallery support */}
              {msg.mediaItems && msg.mediaItems.map((item, idx) => (
                <div key={idx} className={cn(
                  "relative group/media overflow-hidden",
                  msg.mediaItems!.length === 3 && idx === 0 ? "col-span-2 aspect-video" : "aspect-square"
                )}>
                  {item.type === 'image' || item.type === 'gif' ? (
                    <img src={item.url} alt={`Media ${idx}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                  ) : (
                    <video src={item.url} controls preload="metadata" className="w-full h-full object-cover bg-black" />
                  )}
                </div>
              ))}
            </div>
          )}
          
          {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}

          {/* Read Receipts for Group/DMs */}
          {msg.senderId === profile.uid && msg.readBy && msg.readBy.length > 1 && (
            <div className={cn(
              "flex items-center gap-1 mt-2 pt-1 border-t border-white/10",
              msg.senderId === profile.uid ? "justify-end" : "justify-start"
            )}>
              <div className="flex -space-x-1.5">
                {msg.readBy.filter(uid => uid !== profile.uid).slice(0, 5).map(uid => {
                  const reader = members.find(m => m.uid === uid);
                  return reader ? (
                    <img 
                      key={uid} 
                      src={reader.photoURL} 
                      alt={reader.displayName} 
                      title={`Read by ${reader.displayName}`}
                      className="w-3.5 h-3.5 rounded-full border border-neutral-900 ring-1 ring-white/20"
                    />
                  ) : null;
                })}
                {msg.readBy.length > 6 && (
                  <div className="w-3.5 h-3.5 rounded-full bg-neutral-800 border border-neutral-900 flex items-center justify-center text-[6px] font-bold text-white">
                    +{msg.readBy.length - 6}
                  </div>
                )}
              </div>
              <span className="text-[8px] text-neutral-400 font-medium uppercase tracking-widest">Seen</span>
            </div>
          )}

          {/* Reactions Display */}
          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
            <div className={cn(
              "flex flex-wrap gap-1 mt-2",
              msg.senderId === profile.uid ? "justify-end" : "justify-start"
            )}>
              {Object.entries(msg.reactions).map(([emoji, users]) => {
                const reactionUsers = users as string[];
                return (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction(msg.id, emoji)}
                    className={cn(
                      "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-all",
                      reactionUsers.includes(profile.uid)
                        ? "bg-neutral-900 text-white border-neutral-900"
                        : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
                    )}
                  >
                    <span>{emoji}</span>
                    <span className="font-mono font-bold">{reactionUsers.length}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Message Actions */}
          <div className={cn(
            "absolute top-0 opacity-0 group-hover/bubble:opacity-100 transition-all flex gap-1 z-20",
            msg.senderId === profile.uid ? "-left-16" : "-right-16"
          )}>
            <button 
              onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
              className="p-1.5 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 text-neutral-500 shadow-sm"
            >
              <Smile className="w-3 h-3" />
            </button>
            <div className="flex gap-1">
              {['👍', '❤️', '😂', '😮'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(msg.id, emoji)}
                  className="p-1.5 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 shadow-sm text-[10px]"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setReplyTo(msg)}
              className="p-1.5 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 text-neutral-500 shadow-sm"
            >
              <Reply className="w-3 h-3" />
            </button>
            {msg.senderId === profile.uid && (
              <button 
                onClick={() => deleteMessage(msg.id)}
                className="p-1.5 bg-white border border-neutral-200 rounded-lg hover:bg-red-50 text-neutral-500 hover:text-red-500 shadow-sm"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    {/* Replies */}
    {replies && replies.length > 0 && (
      <div className="ml-12 space-y-2 border-l-2 border-neutral-200 pl-4 mt-2">
        {replies.map(reply => (
          <MessageItem 
            key={reply.id} 
            msg={reply} 
            replies={reply.replies} 
            profile={profile} 
            members={members} 
            toggleReaction={toggleReaction} 
            setShowReactionPicker={setShowReactionPicker} 
            showReactionPicker={showReactionPicker} 
            setReplyTo={setReplyTo} 
            deleteMessage={deleteMessage} 
          />
        ))}
      </div>
    )}
  </motion.div>
);
interface MediaItem {
  url: string;
  type: 'image' | 'video' | 'gif';
}

interface Message {
  id: string;
  text?: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'gif';
  mediaItems?: MediaItem[];
  replyToId?: string;
  replyToText?: string;
  replyToSenderName?: string;
  readBy?: string[];
  reactions?: Record<string, string[]>;
  createdAt: Timestamp;
}

interface DirectMessage {
  id: string;
  text?: string;
  senderId: string;
  receiverId: string;
  participants: string[];
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'gif';
  mediaItems?: MediaItem[];
  readBy?: string[];
  reactions?: Record<string, string[]>;
  createdAt: Timestamp;
}

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  isMember: boolean;
  isAdmin?: boolean;
  invitedBy?: string;
  createdAt: Timestamp;
  status?: 'online' | 'offline';
  lastSeen?: Timestamp;
  notificationSettings?: {
    soundEnabled: boolean;
    desktopEnabled: boolean;
  };
}

interface Invite {
  id: string;
  email?: string;
  invitedBy: string;
  invitedByName: string;
  status: 'pending' | 'accepted';
  createdAt: Timestamp;
}

// --- Components ---

export default function App() {
  const [user, loading, error] = useAuthState(auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isCheckingMembership, setIsCheckingMembership] = useState(true);
  const [pendingInvite, setPendingInvite] = useState<Invite | null>(null);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const [inviteFromUrl, setInviteFromUrl] = useState<Invite | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteId = params.get('inviteId');
    if (inviteId) {
      getDoc(doc(db, 'invites', inviteId)).then(docSnap => {
        if (docSnap.exists() && docSnap.data().status === 'pending') {
          setInviteFromUrl({ id: docSnap.id, ...docSnap.data() } as Invite);
        }
      }).catch(err => console.error("Error fetching invite from URL:", err));
    }
  }, []);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    if (user) {
      checkMembership(user.uid, user.email || '');
    } else {
      setProfile(null);
      setIsCheckingMembership(false);
    }
  }, [user]);

  // Presence Logic
  useEffect(() => {
    if (user && profile) {
      const userRef = doc(db, 'users', user.uid);
      
      const updateStatus = (status: 'online' | 'offline') => {
        setDoc(userRef, { 
          status, 
          lastSeen: serverTimestamp() 
        }, { merge: true }).catch(err => console.error("Error updating status:", err));
      };

      updateStatus('online');

      const handleVisibilityChange = () => {
        updateStatus(document.visibilityState === 'visible' ? 'online' : 'offline');
      };

      const handleBeforeUnload = () => {
        updateStatus('offline');
      };

      window.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        updateStatus('offline');
        window.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [user?.uid, !!profile]);

  const checkMembership = async (uid: string, email: string) => {
    setIsCheckingMembership(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data() as UserProfile;
        // Automatically set isAdmin if user matches bootstrap email
        if (email === "jamenya1988@gmail.com" && !data.isAdmin) {
          const updatedProfile = { ...data, isAdmin: true };
          await setDoc(doc(db, 'users', uid), updatedProfile, { merge: true });
          setProfile(updatedProfile);
        } else {
          setProfile(data);
        }
      } else {
        // Check if this is the first user ever
        const usersSnapshot = await getDocs(query(collection(db, 'users'), limit(1)));
        if (usersSnapshot.empty) {
          setIsFirstUser(true);
        } else {
          // Check for pending invite
          const inviteQuery = query(
            collection(db, 'invites'), 
            where('email', '==', email), 
            where('status', '==', 'pending'),
            limit(1)
          );
          const inviteSnapshot = await getDocs(inviteQuery);
          if (!inviteSnapshot.empty) {
            setPendingInvite({ id: inviteSnapshot.docs[0].id, ...inviteSnapshot.docs[0].data() } as Invite);
          } else if (inviteFromUrl && (!inviteFromUrl.email || inviteFromUrl.email === email)) {
            setPendingInvite(inviteFromUrl);
          }
        }
      }
    } catch (err) {
      console.error("Error checking membership:", err);
    } finally {
      setIsCheckingMembership(false);
    }
  };

  const joinAsMember = async () => {
    if (!user) return;
    
    const newProfile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Anonymous',
      photoURL: user.photoURL || '',
      isMember: true,
      isAdmin: isFirstUser,
      createdAt: Timestamp.now() as any,
    };

    if (pendingInvite) {
      newProfile.invitedBy = pendingInvite.invitedBy;
      // Mark invite as accepted
      await setDoc(doc(db, 'invites', pendingInvite.id), { status: 'accepted' }, { merge: true });
    }

    await setDoc(doc(db, 'users', user.uid), newProfile);
    setProfile(newProfile);
    setIsFirstUser(false);
    setPendingInvite(null);
  };

  if (loading || isCheckingMembership) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-100">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-600" />
      </div>
    );
  }

  if (!user) {
    return <LoginView inviteFromUrl={inviteFromUrl} />;
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-100 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto">
            {isFirstUser ? <ShieldCheck className="w-8 h-8 text-green-600" /> : <ShieldAlert className="w-8 h-8 text-amber-600" />}
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">
            {isFirstUser ? "Welcome, Founder!" : "Invite Only Access"}
          </h1>
          <p className="text-neutral-600">
            {isFirstUser 
              ? "You are the first user to access this chat. You can join as the founding member and invite others."
              : pendingInvite 
                ? `Good news! You have been invited by ${pendingInvite.invitedByName}.`
                : "This chat is restricted to invited members only. Please contact a member to get an invite."}
          </p>
          
          {(isFirstUser || pendingInvite) ? (
            <button 
              onClick={joinAsMember}
              className="w-full py-3 bg-neutral-900 text-white rounded-xl font-medium hover:bg-neutral-800 transition-colors"
            >
              Join Chat
            </button>
          ) : (
            <button 
              onClick={logOut}
              className="w-full py-3 border border-neutral-200 text-neutral-600 rounded-xl font-medium hover:bg-neutral-50 transition-colors"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    );
  }

  return <ChatView profile={profile} />;
}

function LoginView({ inviteFromUrl }: { inviteFromUrl: Invite | null }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-100 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-10 text-center space-y-8">
        <div className="space-y-2">
          <div className="w-16 h-16 bg-neutral-900 rounded-2xl flex items-center justify-center mx-auto rotate-3">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">InviteChat</h1>
          <p className="text-neutral-500">Secure, private, real-time messaging.</p>
        </div>

        {inviteFromUrl && (
          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-sm text-neutral-600 animate-in fade-in slide-in-from-top-2">
            <p className="font-bold text-neutral-900 mb-1">You've been invited!</p>
            <p>{inviteFromUrl.invitedByName} has invited you to join this private environment. Sign in with Google to accept.</p>
            {inviteFromUrl.email && <p className="mt-2 text-[10px] uppercase font-bold text-neutral-400">Invited Email: {inviteFromUrl.email}</p>}
          </div>
        )}
        
        <button 
          onClick={signIn}
          className="w-full flex items-center justify-center gap-3 py-4 bg-white border-2 border-neutral-900 text-neutral-900 rounded-xl font-bold hover:bg-neutral-900 hover:text-white transition-all duration-200 group"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 group-hover:invert" />
          Sign in with Google
        </button>
        
        <p className="text-xs text-neutral-400 uppercase tracking-widest font-semibold">
          Invite Only Environment
        </p>
      </div>
    </div>
  );
}

function ChatView({ profile }: { profile: UserProfile }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const threadedMessages: ThreadedMessage[] = useMemo(() => {
    const messageMap = new Map<string, ThreadedMessage>();
    messages.forEach(m => messageMap.set(m.id, { ...m, replies: [] }));
    
    const roots: ThreadedMessage[] = [];
    
    messages.forEach(m => {
      const msgWithReplies = messageMap.get(m.id)!;
      if (m.replyToId && messageMap.has(m.replyToId)) {
        messageMap.get(m.replyToId)!.replies!.push(msgWithReplies);
      } else {
        roots.push(msgWithReplies);
      }
    });
    
    return roots;
  }, [messages]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showView, setShowView] = useState<'messages' | 'invites' | 'profile' | 'dm'>('messages');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedDM, setSelectedDM] = useState<UserProfile | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [mediaInputs, setMediaInputs] = useState<MediaItem[]>([]);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video Call State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState<any>();
  const [callAccepted, setCallAccepted] = useState(false);
  const [idToCall, setIdToCall] = useState("");
  const [callEnded, setCallEnded] = useState(false);
  const [name, setName] = useState("");
  const [callerName, setCallerName] = useState("");
  const [callerPhoto, setCallerPhoto] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);
  const [isRinging, setIsRinging] = useState(false);
  const [showVideoOverlay, setShowVideoOverlay] = useState(false);
  const [videoQuality, setVideoQuality] = useState<'high' | 'low'>('high');
  
  // Typing Indicator State
  const [typingUsers, setTypingUsers] = useState<{ [roomId: string]: { [userId: string]: string } }>({});
  const typingTimeoutRef = useRef<any>(null);
  const lastMessageRef = useRef<Message | null>(null);

  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    
    if (lastMessageRef.current && lastMessageRef.current.id !== lastMsg.id && lastMsg.senderId !== profile.uid) {
      // New message received!
      if (profile.notificationSettings?.soundEnabled !== false) {
        const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='); // Simple beep
        audio.play().catch(console.error);
      }
      
      if (profile.notificationSettings?.desktopEnabled !== false && document.hidden) {
        if (Notification.permission === 'granted') {
          new Notification('New message from ' + lastMsg.senderName, {
            body: lastMsg.text || 'New media message',
            icon: lastMsg.senderPhoto,
          });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission();
        }
      }
    }
    lastMessageRef.current = lastMsg;
  }, [messages, profile.uid, profile.notificationSettings]);

  const myVideo = useRef<HTMLVideoElement>(null);
  const userVideo = useRef<HTMLVideoElement>(null);
  const connectionRef = useRef<any>();
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const newSocket = io(window.location.origin);
    setSocket(newSocket);

    newSocket.on("incoming-call", (data) => {
      setReceivingCall(true);
      setShowVideoOverlay(true);
      setCaller(data.from);
      setCallerName(data.name);
      setCallerPhoto(data.photo);
      setCallerSignal(data.signal);
    });

    newSocket.on("call-ended", () => {
      setCallEnded(true);
      setCallAccepted(false);
      setReceivingCall(false);
      setIsCalling(false);
      setIsRinging(false);
      setShowVideoOverlay(false);
      if (connectionRef.current) {
        connectionRef.current.destroy();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setStream(null);
      streamRef.current = null;
      if (myVideo.current) myVideo.current.srcObject = null;
      if (userVideo.current) userVideo.current.srcObject = null;
      connectionRef.current = null;
      setTimeout(() => setCallEnded(false), 2000);
    });

    newSocket.on("user-typing", (data) => {
      setTypingUsers(prev => {
        const roomId = data.to === 'general' ? 'general' : data.from;
        const roomTyping = { ...(prev[roomId] || {}) };
        if (data.isTyping) {
          roomTyping[data.from] = data.name;
        } else {
          delete roomTyping[data.from];
        }
        return { ...prev, [roomId]: roomTyping };
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (profile && socket) {
      setName(profile.displayName);
      socket.emit("identify", profile.uid);
    }
  }, [profile, socket]);

  // Clear typing state when switching views
  useEffect(() => {
    if (socket && profile) {
      // Emit stopped typing to both general and current DM just in case
      socket.emit("typing", {
        to: 'general',
        from: profile.uid,
        name: profile.displayName,
        isTyping: false
      });
      if (selectedDM) {
        socket.emit("typing", {
          to: selectedDM.uid,
          from: profile.uid,
          name: profile.displayName,
          isTyping: false
        });
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  }, [showView, selectedDM, socket, profile]);

  const handleTyping = () => {
    if (!socket || !profile) return;
    
    const to = showView === 'dm' && selectedDM ? selectedDM.uid : 'general';
    
    socket.emit("typing", {
      to,
      from: profile.uid,
      name: profile.displayName,
      isTyping: true
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing", {
        to,
        from: profile.uid,
        name: profile.displayName,
        isTyping: false
      });
    }, 2000);
  };

  const callUser = (id: string) => {
    setIsRinging(true);
    setShowVideoOverlay(true);
    setIdToCall(id);
    const constraints = videoQuality === 'high' 
      ? { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }
      : { video: { width: { ideal: 640 }, height: { ideal: 360 } }, audio: true };
    navigator.mediaDevices.getUserMedia(constraints).then((currentStream) => {
      setStream(currentStream);
      streamRef.current = currentStream;
      if (myVideo.current) {
        myVideo.current.srcObject = currentStream;
      }

      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream: currentStream,
      });

      peer.on("signal", (data) => {
        socket?.emit("call-user", {
          userToCall: id,
          signalData: data,
          from: socket.id,
          name: profile?.displayName,
          photo: profile?.photoURL,
        });
      });

      peer.on("stream", (currentStream) => {
        if (userVideo.current) {
          userVideo.current.srcObject = currentStream;
        }
      });

      socket?.on("call-accepted", (signal) => {
        setCallAccepted(true);
        setIsRinging(false);
        peer.signal(signal);
      });

      connectionRef.current = peer;
      setIsCalling(true);
    }).catch(err => {
      console.error("Error accessing media devices:", err);
      alert("Could not access camera or microphone. Please check permissions.");
      setIsRinging(false);
    });
  };

  const answerCall = () => {
    setCallAccepted(true);
    setShowVideoOverlay(true);
    const constraints = videoQuality === 'high' 
      ? { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }
      : { video: { width: { ideal: 640 }, height: { ideal: 360 } }, audio: true };
    navigator.mediaDevices.getUserMedia(constraints).then((currentStream) => {
      setStream(currentStream);
      streamRef.current = currentStream;
      if (myVideo.current) {
        myVideo.current.srcObject = currentStream;
      }

      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: currentStream,
      });

      peer.on("signal", (data) => {
        socket?.emit("answer-call", { signal: data, to: caller });
      });

      peer.on("stream", (currentStream) => {
        if (userVideo.current) {
          userVideo.current.srcObject = currentStream;
        }
      });

      peer.signal(callerSignal);
      connectionRef.current = peer;
    }).catch(err => {
      console.error("Error accessing media devices:", err);
      alert("Could not access camera or microphone. Please check permissions.");
    });
  };

  const leaveCall = () => {
    setCallEnded(true);
    setShowVideoOverlay(false);
    if (connectionRef.current) {
      connectionRef.current.destroy();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    streamRef.current = null;
    setCallAccepted(false);
    setReceivingCall(false);
    setIsCalling(false);
    setIsRinging(false);
    socket?.emit("end-call", { to: caller || idToCall });
    
    // Reset refs manually instead of reload
    if (myVideo.current) myVideo.current.srcObject = null;
    if (userVideo.current) userVideo.current.srcObject = null;
    connectionRef.current = null;
    
    setTimeout(() => setCallEnded(false), 2000);
  };

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicActive(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoActive(videoTrack.enabled);
      }
    }
  };

  useEffect(() => {
    let q;
    if (showView === 'dm' && selectedDM) {
      q = query(
        collection(db, 'directMessages'),
        where('participants', 'array-contains', profile.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
    } else {
      q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'), limit(50));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      if (showView === 'dm' && selectedDM) {
        msgs = msgs.filter(m => (m as any).participants.includes(selectedDM.uid));
      }
      setMessages(msgs.reverse());
    });
    return () => unsubscribe();
  }, [showView, selectedDM?.uid, profile.uid]);

  useEffect(() => {
    if (messages.length === 0) return;

    const collectionName = showView === 'dm' && selectedDM ? 'directMessages' : 'messages';
    const unreadMessages = messages.filter(msg => 
      msg.senderId !== profile.uid && 
      (!msg.readBy || !msg.readBy.includes(profile.uid))
    );

    unreadMessages.forEach(async (msg) => {
      try {
        const msgRef = doc(db, collectionName, msg.id);
        await updateDoc(msgRef, {
          readBy: arrayUnion(profile.uid)
        });
      } catch (err) {
        console.error("Error marking message as read:", err);
      }
    });
  }, [messages, profile.uid, showView, selectedDM?.uid]);

  useEffect(() => {
    if (!profile) return;
    let q;
    if (profile.isAdmin) {
      q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'users'), where('invitedBy', '==', profile.uid), orderBy('createdAt', 'desc'));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const membersList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setMembers(membersList);
    }, (error) => {
      console.error("Error fetching members:", error);
    });
    return () => unsubscribe();
  }, [profile?.isAdmin, profile?.uid]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showView]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && mediaInputs.length === 0) return;

    const text = newMessage;
    const media = mediaInputs;
    const reply = replyTo;
    const currentView = showView;
    const currentDM = selectedDM;

    setNewMessage('');
    setReplyTo(null);
    setMediaInputs([]);
    
    // Clear typing state
    if (socket && profile) {
      const to = showView === 'dm' && selectedDM ? selectedDM.uid : 'general';
      socket.emit("typing", {
        to,
        from: profile.uid,
        name: profile.displayName,
        isTyping: false
      });
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }

    const collectionName = currentView === 'dm' && currentDM ? 'directMessages' : 'messages';
    const messageData: any = {
      ...(text && { text }),
      senderId: profile.uid,
      senderName: profile.displayName,
      senderPhoto: profile.photoURL,
      createdAt: serverTimestamp(),
      readBy: [profile.uid],
      ...(media.length > 0 && { 
        mediaItems: media,
        // For backward compatibility
        mediaUrl: media[0].url,
        mediaType: media[0].type
      }),
    };

    if (currentView === 'dm' && currentDM) {
      messageData.receiverId = currentDM.uid;
      messageData.participants = [profile.uid, currentDM.uid].sort();
    } else if (reply) {
      messageData.replyToId = reply.id;
      messageData.replyToText = reply.text || (reply.mediaUrl ? `Media: ${reply.mediaType}` : '');
      messageData.replyToSenderName = reply.senderName;
    }

    try {
      await addDoc(collection(db, collectionName), messageData);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const deleteMessage = async (id: string) => {
    const collectionName = showView === 'dm' && selectedDM ? 'directMessages' : 'messages';
    await deleteDoc(doc(db, collectionName, id));
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    const collectionName = showView === 'dm' && selectedDM ? 'directMessages' : 'messages';
    const msgRef = doc(db, collectionName, messageId);
    const msg = messages.find(m => m.id === messageId);
    
    if (!msg) return;

    const currentReactions = msg.reactions || {};
    const users = currentReactions[emoji] || [];
    
    let newUsers;
    if (users.includes(profile.uid)) {
      newUsers = users.filter(uid => uid !== profile.uid);
    } else {
      newUsers = [...users, profile.uid];
    }

    const newReactions = { ...currentReactions };
    if (newUsers.length === 0) {
      delete newReactions[emoji];
    } else {
      newReactions[emoji] = newUsers;
    }

    try {
      await updateDoc(msgRef, { reactions: newReactions });
      setShowReactionPicker(null);
    } catch (err) {
      console.error("Error toggling reaction:", err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validate file type
    let type: 'image' | 'video' | 'gif' = 'image';
    if (file.type.startsWith('image/')) {
      type = file.type === 'image/gif' ? 'gif' : 'image';
    } else if (file.type.startsWith('video/')) {
      type = 'video';
    } else {
      setUploadError("Unsupported file type. Please upload images, GIFs, or videos.");
      return;
    }

    // Validate file size (e.g., 20MB limit)
    if (file.size > 20 * 1024 * 1024) {
      setUploadError("File is too large. Max size is 20MB.");
      return;
    }

    const storageRef = ref(storage, `chat_media/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      }, 
      (error) => {
        console.error("Upload error:", error);
        setUploadError("Upload failed. Please try again.");
        setUploadProgress(null);
      }, 
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setMediaInputs(prev => [...prev, { url: downloadURL, type }]);
        setUploadProgress(null);
        setShowMediaMenu(false);
      }
    );
  };

  return (
    <div className="flex h-screen bg-neutral-50 font-sans text-neutral-900">
      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-neutral-200 flex flex-col transition-transform duration-300 md:static md:w-64 md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-bottom border-neutral-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-bold text-xl hidden md:block">InviteChat</h2>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-neutral-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto scrollbar-hide">
          <button 
            onClick={() => {
              setShowView('messages');
              setIsSidebarOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl transition-colors",
              showView === 'messages' ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:bg-neutral-50"
            )}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="font-medium">Messages</span>
          </button>
          
          <button 
            onClick={() => {
              setShowView('invites');
              setIsSidebarOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl transition-colors",
              showView === 'invites' ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:bg-neutral-50"
            )}
          >
            <UserPlus className="w-5 h-5" />
            <span className="font-medium">{profile.isAdmin ? 'Management' : 'Invites'}</span>
          </button>

          <button 
            onClick={() => {
              setShowView('profile');
              setIsSidebarOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl transition-colors",
              showView === 'profile' ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:bg-neutral-50"
            )}
          >
            <Users className="w-5 h-5" />
            <span className="font-medium">Profile</span>
          </button>

          <div className="pt-4 pb-2 px-3">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Direct Messages</p>
            <div className="h-px bg-neutral-100 w-full my-2" />
          </div>
          {members.filter(m => m.uid !== profile.uid).map(member => (
            <button 
              key={member.uid}
              onClick={() => {
                setSelectedDM(member);
                setShowView('dm');
                setIsSidebarOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 p-2 rounded-xl transition-colors",
                showView === 'dm' && selectedDM?.uid === member.uid ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:bg-neutral-50"
              )}
            >
              <div className="relative shrink-0">
                <img src={member.photoURL} alt={member.displayName} className="w-8 h-8 rounded-full border border-neutral-200" />
                {member.status === 'online' && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
                )}
              </div>
              <div className="flex flex-col min-w-0 flex-1 text-left">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{member.displayName}</span>
                  {member.isAdmin && (
                    <span className="text-[8px] font-black text-neutral-400 uppercase tracking-tighter">Admin</span>
                  )}
                </div>
                {member.status === 'offline' && member.lastSeen && (
                  <span className="text-[9px] text-neutral-400 font-mono truncate">
                    Last seen: {format(member.lastSeen.toDate(), 'MMM d, HH:mm')}
                  </span>
                )}
              </div>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-neutral-100 space-y-4">
          <button 
            onClick={() => {
              setShowView('profile');
              setIsSidebarOpen(false);
            }}
            className="flex items-center gap-3 p-2 w-full hover:bg-neutral-50 rounded-xl transition-colors text-left"
          >
            <img src={profile.photoURL} alt={profile.displayName} className="w-10 h-10 rounded-full border border-neutral-200" />
            <div className="overflow-hidden">
              <p className="font-bold text-sm truncate">{profile.displayName}</p>
              <p className="text-xs text-neutral-500 truncate">{profile.email}</p>
            </div>
          </button>
          <button 
            onClick={logOut}
            className="w-full flex items-center justify-center gap-2 p-3 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>
      
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )
      }

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-neutral-200">
        
        {/* Video Call Overlay */}
        <AnimatePresence>
          {showVideoOverlay && (isCalling || callAccepted || receivingCall) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-neutral-900/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-8"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowVideoOverlay(false);
                }
              }}
            >
              <div className="max-w-6xl w-full h-full flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-neutral-800 rounded-2xl flex items-center justify-center border border-neutral-700">
                      <Video className="w-6 h-6 text-neutral-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black uppercase italic tracking-tighter">
                        {callAccepted ? "Active Call" : receivingCall ? "Incoming Call" : "Calling..."}
                      </h2>
                      <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest">
                        {callAccepted ? "Secure Connection Established" : "Waiting for response"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setVideoQuality(prev => prev === 'high' ? 'low' : 'high')}
                      className={cn(
                        "p-3 rounded-2xl transition-all border font-mono text-xs font-bold",
                        videoQuality === 'high' 
                          ? "bg-blue-500/10 text-blue-500 border-blue-500/20" 
                          : "bg-neutral-800 text-neutral-400 border-neutral-700"
                      )}
                      title={`Video Quality: ${videoQuality.toUpperCase()}`}
                    >
                      {videoQuality === 'high' ? 'HD' : 'SD'}
                    </button>
                    <button onClick={leaveCall} className="p-3 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Video Grid */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
                  {/* Remote Video */}
                  <div className="relative bg-neutral-800 rounded-3xl overflow-hidden border border-neutral-700 flex items-center justify-center group">
                    {callAccepted ? (
                      <>
                        <video playsInline ref={userVideo} autoPlay className="w-full h-full object-cover" />
                        <div className="absolute bottom-6 left-6 px-4 py-2 bg-black/40 backdrop-blur-md rounded-xl text-white text-xs font-bold uppercase tracking-widest border border-white/10">
                          {receivingCall ? callerName : selectedDM?.displayName}
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-6">
                        <div className="relative inline-block">
                          <div className="absolute inset-0 bg-neutral-700 rounded-full animate-ping opacity-20" />
                          <img 
                            src={receivingCall ? callerPhoto : selectedDM?.photoURL} 
                            alt="Avatar" 
                            className="w-32 h-32 rounded-full border-4 border-neutral-700 relative z-10" 
                          />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-2xl font-bold text-white">
                            {receivingCall ? callerName : selectedDM?.displayName}
                          </h3>
                          <p className="text-neutral-500 font-mono text-sm uppercase tracking-widest">
                            {receivingCall ? "is calling you" : "calling..."}
                          </p>
                        </div>
                        
                        {receivingCall && !callAccepted && (
                          <div className="flex items-center justify-center gap-4 pt-4">
                            <button 
                              onClick={answerCall}
                              className="px-8 py-4 bg-green-500 text-white rounded-2xl font-bold hover:bg-green-600 transition-all flex items-center gap-3 shadow-lg shadow-green-500/20"
                            >
                              <Phone className="w-5 h-5" />
                              Accept Call
                            </button>
                            <button 
                              onClick={leaveCall}
                              className="px-8 py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all flex items-center gap-3 shadow-lg shadow-red-500/20"
                            >
                              <PhoneOff className="w-5 h-5" />
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="absolute bottom-6 left-6 px-4 py-2 bg-black/40 backdrop-blur-md rounded-xl text-white text-xs font-bold uppercase tracking-widest border border-white/10">
                      {receivingCall ? callerName : selectedDM?.displayName}
                    </div>
                  </div>

                  {/* Local Video */}
                  <div className="relative bg-neutral-800 rounded-3xl overflow-hidden border border-neutral-700 group">
                    <video playsInline muted ref={myVideo} autoPlay className="w-full h-full object-cover" />
                    {!videoActive && (
                      <div className="absolute inset-0 bg-neutral-900 flex items-center justify-center">
                        <VideoOff className="w-16 h-16 text-neutral-700" />
                      </div>
                    )}
                    <div className="absolute bottom-6 left-6 px-4 py-2 bg-black/40 backdrop-blur-md rounded-xl text-white text-xs font-bold uppercase tracking-widest border border-white/10">
                      You (Local)
                    </div>
                    <div className="absolute top-4 right-4 p-2 bg-black/40 backdrop-blur-md rounded-full text-white">
                      {!micActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4 pb-4">
                  <button 
                    onClick={toggleMic}
                    className={cn(
                      "p-5 rounded-3xl transition-all border",
                      micActive ? "bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700" : "bg-red-500 text-white border-red-400"
                    )}
                  >
                    {micActive ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                  </button>
                  <button 
                    onClick={toggleVideo}
                    className={cn(
                      "p-5 rounded-3xl transition-all border",
                      videoActive ? "bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700" : "bg-red-500 text-white border-red-400"
                    )}
                  >
                    {videoActive ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                  </button>
                  <button 
                    onClick={() => {
                      if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen();
                      } else {
                        document.exitFullscreen();
                      }
                    }}
                    className="p-5 bg-neutral-800 text-white rounded-3xl border border-neutral-700 hover:bg-neutral-700 transition-all"
                  >
                    <Maximize2 className="w-6 h-6" />
                  </button>
                  <div className="w-px h-10 bg-neutral-800 mx-2" />
                  <button 
                    onClick={leaveCall}
                    className="p-5 bg-red-500 text-white rounded-3xl hover:bg-red-600 transition-all shadow-xl shadow-red-500/20"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {showView === 'invites' ? (
          <InvitesView profile={profile} members={members} />
        ) : showView === 'profile' ? (
          <ProfileView profile={profile} />
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white/80 backdrop-blur-md border-b border-neutral-200 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-neutral-500">
                  <Menu className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center overflow-hidden">
                  {showView === 'dm' && selectedDM ? (
                    <img src={selectedDM.photoURL} alt={selectedDM.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-5 h-5 text-neutral-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    {showView === 'dm' && selectedDM ? selectedDM.displayName : 'General Chat'}
                    {showView !== 'dm' && typingUsers['general'] && Object.keys(typingUsers['general']).length > 0 && (
                      <span className="text-xs text-neutral-400 font-normal italic animate-pulse">
                        {Object.values(typingUsers['general']).join(', ')} {Object.values(typingUsers['general']).length > 1 ? 'are' : 'is'} typing...
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">
                    {showView === 'dm' && selectedDM ? (selectedDM.status === 'online' ? 'Active Now' : 'Private Message') : 'Encrypted & Private'}
                  </p>
                </div>
              </div>

              {/* Status Indicator */}
              {(isCalling || callAccepted || receivingCall || callEnded) && (
                <button 
                  onClick={() => setShowVideoOverlay(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 rounded-full text-xs font-bold uppercase tracking-widest text-neutral-600 hover:bg-neutral-200 transition-colors"
                >
                  {callAccepted ? (
                    <><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> In Call</>
                  ) : receivingCall ? (
                    <><div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Incoming...</>
                  ) : isCalling ? (
                    <><div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Calling...</>
                  ) : callEnded ? (
                    <><div className="w-2 h-2 rounded-full bg-red-500" /> Call Ended</>
                  ) : null}
                </button>
              )}

              {showView === 'dm' && selectedDM && !(isCalling || callAccepted || receivingCall) && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => callUser(selectedDM.uid)}
                    className="p-2.5 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all flex items-center gap-2 text-xs font-bold"
                  >
                    <Video className="w-4 h-4" />
                    <span className="hidden sm:inline">Video Call</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
              <AnimatePresence initial={false}>
                {threadedMessages.map((msg) => (
                  <MessageItem 
                    key={msg.id} 
                    msg={msg} 
                    replies={msg.replies} 
                    profile={profile} 
                    members={members} 
                    toggleReaction={toggleReaction} 
                    setShowReactionPicker={setShowReactionPicker} 
                    showReactionPicker={showReactionPicker} 
                    setReplyTo={setReplyTo} 
                    deleteMessage={deleteMessage} 
                  />
                ))}



              </AnimatePresence>
              <div ref={scrollRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white/80 backdrop-blur-xl border-t border-neutral-200 relative">
              {/* Typing Indicator for DMs */}
              {showView === 'dm' && selectedDM && typingUsers[selectedDM.uid] && Object.keys(typingUsers[selectedDM.uid]).length > 0 && (
                <div className="absolute -top-8 left-6 text-xs text-neutral-500 italic animate-pulse bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-t-xl border border-b-0 border-neutral-200 shadow-sm">
                  {Object.values(typingUsers[selectedDM.uid]).join(', ')} {Object.values(typingUsers[selectedDM.uid]).length > 1 ? 'are' : 'is'} typing...
                </div>
              )}
              <div className="max-w-4xl mx-auto space-y-4">
                {/* Reply Preview */}
                <AnimatePresence>
                  {replyTo && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border-l-4 border-neutral-900 overflow-hidden"
                    >
                      <div className="flex-1 truncate pr-4">
                        <p className="text-[10px] font-black uppercase text-neutral-400">Replying to {replyTo.senderName}</p>
                        <p className="text-xs text-neutral-600 truncate">{replyTo.text || "Media Content"}</p>
                      </div>
                      <button onClick={() => setReplyTo(null)} className="text-neutral-400 hover:text-neutral-900">
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Upload Error */}
                <AnimatePresence>
                  {uploadError && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full mb-4 left-6 right-6 bg-red-50 text-red-600 px-4 py-3 rounded-xl border border-red-200 shadow-sm flex items-center justify-between z-10"
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">{uploadError}</span>
                      </div>
                      <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-600 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Media Preview Gallery */}
                <AnimatePresence>
                  {(mediaInputs.length > 0 || uploadProgress !== null) && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="flex gap-2 p-4 bg-neutral-50 border-t border-neutral-100 overflow-x-auto scrollbar-hide"
                    >
                      {mediaInputs.map((item, idx) => (
                        <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden shadow-sm shrink-0 group">
                          {item.type === 'image' || item.type === 'gif' ? (
                            <img src={item.url} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
                              <Video className="w-8 h-8 text-white" />
                            </div>
                          )}
                          <button 
                            onClick={() => setMediaInputs(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black transition-colors backdrop-blur-sm opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      
                      {uploadProgress !== null && (
                        <div className="relative w-24 h-24 rounded-xl overflow-hidden shadow-sm shrink-0 bg-neutral-200 animate-pulse flex flex-col items-center justify-center p-2">
                          <Loader2 className="w-6 h-6 text-neutral-900 animate-spin mb-1" />
                          <span className="text-[10px] font-bold text-neutral-900">{Math.round(uploadProgress)}%</span>
                          <div 
                            className="absolute bottom-0 left-0 right-0 bg-neutral-900/10 transition-all duration-300"
                            style={{ height: `${uploadProgress}%` }}
                          />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={sendMessage} className="flex gap-3 items-end">
                  <div className="relative">
                    <button 
                      type="button"
                      onClick={() => setShowMediaMenu(!showMediaMenu)}
                      className="p-4 bg-neutral-100 text-neutral-500 rounded-2xl hover:bg-neutral-200 transition-all"
                    >
                      <Paperclip className="w-6 h-6" />
                    </button>
                    
                    <AnimatePresence>
                      {showMediaMenu && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute bottom-full left-0 mb-4 w-64 bg-white rounded-2xl shadow-2xl border border-neutral-200 p-4 space-y-4 z-50"
                        >
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Attach Media</h4>
                          <div className="space-y-2">
                            <input 
                              type="file" 
                              ref={fileInputRef} 
                              className="hidden" 
                              accept="image/*,video/*"
                              onChange={handleFileUpload}
                            />
                            <button 
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="w-full flex items-center gap-3 p-3 hover:bg-neutral-50 rounded-xl transition-colors text-sm"
                            >
                              <Paperclip className="w-4 h-4 text-neutral-500" />
                              <span>Upload File</span>
                            </button>
                            <div className="h-px bg-neutral-100 my-2" />
                            <button 
                              type="button"
                              onClick={() => {
                                const url = prompt("Enter Image URL:");
                                if (url) setMediaInputs(prev => [...prev, { url, type: 'image' }]);
                                setShowMediaMenu(false);
                              }}
                              className="w-full flex items-center gap-3 p-3 hover:bg-neutral-50 rounded-xl transition-colors text-sm"
                            >
                              <ImageIcon className="w-4 h-4 text-blue-500" />
                              <span>Image URL</span>
                            </button>
                            <button 
                              type="button"
                              onClick={() => {
                                const url = prompt("Enter GIF URL:");
                                if (url) setMediaInputs(prev => [...prev, { url, type: 'gif' }]);
                                setShowMediaMenu(false);
                              }}
                              className="w-full flex items-center gap-3 p-3 hover:bg-neutral-50 rounded-xl transition-colors text-sm"
                            >
                              <Smile className="w-4 h-4 text-amber-500" />
                              <span>GIF URL</span>
                            </button>
                            <button 
                              type="button"
                              onClick={() => {
                                const url = prompt("Enter Video URL:");
                                if (url) setMediaInputs(prev => [...prev, { url, type: 'video' }]);
                                setShowMediaMenu(false);
                              }}
                              className="w-full flex items-center gap-3 p-3 hover:bg-neutral-50 rounded-xl transition-colors text-sm"
                            >
                              <Video className="w-4 h-4 text-purple-500" />
                              <span>Video URL</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex-1 relative">
                    <textarea 
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage(e as any);
                        }
                      }}
                      placeholder="Type a message..."
                      className="w-full p-4 bg-neutral-100 border-none rounded-2xl focus:ring-2 focus:ring-neutral-900 transition-all outline-none resize-none max-h-32 min-h-[56px]"
                      rows={1}
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={!newMessage.trim() && mediaInputs.length === 0}
                    className="p-4 bg-neutral-900 text-white rounded-2xl hover:bg-neutral-800 disabled:opacity-50 transition-all shadow-lg"
                  >
                    <Send className="w-6 h-6" />
                  </button>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


function ProfileView({ profile }: { profile: UserProfile }) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [photoURL, setPhotoURL] = useState(profile.photoURL);
  const [soundEnabled, setSoundEnabled] = useState(profile.notificationSettings?.soundEnabled ?? true);
  const [desktopEnabled, setDesktopEnabled] = useState(profile.notificationSettings?.desktopEnabled ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      await setDoc(doc(db, 'users', profile.uid), {
        displayName: displayName.trim(),
        photoURL: photoURL.trim(),
        notificationSettings: {
          soundEnabled,
          desktopEnabled,
        },
      }, { merge: true });
      
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      console.error("Error updating profile:", err);
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-12 max-w-2xl mx-auto w-full">
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-black tracking-tighter uppercase italic">Your Profile</h2>
          <p className="text-neutral-500 font-mono text-xs uppercase tracking-widest">Manage your identity in the chat</p>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl overflow-hidden">
          <div className="h-32 bg-neutral-900 relative">
            <div className="absolute -bottom-12 left-8">
              <img 
                src={photoURL || 'https://picsum.photos/seed/user/200/200'} 
                alt="Profile Preview" 
                className="w-24 h-24 rounded-2xl border-4 border-white shadow-lg bg-white object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          
          <form onSubmit={handleUpdate} className="p-8 pt-16 space-y-6">
            {message && (
              <div className={cn(
                "p-4 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2",
                message.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              )}>
                {message.text}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Display Name</label>
                <input 
                  type="text" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  required
                  className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 transition-all outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Profile Picture URL</label>
                <input 
                  type="url" 
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 transition-all outline-none"
                />
                <p className="text-[10px] text-neutral-400 italic">Provide a direct link to an image (e.g., from Unsplash or Gravatar)</p>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-neutral-100">
              <h3 className="text-xs font-black text-neutral-900 uppercase tracking-widest">Notification Preferences</h3>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-600">Sound Alerts</label>
                <button 
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={cn("w-12 h-6 rounded-full transition-all relative", soundEnabled ? "bg-neutral-900" : "bg-neutral-200")}
                >
                  <div className={cn("w-4 h-4 rounded-full bg-white absolute top-1 transition-all", soundEnabled ? "left-7" : "left-1")} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-600">Desktop Notifications</label>
                <button 
                  type="button"
                  onClick={() => setDesktopEnabled(!desktopEnabled)}
                  className={cn("w-12 h-6 rounded-full transition-all relative", desktopEnabled ? "bg-neutral-900" : "bg-neutral-200")}
                >
                  <div className={cn("w-4 h-4 rounded-full bg-white absolute top-1 transition-all", desktopEnabled ? "left-7" : "left-1")} />
                </button>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between gap-4">
              <div className="text-xs text-neutral-400">
                <div className="flex items-center justify-between">
                  <p>Member since: {profile.createdAt ? format(profile.createdAt.toDate(), 'MMMM yyyy') : '...'}</p>
                  {profile.isAdmin && (
                    <span className="px-2 py-0.5 bg-neutral-900 text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                      Administrator
                    </span>
                  )}
                </div>
                <p>Email: {profile.email}</p>
              </div>
              <button 
                type="submit"
                disabled={isSaving}
                className="px-8 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </form>
        </div>

        <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4">
          <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-amber-900">Identity Notice</h4>
            <p className="text-xs text-amber-700 leading-relaxed">
              Updating your profile will change how you appear in the chat and member directory. 
              Past messages will still show the name you had when you sent them.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvitesView({ profile, members }: { profile: UserProfile, members: UserProfile[] }) {
  const [email, setEmail] = useState('');
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!profile) return;
    // Fetch Invites
    let qInvites;
    if (profile.isAdmin) {
      qInvites = query(collection(db, 'invites'), orderBy('createdAt', 'desc'));
    } else {
      qInvites = query(
        collection(db, 'invites'), 
        where('invitedBy', '==', profile.uid),
        orderBy('createdAt', 'desc')
      );
    }
    
    const unsubInvites = onSnapshot(qInvites, (snapshot) => {
      setInvites(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invite)));
    }, (error) => {
      console.error("Error fetching invites:", error);
    });

    return () => {
      unsubInvites();
    };
  }, [profile?.isAdmin, profile?.uid]);

  const generateInvite = async () => {
    if (!profile) return;
    setIsSending(true);
    try {
      const docRef = await addDoc(collection(db, 'invites'), {
        invitedBy: profile.uid,
        invitedByName: profile.displayName || 'Unknown User',
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      copyInviteLink(docRef.id);
    } catch (err) {
      console.error("Error generating invite:", err);
    } finally {
      setIsSending(false);
    }
  };

  const revokeInvite = async (id: string) => {
    await deleteDoc(doc(db, 'invites', id));
  };

  const copyInviteLink = (id: string) => {
    const inviteLink = `${window.location.origin}?inviteId=${id}`;
    navigator.clipboard.writeText(inviteLink);
    alert("Invite link copied to clipboard!");
  };

  const sendEmailInvite = (email: string, id: string) => {
    const inviteLink = `${window.location.origin}?inviteId=${id}`;
    const subject = encodeURIComponent("You're invited to join our private chat!");
    const body = encodeURIComponent(`Hello!\n\nYou've been invited to join our private chat environment. Click the link below to sign up:\n\n${inviteLink}\n\nSee you there!`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-16 max-w-5xl mx-auto w-full">
      {/* Invite Section */}
      <div className="space-y-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-black tracking-tighter uppercase italic">Management</h2>
          <p className="text-neutral-500 font-mono text-xs uppercase tracking-widest">Control access to the environment</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-1 space-y-6">
            <div className="p-6 bg-white rounded-2xl border border-neutral-200 shadow-sm space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Generate Invite Link
              </h3>
              <div className="space-y-4">
                <p className="text-sm text-neutral-500">
                  Create a unique, one-time use link to invite a new member to the chat.
                </p>
                <button 
                  onClick={generateInvite}
                  disabled={isSending}
                  className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                  Generate & Copy Link
                </button>
              </div>
            </div>

            <div className="p-6 bg-neutral-900 text-white rounded-2xl space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-400" />
                Security Status
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400">Total Members</span>
                  <span className="font-mono">{members.length}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400">Pending Invites</span>
                  <span className="font-mono">{invites.filter(i => i.status === 'pending').length}</span>
                </div>
                <div className="h-px bg-neutral-800" />
                <p className="text-[10px] text-neutral-500 leading-relaxed italic">
                  Only users with an active invitation can join. Revoking an invite prevents new signups from that email.
                </p>
              </div>
            </div>
          </div>

          {/* Invites List and Active Members */}
          <div className="lg:col-span-2 space-y-8">
            {/* Invites List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-bold flex items-center gap-2 uppercase tracking-tight">
                  <Users className="w-5 h-5" />
                  Invitation History
                </h3>
              </div>
              <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200">
                        <th className="p-4 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Recipient</th>
                        <th className="p-4 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Inviter</th>
                        <th className="p-4 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Status</th>
                        <th className="p-4 text-[10px] font-bold text-neutral-400 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {invites.map((invite) => (
                        <tr key={invite.id} className="hover:bg-neutral-50 transition-colors group">
                          <td className="p-4">
                            <p className="font-bold text-sm">{invite.email || 'Generic Link'}</p>
                            <p className="text-[10px] text-neutral-400 font-mono">
                              {invite.createdAt ? format(invite.createdAt.toDate(), 'MMM d, HH:mm') : '...'}
                            </p>
                          </td>
                          <td className="p-4">
                            <span className="text-xs text-neutral-600">{invite.invitedByName}</span>
                          </td>
                          <td className="p-4">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter",
                              invite.status === 'accepted' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {invite.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {invite.status === 'pending' && (
                                <>
                                  {invite.email && (
                                    <button 
                                      onClick={() => sendEmailInvite(invite.email!, invite.id)}
                                      className="p-2 text-neutral-300 hover:text-neutral-900 transition-colors"
                                      title="Send Email"
                                    >
                                      <Mail className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => copyInviteLink(invite.id)}
                                    className="p-2 text-neutral-300 hover:text-neutral-900 transition-colors"
                                    title="Copy Link"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => revokeInvite(invite.id)}
                                    className="p-2 text-neutral-300 hover:text-red-500 transition-colors"
                                    title="Revoke Invite"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {invites.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-12 text-center text-neutral-400 italic text-sm">
                            No invitations found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Active Members List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-bold flex items-center gap-2 uppercase tracking-tight">
                  <ShieldCheck className="w-5 h-5" />
                  Active Members
                </h3>
              </div>
              <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200">
                        <th className="p-4 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">User</th>
                        <th className="p-4 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Role</th>
                        <th className="p-4 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Status</th>
                        <th className="p-4 text-[10px] font-bold text-neutral-400 uppercase tracking-wider text-right">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {members.map((member) => (
                        <tr key={member.uid} className="hover:bg-neutral-50 transition-colors group">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <img src={member.photoURL} alt={member.displayName} className="w-8 h-8 rounded-full border border-neutral-200" />
                              <div>
                                <p className="font-bold text-sm">{member.displayName}</p>
                                <p className="text-[10px] text-neutral-400 font-mono">{member.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter",
                              member.isAdmin ? "bg-purple-100 text-purple-700" : "bg-neutral-100 text-neutral-700"
                            )}>
                              {member.isAdmin ? 'Admin' : 'Member'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                member.status === 'online' ? "bg-green-500" : "bg-neutral-300"
                              )} />
                              <span className="text-xs text-neutral-600 capitalize">{member.status || 'offline'}</span>
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <p className="text-[10px] text-neutral-400 font-mono">
                              {member.createdAt ? format(member.createdAt.toDate(), 'MMM d, yyyy') : 'Unknown'}
                            </p>
                          </td>
                        </tr>
                      ))}
                      {members.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-12 text-center text-neutral-400 italic text-sm">
                            No members found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Members Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="font-bold flex items-center gap-2 uppercase tracking-tight">
            <ShieldCheck className="w-5 h-5" />
            Active Members
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => (
            <div key={member.uid} className="p-4 bg-white rounded-2xl border border-neutral-200 flex items-center gap-4 shadow-sm hover:border-neutral-900 transition-all cursor-default">
              <img src={member.photoURL} alt={member.displayName} className="w-12 h-12 rounded-xl border border-neutral-100" />
              <div className="overflow-hidden">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm truncate">{member.displayName}</p>
                  {member.isAdmin && (
                    <span className="px-1.5 py-0.5 bg-neutral-900 text-white text-[8px] font-black uppercase tracking-tighter rounded-md">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-neutral-400 truncate font-mono">{member.email}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    member.status === 'online' ? "bg-green-500 animate-pulse" : "bg-neutral-300"
                  )} />
                  <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                    {member.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                  {member.status === 'offline' && member.lastSeen && (
                    <span className="text-[8px] text-neutral-400 font-mono ml-1">
                      • {format(member.lastSeen.toDate(), 'MMM d, HH:mm')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
